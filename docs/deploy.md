# Deploying Sunshine Dental (Hetzner VPS + Coolify + Docker)

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

`PORT` defaults to `3000` and is set in compose; no need to add it.

---

## 6. First deploy

Click **Deploy**. Coolify builds both images and starts the stack. The `api`
healthcheck hits `GET /ping` (returns `{"status":"ok"}`); wait for both healthy.

### 6a. Sync the database schema (one-off, first deploy only)

This project uses Prisma **`db push`** (no migration files). After the first
deploy, open a shell in the **api** container (Coolify → api service → *Terminal*)
and run:

```bash
cd apps/api
pnpm exec prisma db push      # create/sync tables from schema.prisma
pnpm exec tsx prisma/seed.ts  # seed admin + providers — FIRST TIME ONLY
```

> If `db push` errors on the pooled connection (advisory-lock/pooling), add a
> non-pooled `directUrl` to the `datasource` block in
> `apps/api/prisma/schema.prisma` and set a `DIRECT_DATABASE_URL` env var, or run
> `db push` once from your laptop against the same `DATABASE_URL`.

Re-run `prisma db push` after any future schema change (it's safe and idempotent).
**Do not** re-run the seed — it inserts data.

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
Only re-run `prisma db push` when `schema.prisma` changed. The seed is never re-run.

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

### 11e. Deploy + seed (first time)
Deploy, then in the **api** container terminal (same as §6a):
```bash
cd apps/api
pnpm exec prisma db push       # sync schema into the dev DB
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
