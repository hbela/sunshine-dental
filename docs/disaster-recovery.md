# Disaster Recovery

_Last updated: 2026-07-17. Companion to [`deploy.md`](deploy.md),
[`monitoring-runbook.md`](monitoring-runbook.md) and
[`dev-to-prod-migration-plan.md`](dev-to-prod-migration-plan.md)._

> **STATUS 2026-07-17:** everything below is implemented and live except the offsite leg.
> Postgres runs in-stack (`db` service in `docker-compose.yml`; Prisma.io is gone). The
> recovery-keypair ceremony is **done** (prod master key age-wrapped, round-trip verified;
> `BACKUP_AGE_PUBKEY` set on both stacks). `nightly-backup` Scheduled Tasks run on **both**
> stacks (Run-now verified 2026-07-17: ~33 KB `.dump.age` each). **Still TODO:** Hetzner
> Storage Box (`STORAGEBOX_*`) — until then backups are local-only and do not survive loss
> of the VPS — and `HEALTHCHECK_URL` (dead-man's switch). Key fingerprints: prod
> `6b6114bd`, dev `30286e6d` (shown on `/api/health`).

Patient PII is AES-256-GCM ciphertext at rest (`enc:v1:`) and the master key is held **only**
by the clinic — never on the server, never by the vendor (see
[`compliance.md`](compliance.md)). That custody model is what makes offsite backups safe, and
it is also what makes **key loss unrecoverable**. This runbook covers both.

## Two failure modes, two mechanisms

| Failure | Recovery | Mechanism |
|---|---|---|
| **Infrastructure loss** — VPS dies, disk corruption, ransomware, bad migration | Restore the newest backup, unlock with the existing key | Nightly encrypted `pg_dump` (below) |
| **Key loss** — the clinic loses/forgets the master key | Recover the key itself, then unlock normally | `age`-wrapped master key (below) |

They are independent. A backup does **not** save you from key loss (a ciphertext dump is
exactly as locked as the DB), and a wrapped key does **not** save you from a dead disk. You
need both.

> **Why not a plaintext CSV/export as the recovery artifact?** It inverts the threat model —
> an unencrypted replica of all patient PII becomes the softest target in the system, and it
> voids the "encrypted at rest" claim under GDPR (a breach of that file has no mitigating
> factor). Decisively: an **automatic** plaintext export must decrypt, so it needs the master
> key on the server (`ALLOW_ENV_KEY=true`, which `crypto.ts` refuses in production precisely
> to prevent this) — putting the key next to the ciphertext. **"Automatic" and "the vendor
> holds no key" are mutually exclusive for a plaintext export.** CSV is also the wrong format:
> `@db.Text` transcripts contain newlines/quotes, `Appointment.date`/`startTime` are
> `@db.Date`/`@db.Time`, and FK/cascade ordering spans 11 models and 6 enums. Use `pg_dump`.

## The recovery keypair — one ceremony, two uses

At install, on the **clinic admin's machine** (never on the server):

```bash
age-keygen -o clinic-recovery.key      # prints the public key to stdout
```

- **Private key** (`clinic-recovery.key`) → print it, seal it, store in **two** locations
  (clinic safe + owner). This is the single break-glass secret. Never on the server, never
  with the vendor.
- **Public key** (`age1…`) → goes in server env as `BACKUP_AGE_PUBKEY`. Public keys are not
  secret; it is safe in Coolify, in this repo's env docs, anywhere.

### Use 1 — escrow the master key (no code required)

```bash
age -r "age1…" <<< "$MASTER_KEY" > master-key.age
```

`master-key.age` is useless without the private key, so it can be stored **anywhere** —
including by the vendor. Holding ciphertext of a key you cannot decrypt is not custody.

**If the clinic loses the master key:** retrieve the sealed private key → `age -d -i
clinic-recovery.key master-key.age` → recover the key → unlock the banner as normal. No data
loss, no plaintext, no vendor-held key.

### Use 2 — encrypt the backups

The server holds only the **public** key, so it can **create** backups but can never **read**
them. A fully compromised VPS cannot decrypt a single historical backup.

> **Why not restic/borg?** They would introduce a repo password — a *second* secret, readable
> by the box, that must itself be escrowed. Public-key encryption gives create-but-not-read
> for free, and the DB is small enough that dedup/incremental buy nothing.

## Automated backups

### Rules

- **Dump the whole database. Never selective tables.** `AppSetting` holds the
  `encryption.keycheck` canary and `encryption.keyfingerprint`. The ciphertext tables and the
  canary must be restored as a **matched set** — crossing one against the other reproduces
  exactly the `Wrong encryption key` failure from the 2026-07-14 incident
  ([migration plan §10](dev-to-prod-migration-plan.md)).
- **The dump is *not* fully ciphertext.** Patient PII is encrypted, but better-auth
  `Account.password` hashes, `Session.token` and `ChatConversation.token` are plaintext by
  design. PII-at-rest encryption is *why offsite storage is acceptable*, but `age` encryption
  of the dump is **not optional**.
- **Fail loudly.** Any failed step must exit non-zero and **skip** the healthcheck ping, so
  the dead-man's switch fires.

### Environment (Coolify → Environment Variables)

| Variable | Value | Notes |
|---|---|---|
| `BACKUP_DATABASE_URL` | Composed automatically in `docker-compose.yml` (`postgres://postgres:${POSTGRES_PASSWORD}@db:5432/sunshine`) | Direct in-stack connection — no pooler, no public port. If you ever point it elsewhere, keep it a **direct, non-pooled** URL: `pg_dump` is unreliable through poolers (same issue [`deploy.md`](deploy.md) §6a flags for `db push`). |
| `BACKUP_AGE_PUBKEY` | `age1…` | Clinic recovery **public** key. Not secret. |
| `HEALTHCHECK_URL` | e.g. healthchecks.io ping URL | Dead-man's switch — alerts when a run is **missed**, not just when one fails. |
| `STORAGEBOX_HOST` | `u123456.your-storagebox.de` | Hetzner Storage Box (offsite). If unset the job still runs but keeps backups **local only** and warns loudly. |
| `STORAGEBOX_USER` / `STORAGEBOX_PASS` | Storage Box credentials | Mark `STORAGEBOX_PASS` **secret**. |
| `STORAGEBOX_DIR` | default `backups/sunshine` | Remote directory. |
| `RETENTION_DAYS` | default `90` | Prune horizon, applied both remotely and to the local `/backups` volume. |

### The job — [`scripts/backup-db.sh`](../scripts/backup-db.sh)

The real script (dump → `age` → size sanity check → rclone/sftp upload → remote+local prune →
healthcheck ping; any failure exits non-zero **before** the ping). It runs inside the
**`backup`** service built from [`scripts/backup.Dockerfile`](../scripts/backup.Dockerfile)
(`alpine` + `age` + `rclone` + `postgresql17-client` — client major version must stay ≥ the
server's). It cannot live in the `api` image: that's `node:22-slim` with neither tool, and the
root `scripts/` directory isn't even in its build context (both Dockerfiles copy only `apps/*`
and `packages/*`).

**Coolify setup (one-time):** the `backup` service is part of `docker-compose.yml` (same
stack as `db` and `api`, so it reaches Postgres internally as `db:5432` — no public port,
no cross-network config). `BACKUP_DATABASE_URL` is composed from `POSTGRES_PASSWORD`
automatically; the container idles (`tail -f /dev/null`) with a named volume at `/backups`.

1. **Environment Variables** on the app resource → set `BACKUP_AGE_PUBKEY`,
   `HEALTHCHECK_URL` and the `STORAGEBOX_*` values from the table above.
2. **Scheduled Tasks** → name `nightly-backup`, container `backup`, command `backup-db.sh`,
   frequency `0 3 * * *`. Runs appear in the Coolify UI with full logs.
3. Verify once by clicking the task's **Run now**: expect `[backup] OK sunshine-<stamp>.dump.age`
   in the log, the file on the Storage Box, and the healthcheck check-in.

> Coolify's task log shows **stdout only** — the script's warnings (Storage Box /
> healthcheck unset) go to stderr and are invisible there. `[backup] OK` therefore does
> **not** imply an offsite copy exists; check the env vars, not just the log.
> Do not confuse this Scheduled Task with Coolify's built-in database "Backups" feature —
> that one produces an **unencrypted** local dump and is not part of this design.

## Restore procedure

The `backup` container has every tool needed (`age`, `pg_restore`, rclone) and can reach
`db:5432` — run the restore from its terminal (Coolify → app → backup → Terminal). Recent
dumps are already in its `/backups` volume; only a dead-VPS scenario needs the Storage Box
copy and a different machine.

- [ ] Fetch the newest `sunshine-<date>.dump.age` (from `/backups`, or the Storage Box).
- [ ] Decrypt with the sealed private key:
      `age -d -i clinic-recovery.key sunshine-<date>.dump.age > restore.dump`
- [ ] `pg_restore -d "$BACKUP_DATABASE_URL" --clean --if-exists restore.dump`
- [ ] Restart the api container → it boots **locked** (expected — see `deploy.md` §8a).
- [ ] Admin unlocks with the **same master key** as before. The canary came from the same dump,
      so it is a matched set and the key is accepted.
- [ ] `curl https://sunshine.appointer.hu/api/health` → `"encryption":"unlocked"` and
      `keyFingerprint` equals the expected value.
- [ ] Shred `restore.dump` (decrypted plaintext-structure dump containing auth hashes).

> The `keyFingerprint` on `/api/health` doubles as restore verification: it tells you *which*
> key the restored canary expects, before anyone types one.

## Quarterly restore drill

An untested backup is not a backup. Every quarter:

- [ ] Restore the newest backup into a **scratch** database (never over prod).
- [ ] Compare row counts per table against prod.
- [ ] Assert `AppSetting` contains `encryption.keycheck` (and `encryption.keyfingerprint` —
      absent only if the canary predates the fingerprint feature; `crypto.ts` tolerates that
      and `/api/health` then reports `keyFingerprint: null`).
- [ ] Point a local api at the scratch DB, unlock with the real key, confirm
      `/api/health` → `unlocked` with the matching `keyFingerprint`.
- [ ] Record the drill date here: **2026-07-16** — full loop (escrow round-trip, encrypted
      dump of the Prisma.io dev DB, restore into a fresh Coolify Postgres 17 on the VPS,
      boot-locked → wrong-key rejected → unlock → PII decrypts). Findings folded into the
      triage table below.

## Triage

| Symptom | Likely cause | Action |
|---|---|---|
| Healthcheck red / no ping | Job didn't run, or a step failed | Coolify → Scheduled Task → logs. Check `BACKUP_DATABASE_URL` reachability first. |
| `pg_dump: error: … server version mismatch` | Client older than server | Bump `postgresql-client` in the backup image. |
| `pg_dump` hangs / errors via pooler | `BACKUP_DATABASE_URL` points at the pooled endpoint | Use the direct, non-pooled URL. |
| Restore succeeds but unlock says `Wrong encryption key` | Canary/ciphertext **mismatched set** (partial restore, or DB re-seeded after the dump) | Re-restore the **whole** dump. See migration plan §10. |
| Restore succeeds but `db` unhealthy | Schema drift vs the running build | Restart api (boot runs `prisma db push`), or run it manually. |
| `pg_restore` exits 1: `extension "prisma_postgres" is not available` | Dump taken from Prisma.io, which injects its proprietary extension; vanilla Postgres lacks it | Benign — data restores fully (verify row counts). Expect a non-zero exit from `pg_restore` for this reason alone while the source DB is on Prisma.io; goes away after the DB moves to self-hosted Postgres. |

## Honest limits (do not over-claim)

- **Vendor-can't-read is process, not math**, while the vendor operates the VPS: the master
  key is in the api process's memory whenever the app is unlocked, and root can read process
  memory. Encryption at rest protects **stolen disks, database dumps, backups, and the DB
  provider** — real, valuable threats. It does not protect against a malicious or compromised
  root on the live box. State this in the DPA rather than over-claiming.
- **Losing both** the master key and the recovery private key = permanent data loss, by
  design. Mitigate with multiple sealed copies of the recovery private key — never by keeping
  plaintext PII around.
- Backups contain auth password hashes and session tokens; treat a decrypted dump as
  sensitive and shred it after use.
