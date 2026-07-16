# Dev → Prod migration plan (`feat/chat-receptionist` → `main`)

_Last updated: 2026-07-12. Companion to [`deploy.md`](deploy.md) — this plan supersedes the
parts of §6a/§8/§8a that predate the boot-time `prisma db push` (commit `5312fe7`)._

## 0. What is being promoted

Everything on `feat/chat-receptionist` (20 commits ahead of `main`, verified on
`sunshinedev.appointer.hu`):

| Area | Change |
|------|--------|
| **Chat receptionist** | Patient-facing multilingual text chat (`/chat`, PWA, widget), Sonnet 5 + prompt caching, booking-confirmation email via n8n, staff `/chat-logs` |
| **Encryption at rest** | Patient PII (Patient, Appointment, CallLog, ChatMessage, ChatConversation.summary, Provider phone/bio) as AES-256-GCM `enc:v1:` ciphertext; admin-unlock key custody; phone blind index |
| **Phone validation** | Hungarian-format validation + `normalizePhoneNumber()` across services and UI |
| **Name split** | `User.title/givenName/familyName` for order-safe provider matching (HU "Nagy Ibolya" ↔ "Ibolya Nagy") |
| **Ops hardening** | Dockerfile runs `prisma db push` on every container boot; unlock returns `503 DATABASE_SCHEMA_OUT_OF_DATE` instead of a raw 500 on schema drift |

**Schema changes are purely additive** (verified against `main`): new columns
`User.title/givenName/familyName` (nullable / `@default("")`), `Patient.phoneIndex`
(nullable), new tables `AppSetting`, `ChatConversation`, `ChatMessage`, two enums, one
index. `User.name` is **kept** and provider matching falls back to it, so **no user
backfill is required**. Boot-time `db push` (which runs **without**
`--accept-data-loss`) will therefore apply cleanly on prod.

### State as of 2026-07-12

- **Dev (sunshinedev):** deployed from this branch, schema synced, unlocked, verified —
  today's chat conversation is 20/20 ciphertext rows; pre-encryption chat rows purged.
- **Prod (sunshine.appointer.hu):** runs `main` — no chat, no encryption, **all patient
  PII plaintext in the prod DB**.
- **Prod CallLog purged (2026-07-12):** audited → 36 rows were all test/seed data (0 real
  patient calls, no phone number provisioned yet), so the table was wiped to empty before
  the migration. Consequence for step 6: the CallLog ciphertext count-check will be `0/0`.
- **n8n dev/prod both prepared (2026-07-12):** chat-booking-confirmation workflow ported to
  n8nprod; lock-window retries added on **both** instances; and a dev-only isolation bug
  fixed (n8ndev Post-Call node was writing to the prod DB — now on sunshinedev). See the
  pre-merge checklist and [[retell-dev-prod-switch]] / [[n8n-email-architecture]].
- **Uncommitted docs to include in the PR:** `docs/dev-to-prod-migration-plan.md` (this
  file), `docs/deploy.md` edits, `docs/megbizhatosag.hu.md`. Commit these on the branch
  before/with the merge so `main` carries the current runbook.

### Lessons from the dev rollout (bake these into prod)

1. **Schema drift breaks unlock.** Dev's first unlock 500'd because nobody ran `db push`
   after deploy. Fixed permanently by the Dockerfile boot-time push — but confirm the
   deploy log shows `Your database is now in sync` before unlocking.
2. **The first key wins.** If no key-check canary exists, the first unlock (or migration
   run) **creates** it from whatever key was entered — a typo'd key would poison the
   canary and reject the real key forever after. Therefore: **establish the canary with
   the migration script using the escrowed key (step 4) *before* anyone touches the
   unlock banner.**
3. **Legacy rows stay plaintext** until `encrypt-existing-data.ts` runs. Verify with row
   counts, not by spot-checking one row.

---

## 1. Pre-merge checklist (no downtime yet)

- [ ] **Generate the prod master key** on the clinic admin's machine — `openssl rand -hex 32`.
      Must be **distinct from the dev key**. Never on the VPS, never in Coolify env.
- [ ] **Escrow the key**: print twice → sealed envelopes in two locations (clinic safe +
      owner), optionally owner's password manager. Test-read one envelope.
- [ ] **Backup prod DB**: `pg_dump` (this final plaintext dump is itself PII — store
      offline, destroy after step 6 verification). This is also the rollback artifact.
- [ ] **Audit Coolify prod env** (§5 of deploy.md):
  - [ ] `ENCRYPTION_KEY` / `ALLOW_ENV_KEY` **absent**.
  - [ ] `ANTHROPIC_API_KEY` set — merging makes the public chat live on prod.
  - [x] ~~n8nprod workflow imported + active~~ **Done 2026-07-12**: "Chat Booking
        Confirmation Email" created directly on n8nprod (`r0WvLEAVKvD1V6cs`, ported from
        dev's `uQOCh9xWEanSPPTo`), Gmail node rewired to prod's actual credential
        (`Gmail account` / `SSHDHAefkBUth5jw` — **not** `Gmail account 2`, dev/prod use
        different credential names), activated, test execution succeeded (see
        [[n8n-email-architecture]]).
  - [x] `N8N_BOOKING_WEBHOOK_URL` = `https://n8nprod.appointer.hu/webhook/chat-booking-confirmation`
        **still needs to be set** in the prod API's Coolify env — the workflow is live but
        nothing calls it until this env var exists and the API redeploys with chat code.
- [x] **n8nprod resilience — node retries done 2026-07-12**; full lock-window coverage is
      operational, see below:
  - [x] Node-level retries added on n8nprod (`retryOnFail`): Post-Call `Log Call to API`
        (`FBfZ65vr9r6MmTQc`, maxTries 5 × 5s — async, no caller waiting) and Router
        `Book Appointment` + `Create Patient` (`kJ4QDaoEWRjdjkhj`, maxTries 2 × 3s — kept
        short to stay inside Retell's ~10–20s tool-call timeout; existing
        `continueErrorOutput` still catches the final failure gracefully).
  - **Why retries alone are not enough:** n8n node retry caps at ~25s, but a human unlock
    window is up to 15 min. Retries only cover a fast auto-restart, not a real unlock wait.
  - **Safe to retry (verified):** every write path calls `assertUnlocked()` *before* any DB
    write, so a lock-window 503 commits nothing — no duplicate risk. `call-logs` also
    upserts on `callId`; booking re-validates the slot and 409s if taken.
  - [ ] **The actual lock-window guarantee (operational, do at unlock time):** after
        unlocking, open the **n8nprod** execution list, filter the Post-Call workflow to
        **failed** executions in the lock window, and **Retry** them — idempotent, so replay
        is clean. This is what makes call logs "not lost". The error-alert email is the
        signal to do it.
  - [ ] Live-call bookings that land mid-lock can't wait 15 min — rely on the **deploy
        window** item below (deploy outside call hours + unlock fast), not retries.
- [ ] **Monitoring**: uptime monitor watches `/api/health` and alerts when
      `"encryption":"locked"` persists >15 min (see `monitoring-runbook.md`).
- [ ] **Schedule the window**: between deploy and step 5, patient/appointment/chat/call-log
      endpoints return `503 ENCRYPTION_LOCKED` (login + calendar availability keep
      working). Plan ~15–30 min outside clinic hours.

## 2. Merge

- [ ] Open PR `feat/chat-receptionist` → `main`, review, merge. Prod Coolify tracks
      `main`, so the merge is the deploy trigger (or click **Deploy** if auto-deploy is off).

## 3. Deploy + schema sync (automatic)

- [ ] Watch the api container log: boot now runs
      `prisma db push --skip-generate && tsx src/server.ts`. Confirm
      `Your database is now in sync with your Prisma schema` and a clean start.
- [ ] `curl https://sunshine.appointer.hu/api/health` →
      `{"status":"ok","db":"ok","encryption":"locked",...}`.
- [ ] **Do NOT unlock via the banner yet** (lesson 2 — the canary doesn't exist).

## 4. Encrypt existing prod data (establishes the canary)

In the **api** container terminal (Coolify → api → Terminal):

```bash
cd apps/api
pnpm exec tsx scripts/encrypt-existing-data.ts   # interactive key prompt (or --key <hex>)
```

- Enter the **escrowed** prod key. The script writes/verifies the canary **before**
  touching data, is idempotent (safe to re-run after a crash), and aborts cleanly on a
  wrong key.
- [ ] Script reports all tables migrated, 0 failures.

## 5. Unlock

- [ ] Clinic ADMIN logs into the dashboard (login works while locked) and pastes the key
      into the amber banner — or `POST /api/admin/unlock`.
- [ ] `/api/health` → `"encryption":"unlocked"`.

## 6. Verify

- [ ] **Ciphertext at rest** — raw SQL against prod (psql or a read-only script):
      `SELECT name, phone, "phoneIndex" FROM "Patient" LIMIT 5;` → values start `enc:v1:`.
      Count check: rows with `enc:v1:` prefix = total rows on Patient / Appointment
      (same method used to verify dev on 2026-07-12). **CallLog is empty** (purged pre-merge),
      so its check is `0/0` — nothing to verify there until the first post-merge call.
- [ ] **App works decrypted**: dashboard patient search, appointment list, call logs.
- [ ] **Chat end-to-end on prod**: open `/chat`, run a short booking conversation →
      appointment created, confirmation email arrives, `/chat-logs` shows the transcript,
      new `ChatMessage` rows are `enc:v1:` in the DB.
- [ ] **Voice lane untouched**: n8nprod HTTP nodes still point at
      `sunshine.appointer.hu` + prod `FASTIFY_API_KEY`; place a test call if in doubt.
      (The Retell agent's `backend_base_url` dynamic var switches dev/prod via
      `retell-set-backend.mjs` — make sure it points at **prod** when done testing.)

## 7. Restart drill (same day)

- [ ] Restart the api container. Confirm it comes back `locked`, monitoring fires within
      ~15 min, admin re-unlocks via the banner, health flips `unlocked`.
      This is the new normal after **every** deploy/restart.

## 8. Post-migration cleanup

- [ ] Destroy the plaintext `pg_dump` from step 1 once verification passed.
- [ ] Confirm (again) no `ENCRYPTION_KEY` anywhere in Coolify prod env.
- [ ] Update `main`-tracking docs if anything drifted; close out the rollout item in
      `deploy.md` §8a.
- [ ] Dev stays as-is: sunshinedev on its own DB + **dev** key; the two keys and canaries
      are independent.

## 9. Rollback

Encryption cannot be "toggled off" once data is migrated — rollback = restore:

1. Redeploy the previous `main` commit (Coolify → Deployments → redeploy old build).
2. Restore the step-1 `pg_dump` over the prod DB (this reverts to plaintext data and
   loses anything written after the dump — hence the quiet window).
3. Chat/encryption env vars can stay; the old build ignores them.

If only the **unlock** misbehaves (e.g. `DATABASE_SCHEMA_OUT_OF_DATE` 503): the schema
sync didn't run — check the api boot log, run `pnpm exec prisma db push` in the container
manually, retry. No rollback needed.

---

## 10. Key-mismatch incident + safeguards (added 2026-07-14)

### What happened
A correct-format prod key was rejected at unlock with **"Wrong encryption key"** (the
canary check, not the format check — so the input was a valid 64-hex string, just not the
one the canary expected). Root cause: **`prisma/seed.ts` re-keys whatever DB it points at.**
It runs `appSetting.deleteMany()` (drops the canary) then rewrites the canary from
`process.env.ENCRYPTION_KEY` and re-encrypts seed rows under it. Running `db:seed` with
`DATABASE_URL`→prod while a **dev** `.env` key was loaded silently re-keyed prod to the dev
key. The escrowed prod key was then rejected because it no longer matched the canary.

> **Diagnosis shortcut:** if a known-good key is rejected, try the key that was in
> `ENCRYPTION_KEY` the last time the DB was seeded — it's very likely the current canary key.

### Reset workflow (playground / no real PII to preserve)
A ciphertext `pg_dump` does **not** help recover a lost key (it's as locked as the DB); only
a *pre-encryption plaintext* dump does. With only seed/test data, re-establish cleanly —
run **inside the Coolify api container** (where `DATABASE_URL` already points at prod):

```bash
cd apps/api
# Deliberate reset: SEED_ALLOW_PROD=1 is required now (see safeguard #1);
# THIS key becomes the canary key, so pass your escrowed prod key.
ENCRYPTION_KEY=<escrowed-prod-key> SEED_ALLOW_PROD=1 pnpm db:seed
```

Then: confirm Coolify prod env has **no** persistent `ENCRYPTION_KEY` → **restart** the api
container (boots `locked`) → unlock via the banner with the same key → `/api/health` shows
`"encryption":"unlocked"`.

### Safeguards shipped (2026-07-14)
1. **Seed prod-guard** (`prisma/seed.ts`): refuses to run against a non-local `DATABASE_URL`
   (unparseable = treated as non-local, fail-closed) unless `--force` / `SEED_ALLOW_PROD=1`.
   Kills the accidental-prod-reseed footgun.
2. **Key fingerprint** (`crypto.ts` → `/api/health` + unlock banner): a non-secret 32-bit
   SHA-256 tag of the master key is stored beside the canary and surfaced as
   `keyFingerprint`. An operator can now confirm *which* key (dev vs prod) a server expects
   **before** unlocking. Safe to publish — infeasible to invert, and the canary is already an
   online key oracle. Written on canary creation, so it appears after the next
   seed/`encrypt-existing-data` run; older canaries report `null` until re-established.

> **Routine disaster recovery now lives in [`disaster-recovery.md`](disaster-recovery.md)** —
> nightly public-key-encrypted `pg_dump` backups + the `age`-wrapped master-key escrow that
> supersedes the design note below. This section stays as the incident record.

### Design note — break-glass recovery key (#3) — DECIDED 2026-07-14

The problem: the custody model deliberately keeps the vendor unable to decrypt (the server
never holds the key), so **if a clinic loses their key, the PII is unrecoverable.**

This note originally proposed envelope encryption with a **vendor-held** recovery KEK. That
was **rejected** — it would make the vendor a data processor *with access* to patient PII
(a GDPR/DPA burden), to solve a problem that doesn't require it.

**Decided instead:** a **clinic-held `age` recovery keypair** — the master key is wrapped to
the clinic's recovery *public* key (`age -r`), and the *private* key is sealed in the clinic's
safe. Recovery needs no vendor key and no code change; the wrapped blob is ciphertext, so the
vendor may even store it without holding custody. Same keypair also encrypts the nightly
backups. Full design + runbook: **[`disaster-recovery.md`](disaster-recovery.md)**.

Still open for scale: cloud **KMS** (IAM-gated) so no human handles a raw hex string —
bigger infra change, eliminates the lost-string failure mode entirely.
