# Deploying Sunshine Dental (Hetzner VPS + Coolify + Docker)

> **Deploying a stack for a *different* clinic?** Follow
> [`onboarding-new-clinic.md`](onboarding-new-clinic.md) instead — it wraps this
> guide with the per-clinic parts (clinic config, `CLINIC_ID`/`VITE_CLINIC_ID`,
> `--minimal` seed, its own Retell agent and n8n workflows).

This guide deploys the full app — **web** (Vite SPA) and **api** (Fastify + Prisma) —
to a Hetzner VPS managed by [Coolify](https://coolify.io), using the production
Postgres database hosted on Prisma.io.

> **Secrets:** Never commit real secrets. The `DATABASE_URL`, `BETTER_AUTH_SECRET`,
> and `FASTIFY_API_KEY` live **only** in Coolify's Environment Variables UI. The
> repo ships [`apps/api/.env.example`](../apps/api/.env.example) with placeholders.
> If the production `DATABASE_URL` was ever pasted into chat/email, rotate the
> Prisma key in the Prisma.io dashboard.

---

## 1. Architecture

Single public domain, two containers on one Docker network:

```
                 https://your-domain.com
                          │
                   ┌──────▼──────┐  Traefik (managed by Coolify, terminates TLS)
                   └──────┬──────┘
                          │ :80
                  ┌───────▼────────┐
                  │  web (nginx)   │  serves the SPA, reverse-proxies /api
                  └───────┬────────┘
                          │ http://api:3000   (internal compose network)
                  ┌───────▼────────┐
                  │  api (Fastify) │  ── DATABASE_URL ──▶  Prisma.io Postgres
                  └────────────────┘
```

Why same-origin: the SPA calls `/api` on its own origin and nginx proxies it to
the api container. The better-auth session **cookie stays first-party** (no CORS,
no cross-site cookie config). This matches `apps/web/src/lib/env.ts`, where an
empty `VITE_API_URL` means "same origin".

Files that make this work (all committed):

| File | Purpose |
|------|---------|
| [`docker-compose.yml`](../docker-compose.yml) | Defines the `api` + `web` services for Coolify |
| [`apps/api/Dockerfile`](../apps/api/Dockerfile) | Builds the API image (runs via `tsx`, see note below) |
| [`apps/web/Dockerfile`](../apps/web/Dockerfile) | Builds the SPA and serves it with nginx |
| [`apps/web/nginx.conf`](../apps/web/nginx.conf) | SPA fallback + `/api` reverse proxy to `api:3000` |
| [`.dockerignore`](../.dockerignore) | Keeps `node_modules`, `dist`, `.env`, generated client out of the build |

> **Note — why the API runs with `tsx`, not `node dist`:** the workspace package
> `@repo/shared` exports raw TypeScript (`src/index.ts`, no build step), so a plain
> `tsc` + `node dist/server.js` cannot resolve it at runtime. The API image runs
> `tsx src/server.ts` (the same runner as `pnpm dev`), which transpiles on the fly.
> It still runs `prisma generate` at build time. If you later want a leaner
> `node dist` image, give `@repo/shared` a real build (`tsc` → `dist/index.js`,
> point its `exports` there) or bundle the API with esbuild/tsup.

---

## 2. Prerequisites

- A Hetzner VPS (e.g. CX22 / 2 vCPU / 4 GB is plenty) running Ubuntu 22.04/24.04.
- Coolify installed on it (`curl -fsSL https://cdn.coolify.io/v4/install.sh | bash`).
- A domain with an **A record** pointing at the VPS IP (e.g. `app.sunshinedental.com`).
- The GitHub repo connected to Coolify (GitHub App or a deploy key).
- The Prisma.io production database URL.

---

## 3. Generate the secrets you'll need

On any machine:

```bash
# Stable session-signing secret for better-auth (32+ chars):
openssl rand -base64 32

# Shared key for the n8n / Retell webhooks to authenticate to the API:
openssl rand -hex 24
```

Keep these — you'll paste them into Coolify in step 5.

---

## 4. Create the application in Coolify

1. **+ New → Resource → Docker Compose** (Build Pack: *Docker Compose*).
2. Source: your GitHub repo, branch `main`.
3. Compose file path: `docker-compose.yml` (repo root).
4. Coolify parses the two services (`api`, `web`).
5. **Domain:** assign your domain (`https://your-domain.com`) to the **`web`**
   service, port **80**. Leave `api` with **no domain** (internal only).
   Enable "Generate SSL" (Let's Encrypt via Traefik).

---

## 5. Set environment variables (Coolify → Environment Variables)

Mark `DATABASE_URL`, `BETTER_AUTH_SECRET`, and `FASTIFY_API_KEY` as **secret**.

| Variable | Value | Notes |
|----------|-------|-------|
| `DATABASE_URL` | `postgres://…@pooled.db.prisma.io:5432/postgres?sslmode=require` | From Prisma.io. Keep `sslmode=require`. |
| `WEB_ORIGIN` | `https://your-domain.com` | CORS + better-auth trusted origin. Comma-separate if several. |
| `BETTER_AUTH_URL` | `https://your-domain.com` | Must match the public URL exactly. |
| `BETTER_AUTH_SECRET` | _(openssl output from step 3)_ | Stable across restarts, or sessions break. |
| `FASTIFY_API_KEY` | _(openssl output from step 3)_ | Must match what n8n/Retell send. |
| `ANTHROPIC_API_KEY` | _(Claude API key)_ | Powers the patient chat receptionist. Without it, `/api/chat/*` returns 503 "chat not configured". |
| `N8N_BOOKING_WEBHOOK_URL` | `https://n8nprod.appointer.hu/webhook/chat-booking-confirmation` | Optional. n8n webhook that emails a **chat** booking confirmation. Empty = no chat email (booking still works). |
| `BACKUP_DATABASE_URL` | _(direct, **non-pooled** Postgres URL)_ | **Secret.** Used by the nightly backup job — `pg_dump` is unreliable through a pooler (same issue as §6a). See [`disaster-recovery.md`](disaster-recovery.md). |
| `BACKUP_AGE_PUBKEY` | `age1…` | Clinic recovery **public** key the backups are encrypted to. Not secret. |
| `HEALTHCHECK_URL` | _(dead-man's-switch ping URL)_ | Pinged only on backup success, so a **missed** run alerts. |

`PORT` defaults to `3000` and is set in compose; no need to add it.

> **Do NOT set `ENCRYPTION_KEY` (or `ALLOW_ENV_KEY`) in production.** Patient
> PII is encrypted at rest and the master key must never be stored on the
> server — a clinic ADMIN unlocks the API after every start (see §8a).

---

## 6. First deploy

Click **Deploy**. Coolify builds both images and starts the stack. The `api`
healthcheck hits `GET /ping` (returns `{"status":"ok"}`); wait for both healthy.

### 6a. Database schema + seed

This project uses Prisma **`db push`** (no migration files). The api container
**runs `prisma db push` automatically on every boot** (Dockerfile `CMD`), so the
schema is always in sync after a deploy — no manual step. It runs *without*
`--accept-data-loss`, so a destructive schema change fails the boot instead of
silently dropping data (check the api log if the container won't start).

Only the seed is manual. After the **first** deploy, open a shell in the **api**
container (Coolify → api service → *Terminal*):

```bash
cd apps/api
# SEED_ALLOW_PROD=1 is REQUIRED against a non-local database — the seed refuses
# otherwise, because it WIPES every table and REWRITES the encryption canary from
# ENCRYPTION_KEY (this is how prod got re-keyed on 2026-07-14; see §10 of the
# migration plan). Pass the escrowed key: THIS key becomes the canary key.
ENCRYPTION_KEY=<escrowed-prod-key> SEED_ALLOW_PROD=1 pnpm exec tsx prisma/seed.ts  # FIRST TIME ONLY
```

> **Never re-run the seed on a live clinic database.** It is a first-install tool. Re-keying
> an existing DB strands all existing ciphertext under the old key.

> If the boot-time `db push` errors on the pooled connection
> (advisory-lock/pooling), add a non-pooled `directUrl` to the `datasource`
> block in `apps/api/prisma/schema.prisma` and set a `DIRECT_DATABASE_URL` env
> var, or run `db push` once from your laptop against the same `DATABASE_URL`.

**Do not** re-run the seed — it wipes and re-inserts data.

---

## 7. Verify

```bash
# API health (from the VPS or via the proxied path):
curl https://your-domain.com/api/ping        # -> {"status":"ok"}
```

Then in a browser:
1. Open `https://your-domain.com` → login page loads (Inter font, themed UI).
2. Log in with a seeded account (see `apps/api/prisma/seed.ts`).
3. Confirm the session sticks across a refresh (first-party cookie working).
4. Toggle dark mode; visit Calendar / Appointments / Patients.

---

## 8. Updating / redeploying

Push to `main` → Coolify auto-deploys (if "Auto Deploy" is on), or click **Deploy**.
Schema changes apply automatically (boot-time `db push`, see §6a). The seed is
never re-run. After every deploy the API boots **locked** — an ADMIN must unlock
patient data (§8a).

---

## 8a. Patient-data encryption (unlock after every deploy/restart)

Patient PII (names, phones, emails, notes, call/chat transcripts) is stored as
AES-256-GCM ciphertext. The 32-byte master key is **never stored on the
server**: the API boots **locked** and a clinic ADMIN must unlock it after every
deploy or restart. While locked, staff login and calendar availability keep
working, but patient/appointment/chat/call-log endpoints return
`503 { code: "ENCRYPTION_LOCKED" }` and the public chat widget shows
"temporarily unavailable".

### One-time setup (key + existing data)

> **Follow [`dev-to-prod-migration-plan.md`](dev-to-prod-migration-plan.md)** for
> the full first-rollout runbook (it folds in the lessons from the dev rollout).
> Summary of the order — it matters:

1. **Generate the key** on the clinic admin's machine (never on the VPS):
   ```bash
   openssl rand -hex 32
   ```
2. **Escrow it immediately** — key loss = permanent loss of all patient data.
   Print it twice, sealed envelopes in two locations (clinic safe + owner), plus
   optionally the owner's password manager. Test-read one envelope once.
3. **Backup**: `pg_dump` the prod DB (this final plaintext dump is itself PII —
   keep it offline and destroy it after verifying the migration).
4. Deploy the encryption-enabled build. The boot-time `db push` adds
   `Patient.phoneIndex` + `AppSetting` automatically; the API boots locked
   (`GET /api/health` → `"encryption": "locked"`).
5. **Before anyone touches the unlock banner**, encrypt the existing rows in the
   **api** container terminal (idempotent — safe to re-run after a crash). It
   writes/verifies the key-check canary *before* touching data, so a wrong key
   aborts cleanly:
   ```bash
   cd apps/api
   pnpm exec tsx scripts/encrypt-existing-data.ts   # prompts for the key (or --key <hex>)
   ```
   > ⚠️ **The first key wins.** If no canary exists yet, the first unlock (or
   > migration run) *creates* it from whatever key was entered — a typo'd key at
   > the banner would poison the canary and reject the real key ever after.
   > That's why the script (with the escrowed key) must run first.
6. Admin logs into the dashboard (login works while locked), pastes the key
   into the amber unlock banner. Health flips to `"unlocked"`.
7. Verify with a raw query (`SELECT name, phone, "phoneIndex" FROM "Patient"
   LIMIT 5;`) — values must start with `enc:v1:` — and by searching a patient
   in the dashboard.

If unlock returns `503 DATABASE_SCHEMA_OUT_OF_DATE`, the boot-time schema sync
didn't run — check the api boot log, run `pnpm exec prisma db push` in the
container, retry the unlock.

### After every deploy/restart

The keyring is in-memory only, so **every** api restart returns to `locked`.
The admin opens the dashboard and unlocks via the banner (or
`POST /api/admin/unlock`, ADMIN session required). Point uptime monitoring at
`/api/health` and alert when `encryption` stays `locked` for more than ~15
minutes — voice/chat bookings fail while locked (n8n should retry the
`POST /api/call-logs` and booking nodes so calls landing in a locked window
are not lost).

### Dev

Locally you may set `ENCRYPTION_KEY` in `apps/api/.env` (see `.env.example`) —
the server auto-unlocks at boot outside production. The seed requires it and
writes a matching key-check canary.

---

## 9. Wiring n8n / Retell (after deploy)

The voice/automation webhooks must now point at the production API and send the
`FASTIFY_API_KEY`:

- Base URL: `https://your-domain.com/api/...`
- Auth header carrying `FASTIFY_API_KEY` (see `apps/api/src/middleware/auth.middleware.ts`).

Update the n8n credentials / Retell tool URLs accordingly (replaces the local
ngrok `127.0.0.1:3000` used in development).

---

## 10. Troubleshooting

| Symptom | Likely cause / fix |
|---------|--------------------|
| Login works but session drops on refresh | `BETTER_AUTH_SECRET` not set/stable, or `BETTER_AUTH_URL` ≠ public URL. |
| CORS errors in console | You exposed the api on its own domain. Prefer same-origin; otherwise add that origin to `WEB_ORIGIN`. |
| `/api/...` returns 404 from nginx | nginx can't reach `api`; confirm both services share the compose network and api is healthy. |
| Prisma `P1001` can't reach DB | Check `DATABASE_URL` and that `?sslmode=require` is present. |
| Prisma engine / OpenSSL error | The image is Debian-based with `openssl` installed; rebuild without cache if you changed Prisma versions. |
| 502 right after deploy | api still starting; healthcheck `start_period` is 20s — give it a moment. |

---

## 11. Dev environment (`sunshinedev.appointer.hu`)

A second, **isolated** backend so the voice agent's dev lane (Retell DEV agent →
`n8ndev.appointer.hu` → this API → **dev** Postgres) never touches production data.
It reuses the same repo, `docker-compose.yml`, and Dockerfiles — only the domain,
database, and secrets differ. See [`retell-dev-prod-split-plan.md`](retell-dev-prod-split-plan.md)
for the full split.

### 11a. DNS
Add an **A record**: `sunshinedev.appointer.hu` → **`116.203.205.166`** (same VPS as prod).

### 11b. Dev database (separate from prod — and PERSISTENT)
Provision a **separate, long-lived** Postgres — do **not** reuse the prod `DATABASE_URL`.

> ⚠️ **Do NOT use a GitHub-branch-scoped Prisma preview database.** Prisma Postgres's GitHub
> integration creates an **ephemeral** database per git branch; when that branch is merged and
> deleted, Prisma **auto-deletes the database** (learned the hard way — a seeded dev DB vanished
> when its PR branch was deleted). The dev DB must be independent of git-branch lifecycle.

Pick one:
- **A. Standalone Prisma Postgres database** — create a **dedicated** database/project for dev
  (not a PR preview branch), copy its `prisma+postgres://accelerate.prisma-data.net/?api_key=…`
  URL. Accelerate protocol — the Fastify Prisma client 6.19 connects to it natively (verified).
  Reachable from anywhere, so schema+seed can be run externally.
- **B. Postgres container in Coolify** — *+ New → Database → PostgreSQL* on the same project,
  use its internal connection URL. Fully persistent + isolated on the VPS; seed via the api
  container terminal (§11e) since it's internal-only.

Use the chosen URL as **`DATABASE_URL`** in the dev app's Coolify env (not the local
`localhost:5432` value from `.env`).

### 11c. Coolify application
1. **+ New → Resource → Docker Compose**, same GitHub repo + branch `main`, compose file
   `docker-compose.yml` (Coolify namespaces the `api`/`web` services per resource, so there's
   no clash with prod).
2. **Domain:** assign `https://sunshinedev.appointer.hu` to the **`web`** service, port 80;
   Generate SSL. Leave `api` internal.

### 11d. Environment variables (mark secrets)
| Variable | Value |
|----------|-------|
| `DATABASE_URL` | the **dev** DB URL from 11b (`?sslmode=require`) |
| `WEB_ORIGIN` | `https://sunshinedev.appointer.hu` |
| `BETTER_AUTH_URL` | `https://sunshinedev.appointer.hu` |
| `BETTER_AUTH_SECRET` | a fresh `openssl rand -base64 32` (distinct from prod) |
| `FASTIFY_API_KEY` | a fresh `openssl rand -hex 24` (distinct from prod; this is what **n8ndev** will send) |
| `ANTHROPIC_API_KEY` | Claude API key for the patient chat (may reuse the prod key). Omit to leave chat disabled on dev. |
| `N8N_BOOKING_WEBHOOK_URL` | `https://n8ndev.appointer.hu/webhook/chat-booking-confirmation` — emails a chat booking confirmation. Omit to disable. |

### 11e. Deploy + seed (first time)
Deploy — the schema syncs automatically at boot (§6a). Then, in the **api**
container terminal, seed once:
```bash
cd apps/api
pnpm exec tsx prisma/seed.ts   # seed admin + providers (Dr. Ibolya Nagy, Dr. István) — first time only
```

### 11f. Verify
```bash
curl https://sunshinedev.appointer.hu/api/health   # -> 200 {"status":"ok","db":"ok",...}
curl https://sunshinedev.appointer.hu/api/ping     # -> {"status":"ok"}
```
Add the dev `/api/health` URL to the uptime monitor. Once green, repoint **n8ndev**'s HTTP
nodes at `https://sunshinedev.appointer.hu/api` with the dev `FASTIFY_API_KEY` (Part 4 of the
split plan) — that is the step that actually isolates dev data.
