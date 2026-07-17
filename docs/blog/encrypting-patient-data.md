When I added an AI receptionist (voice + chat) to a dental-clinic app, I ended up storing exactly the data you least want to leak: names, phone numbers, appointment reasons, full call and chat transcripts. This post is the complete, working design I landed on for **field-level encryption where the vendor cannot read the data**, plus the backup and disaster-recovery machinery that has to exist before you can honestly claim any of it. It's written for engineers; everything below is running in production on a €4 Hetzner VPS.

The one-sentence design goal, and the constraint that shapes everything else:

> **The clinic holds the encryption key. The server — and therefore I, the vendor — never stores it.**

Everything interesting in this post is a consequence of that sentence.

## What encryption at rest actually buys you

Be precise about the threat model, because "encrypted" is doing a lot of marketing work in most SaaS copy. Field-level encryption with a clinic-held key protects against:

- a **stolen database dump** (SQL injection, leaked backup, misconfigured storage bucket),
- a **stolen disk** or decommissioned hardware,
- your **DB provider** reading your tables,
- **you**, the vendor, casually browsing customer PII.

It does **not** protect against a malicious root on the live box while the app is unlocked — the key sits in process memory, and root can read process memory. That's process, not math. Say so in your DPA instead of over-claiming; the honest version is still a strong story.

## Layer 1: field-level AES-256-GCM

Ciphertext values are self-describing strings with a version prefix:

```
enc:v1:<base64(iv || ciphertext || gcm-tag)>
```

The prefix makes encryption **idempotent** (encrypting an already-encrypted value is a no-op) and makes migration windows survivable (plaintext rows pass through the decrypt path unchanged until a migration script catches them):

```ts
export function encryptString(plaintext: string): string {
  if (isEncrypted(plaintext)) return plaintext   // double-encryption impossible
  assertUnlocked()
  return encryptWith(keys!.dataKey, plaintext)
}

export function decryptString(value: string): string {
  if (!isEncrypted(value)) return value          // pre-migration rows pass through
  assertUnlocked()
  return decryptWith(keys!.dataKey, value)
}
```

Two deliberate choices here:

**One master key, HKDF subkeys.** The clinic's 32-byte master key (64 hex chars, `openssl rand -hex 32`) is never used directly. HKDF derives a `dataKey` (AES-GCM) and an `indexKey` (HMAC, see below), so the two uses can never collide cryptographically.

**Encryption is explicit in the service layer, not a Prisma middleware.** A `$extends` hook that transparently encrypts everything sounds elegant and is a debugging nightmare — you lose the ability to reason about which queries touch ciphertext, and every raw query becomes a landmine. Instead there's a single `ENCRYPTED_FIELDS` map and explicit `encryptRow('patient', {...})` / `decryptRow(...)` calls at the boundaries. Grep-ability is a security feature.

## Layer 2: searching what you can't read

Encrypted columns break two things you actually need: exact lookups and substring search.

**Exact phone lookup** (dedupe: "does this caller already exist?") uses a **blind index** — a keyed HMAC over the normalized phone number stored in its own column:

```ts
export function blindIndex(normalized: string): string {
  assertUnlocked()
  return createHmac('sha256', keys!.indexKey)
    .update(normalized, 'utf8')
    .digest('base64url')
}
```

Deterministic per key, so `WHERE phoneIndex = ?` works over ciphertext; without the key the index is neither reversible nor even testable against guesses (unlike a plain hash, you can't brute-force candidate phone numbers without the HMAC key). Normalization matters more than the crypto here — Hungarian numbers arrive as `06 20…`, `+36 20…`, `0036 20…`, and they must all index identically.

**Substring search** (a receptionist typing "Kov" into the patient list) has no clean cryptographic answer at this scale, so it does the honest thing: decrypt-and-filter in memory with a hard scan cap. For a single clinic's patient list this is milliseconds; pretending otherwise with order-preserving encryption schemes buys real vulnerabilities to save fake milliseconds.

## Layer 3: key custody — the server boots locked

This is the part that makes the "vendor can't read" claim true in operation, not just in architecture:

- The API **boots locked**. No key on disk, no key in env (`crypto.ts` refuses `ENCRYPTION_KEY` in production unless an explicit `ALLOW_ENV_KEY=true` escape hatch is set — which prod never sets).
- An **ADMIN unlocks** via `POST /api/admin/unlock` with the key; the key lives only in process memory. Every deploy or restart re-locks, and the admin does a 10-second unlock ritual. That ritual *is* the custody model — mildly annoying, entirely the point.
- While locked, the app **degrades instead of dying**: login works, the calendar renders with `••••` placeholders for titles, PII endpoints return a clean `503 ENCRYPTION_LOCKED`, and the patient chat says it's temporarily unavailable. Staff can work; nobody can read PII.

![The staff dashboard in the locked state, with the unlock banner](/sunshine-dental/11-locked.png)

### The canary: rejecting wrong keys before they poison anything

An unlock endpoint that accepts any 64-hex string is an unlock endpoint that will eventually accept a *typo*. The fix is a **keycheck canary**: on first unlock, a known plaintext is encrypted with the candidate key and stored in an `AppSetting` row. Every later unlock must decrypt that canary back to the known plaintext, or it's rejected with `400 Wrong encryption key` — GCM's auth tag does the verification for free:

```ts
if (existing) {
  if (decryptWith(candidate.dataKey, existing.value) !== KEYCHECK_PLAINTEXT) {
    return false   // wrong key: rejected before touching any data
  }
} else {
  await db.appSetting.create({ data: { key: KEYCHECK_SETTING_KEY,
    value: encryptWith(candidate.dataKey, KEYCHECK_PLAINTEXT) } })
}
```

### War story: the day the seed script re-keyed production

The canary has a flip side: **whoever writes it first wins.** Our seed script wipes tables and rewrites the canary from `process.env.ENCRYPTION_KEY` — and one day it was run with `DATABASE_URL` pointed at prod while a *dev* key was loaded in the shell. Result: prod silently re-keyed to the dev key, and the real, escrowed prod key started bouncing off the unlock endpoint with "Wrong encryption key". Nothing was lost (the data had been re-encrypted under the dev key, not destroyed), but the diagnosis took a while because the error reads like a typo, not like a re-key.

Two safeguards came out of that incident:

1. **The seed refuses non-local databases.** It parses `DATABASE_URL`, and anything that isn't localhost fails closed unless you pass `SEED_ALLOW_PROD=1` — turning "accidentally nuked prod" into a deliberate two-step.
2. **A key fingerprint** — a non-secret 8-hex SHA-256 tag of the master key, stored beside the canary and surfaced on `/api/health` and in the unlock banner ("This server expects key fingerprint `6b6114bd`"). An operator can now tell *which* key a database expects before typing one. Publishing it is safe: it's infeasible to invert, and the canary is already an online oracle anyway.

## Layer 4: escrow — one keypair, two jobs

"The vendor holds no key" has an ugly corollary: **if the clinic loses the key, the data is gone.** You need a recovery story that doesn't reintroduce vendor custody. The answer is a single [age](https://age-encryption.org) keypair, generated once at install **on the clinic's machine**:

```bash
age-keygen -o clinic-recovery.key   # prints: Public key: age1…
```

- The **private key** is printed, sealed, and stored in two physical places (clinic safe + owner). It never touches a server.
- The **public key** is genuinely public — it goes in the server env, the repo docs, anywhere.

**Job 1 — escrow the master key:**

```bash
age -r "age1…" <<< "$MASTER_KEY" > master-key.age
```

`master-key.age` is useless without the sealed private key, so it can be stored *anywhere* — even by the vendor. Holding ciphertext of a key you cannot decrypt is not custody. Clinic loses the key → unseal the paper → `age -d` → unlock as normal.

Two alternatives were rejected on the way here. A **vendor-held recovery KEK** (classic envelope encryption) would make the vendor a data processor *with PII access* — a GDPR/DPA burden taken on to solve a problem that doesn't need it. And an **automatic plaintext export** ("just keep a CSV somewhere safe!") is self-refuting: *automatic* means it must decrypt, which means the key must be on the server, which is precisely the thing the whole model forbids. **"Automatic" and "the vendor holds no key" are mutually exclusive for a plaintext export.**

**Job 2 — encrypt the backups.** Same keypair, next section.

## Layer 5: backups the server can create but never read

Nightly job, in full (trimmed of logging):

```bash
set -euo pipefail
STAMP="$(date +%F-%H%M)"
pg_dump -Fc --no-owner --no-privileges "$BACKUP_DATABASE_URL" \
  | age -r "$BACKUP_AGE_PUBKEY" > "sunshine-${STAMP}.dump.age"
# size sanity check — refuse to call a 300-byte stub a backup
# rclone → Hetzner Storage Box, prune > 90 days (remote + local)
curl -fsS --retry 3 "$HEALTHCHECK_URL"   # dead-man's switch: ONLY on success
```

The design points, each earned the hard way:

- **Public-key encryption of the stream.** The server holds only the `age1…` public key, so a fully compromised VPS cannot decrypt a single historical backup. This is why not restic/borg: they'd introduce a repo password — a *second* secret, readable by the box, that itself needs escrow. Asymmetric crypto gives create-but-not-read for free, and a small DB gets nothing from dedup.
- **Whole-database dumps, never selective tables.** The canary and the ciphertext must travel as a **matched set** — restore ciphertext against a different canary and you've manufactured the exact "Wrong encryption key" incident from the war story above.
- **Fail loudly, ping late.** Any failed step exits non-zero and *skips* the healthcheck ping, so the dead-man's switch (healthchecks.io) fires on missed runs, not just failed ones. A backup system's worst failure mode is silence.
- **The dump is *not* fully ciphertext.** Auth password hashes and session tokens are plaintext by design (the auth library owns them), so `age` encryption of the dump is not optional, and a decrypted restore artifact gets shredded after use.
- It runs as a tiny **`backup` service inside the same docker-compose stack** as the app and Postgres (`alpine` + `postgresql17-client` + `age` + `rclone`), triggered by a Coolify Scheduled Task. It can't live in the API image — `node:22-slim` has none of the tools, and putting `pg_dump` in your app container is how version-mismatch surprises happen. In-stack also means it reaches Postgres as `db:5432` on the compose network: **no public database port exists at all**.

## The drill — because an untested backup is not a backup

Before trusting any of this, I ran the whole loop as a fire drill against a scratch Postgres on the VPS: wrap the master key → unwrap it (byte-identical) → `pg_dump | age` the dev DB → decrypt → `pg_restore` into the empty scratch DB → point an API at it → confirm it **boots locked** → confirm a wrong key gets `400` and the DB **stays** locked → unlock with the real key → watch PII decrypt. Row counts matched on all 13 tables.

The drill also surfaced three things no amount of desk-checking would have:

1. **`pg_restore` exits non-zero on a benign error.** Dumps taken from a managed Postgres (Prisma.io in our case) carry `CREATE EXTENSION prisma_postgres`, which vanilla Postgres can't satisfy. Data restores fully; the exit code still says 1. If your restore runbook (or your monitoring) treats any non-zero as fatal, a real 3 AM restore just got scarier for no reason. Now documented in the triage table.
2. **The doc was stricter than the code.** The runbook asserted a `keyfingerprint` row must exist post-restore; databases whose canary predates the fingerprint feature legitimately report `null`. The check would have "failed" a perfectly good restore.
3. **Warnings on stderr are invisible in the scheduler's log view.** Our "backup is LOCAL ONLY" warning goes to stderr — which Coolify's task log doesn't show. `[backup] OK` in a log does not imply the offsite copy exists; verify the env, not the log line.

That's the actual value of a drill: not confirming the happy path, but finding the places where your *documentation* and your *monitoring* would have lied to you during a real incident.

## Honest limits, again

- Root on the live box can read the key from process memory while unlocked. Encryption at rest protects stolen dumps/disks/backups/providers — real threats — not a hostile host.
- Runtime plaintext still flows to the LLM APIs powering the receptionist; that's a data-processing relationship to disclose, not something encryption at rest changes.
- Losing **both** the master key and the sealed recovery key means permanent data loss, *by design*. Mitigate with multiple sealed copies — never with a plaintext stash.

## The checklist version

1. `enc:v1:` prefixed AES-256-GCM fields; HKDF subkeys; explicit service-layer encryption.
2. HMAC blind index for exact lookups; capped decrypt-and-filter for substring search.
3. Boot locked; admin unlock; canary rejects wrong keys; fingerprint tells you *which* key.
4. Guard every path that can (re)write the canary — especially your seed script.
5. One clinic-held `age` keypair: escrows the master key **and** encrypts backups.
6. Nightly whole-DB `pg_dump | age -r <pubkey>`; offsite; prune; dead-man's switch pinged only on success.
7. Drill the restore quarterly. Write down what the drill contradicts in your docs.

None of this needed a KMS, an HSM, or a security team — it needed one deliberate constraint ("the server never holds the key") and the discipline to follow its consequences all the way down to the backup script's exit codes.
