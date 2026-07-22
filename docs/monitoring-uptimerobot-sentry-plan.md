# Add UptimeRobot + Sentry monitoring — implementation plan

## Context

The clinic's monitoring today covers *reactive infra* well — a public `/api/health`
endpoint (DB probe), an n8n execution-failure email alert, a nightly-backup dead-man's
switch, and [`monitoring-runbook.md`](monitoring-runbook.md) — but two gaps remain, both
already flagged in that runbook:

1. **No external uptime probe.** Nothing pings the live URLs from outside the VPS, so a
   full outage (Coolify/Traefik/nginx down, DNS, TLS expiry) would go unnoticed until a
   human or a voice call hit it. The runbook's "External monitoring" section already lists
   the exact URLs with blank placeholders to fill in.
2. **No error tracking.** 5xx and unhandled exceptions in the Fastify API, and JS errors in
   the patient-facing chat SPA, vanish into container logs with no aggregation or alert.
   The runbook lists "Sentry error tracking in the Fastify API" as a deferred next step.

Outcome: outside-in uptime alerting via **UptimeRobot**, and error capture via **Sentry**
across both the API (`@sentry/node`) and the web SPA (`@sentry/react`). Both must be
**no-ops when their DSN/config is absent**, so local dev is unaffected.

**Decisions (from user):** Sentry = backend + frontend error capture with minimal tracing;
DSNs come from an existing sentry.io account (user creates the projects, pastes DSNs into
Coolify); UptimeRobot = documented for the user to create in the UI (no API scripting).

---

## Part A — UptimeRobot (documentation only, no code)

No code change. Deliverable is filling the existing placeholders in
[`monitoring-runbook.md`](monitoring-runbook.md) (External monitoring section,
~lines 97–111) with a concrete, ready-to-create monitor spec:

- **Monitor 1 — Web SPA:** `GET https://sunshine.appointer.hu`, HTTP(s), expect 200, 5-min interval.
- **Monitor 2 — API + DB:** `GET https://sunshine.appointer.hu/api/health`, expect 200, 5-min interval.
  - **Add a keyword sub-check:** keyword monitor on the same URL requiring `"encryption":"unlocked"`.
    Rationale: `/api/health` returns **200 even when the keyring is locked** (verified in
    [`apps/api/src/routes/health.routes.ts`](../apps/api/src/routes/health.routes.ts)), so a
    plain up/down monitor cannot detect a post-restart locked state where patient PII can't
    be decrypted. The keyword monitor alerts on that. (Optional but recommended.)
- **Monitor 3 — n8n liveness:** `GET https://n8nprod.appointer.hu/healthz`, expect 200, 5-min interval.
- **Alert contacts:** email `hajzerbela@gmail.com` (matches existing n8n alert recipient);
  note the option to add Slack/Telegram to match the deferred escalation item.
- After creation, record the UptimeRobot dashboard URL(s) on the placeholder lines.

**Relationship to existing Coolify email notifications (already enabled on the VPS):**
Coolify already emails on **Deployment failure, Backup failure, Scheduled Task failure,
Docker Cleanup failure, Server Disk Usage, Server Unreachable, and Server Patching**. Those
are *inside-out*, server/job-level signals from Coolify's own perspective. UptimeRobot is
**not redundant** — it adds the *outside-in* view Coolify can't provide:

- DNS resolution and TLS-certificate expiry for `sunshine.appointer.hu`.
- Traefik/nginx routing and the public edge actually serving 200 (Coolify can consider the
  server "up" while the reverse proxy or the SPA returns 5xx/blank).
- **Application-level correctness via response body** — the `/api/health` 200 **and** the
  `"encryption":"unlocked"` keyword — which no Coolify server-level alert covers.
- n8n reachability at the public URL (`n8nprod.appointer.hu/healthz`).

So keep all three monitors; the runbook should note the split (Coolify = infra/jobs inside
the box; UptimeRobot = public reachability + app health from outside) rather than telling
the user to "enable Coolify notifications," which is already done.

---

## Part B — Sentry backend (`apps/api`)

**Dependency:** `pnpm --filter api add @sentry/node`

**New file — `apps/api/src/instrument.ts`:** call `Sentry.init(...)` here so it can be
imported as the very first line of the entrypoint (ESM requires init before other modules
load for auto-instrumentation). Init reads `process.env.SENTRY_DSN`; **if unset, skip init
entirely** (dev/local no-op). Config:
- `dsn: process.env.SENTRY_DSN`
- `environment: process.env.NODE_ENV ?? 'development'`
- `tracesSampleRate: 0` (errors-only, minimal tracing per decision)
- optionally `release` from a build/env var if available (skip if not trivial).

**Edit `apps/api/src/server.ts`:** add `import './instrument.js'` as the **first** import,
above `import Fastify`.

**Edit `apps/api/src/app.ts` — the existing `setErrorHandler` (lines 17–32):** capture to
Sentry inside it, surgically, without changing response behavior. Before the final
`reply.send(error)` fallthrough (the genuine 5xx / unhandled path — validation 400s and
coded HttpErrors return earlier and should NOT be reported), add
`Sentry.captureException(error)`. This is preferred over `Sentry.setupFastifyErrorHandler`
here because the app already owns a custom error handler, and manual capture avoids any
interaction with the SSE chat stream in
[`apps/api/src/routes/chat.routes.ts`](../apps/api/src/routes/chat.routes.ts) (`reply.raw` /
`text/event-stream`). Truly unhandled (non-request) exceptions are still caught by the
global handlers `Sentry.init` installs.

**Edit `docker-compose.yml` — `api` service `environment` block:** add
`SENTRY_DSN: ${SENTRY_DSN:-}` alongside `ANTHROPIC_API_KEY` (same optional-with-default
pattern). Value set in Coolify's Environment Variables UI.

**Edit `apps/api/.env.example`:** add a commented `SENTRY_DSN=` line documenting it as
optional (empty = disabled).

---

## Part C — Sentry frontend (`apps/web`)

**Dependency:** `pnpm --filter web add @sentry/react`

**Edit `apps/web/src/main.tsx`:** call `Sentry.init(...)` at the top (before
`createRoot`), reading `import.meta.env.VITE_SENTRY_DSN` (matches the existing
`import.meta.env` / `VITE_` convention in [`apps/web/src/lib/env.ts`](../apps/web/src/lib/env.ts)).
**No-op when the DSN is empty.** Config: `dsn`, `environment: import.meta.env.MODE`,
`tracesSampleRate: 0`. `@sentry/react`'s init auto-captures unhandled errors + promise
rejections globally.

**Edit `apps/web/src/routes/__root.tsx`:** the root route currently has no error handling.
Add a TanStack Router `errorComponent` that (a) reports the error via
`Sentry.captureException` and (b) renders a minimal friendly fallback UI (i18n-consistent
with the app). This catches React render/route errors that global handlers miss and
improves patient-facing UX on a crash.

**Build-time DSN wiring (frontend DSN is public/non-secret — expected for browser SDKs):**
- **`apps/web/Dockerfile`:** the web image passes no build args today. Add
  `ARG VITE_SENTRY_DSN` + `ENV VITE_SENTRY_DSN=$VITE_SENTRY_DSN` **before** `pnpm build`
  in the build stage so Vite bakes it into the static bundle.
- **Coolify:** set `VITE_SENTRY_DSN` as a **build variable** for the web resource. (Note in
  the runbook that changing it requires a rebuild, not just a restart.)
- **`apps/web/.env`** (or a commented example): document `VITE_SENTRY_DSN=` as optional.
- **PWA check:** Sentry ingest is cross-origin to sentry.io, so Workbox's
  `navigateFallbackDenylist`/runtime-caching rules in
  [`apps/web/vite.config.ts`](../apps/web/vite.config.ts) don't intercept it — no change
  needed, just verify no SW caching of Sentry requests.

---

## Part D — Runbook update

Update [`monitoring-runbook.md`](monitoring-runbook.md):
- Fill the UptimeRobot spec + placeholders (Part A), and reword the Coolify-notifications
  bullet from "enable …" to "**already enabled** for Deployment failure, Backup failure,
  Scheduled Task failure, Docker Cleanup failure, Server Disk Usage, Server Unreachable,
  Server Patching" — plus the inside-out vs outside-in split note.
- Move "Sentry error tracking" out of **"Next (deferred)"** into an **implemented**
  subsection describing: the two projects (api + web), where DSNs live (Coolify runtime env
  `SENTRY_DSN` for api; Coolify build var `VITE_SENTRY_DSN` for web), the no-op-without-DSN
  behavior, and how to test (throw a test error).

---

## Critical files

| File | Change |
|------|--------|
| `apps/api/src/instrument.ts` | **new** — `Sentry.init` (DSN-gated) |
| `apps/api/src/server.ts` | first import `./instrument.js` |
| `apps/api/src/app.ts` | `Sentry.captureException` in existing `setErrorHandler` 5xx path |
| `apps/api/.env.example` | document `SENTRY_DSN` |
| `apps/web/src/main.tsx` | `Sentry.init` (VITE_SENTRY_DSN, no-op if empty) |
| `apps/web/src/routes/__root.tsx` | add `errorComponent` → capture + fallback UI |
| `apps/web/Dockerfile` | `ARG`/`ENV VITE_SENTRY_DSN` before `pnpm build` |
| `apps/web/.env` | document `VITE_SENTRY_DSN` |
| `docker-compose.yml` | `SENTRY_DSN: ${SENTRY_DSN:-}` on `api` service |
| `docs/monitoring-runbook.md` | UptimeRobot spec + Sentry moved to implemented |

Reused patterns: optional-env `${VAR:-}` (docker-compose `ANTHROPIC_API_KEY`);
`import.meta.env`/`VITE_` (`apps/web/src/lib/env.ts`); existing `setErrorHandler`
(`apps/api/src/app.ts:17`).

---

## Verification

**Backend (local):**
1. `pnpm --filter api add @sentry/node`, implement, then `pnpm --filter api build` + `turbo run check-types` — clean.
2. With **no** `SENTRY_DSN`: `pnpm --filter api dev`, confirm server boots and Sentry init is skipped (no errors) — proves the no-op path.
3. With a real `SENTRY_DSN` in `apps/api/.env`: temporarily add a throwaway route that throws, hit it, confirm the event lands in the sentry.io api project, then remove the route. (Or a Vitest that asserts `captureException` is called on a 5xx.)

**Frontend (local):**
1. `pnpm --filter web add @sentry/react`, implement, then `pnpm --filter web build` — clean.
2. With `VITE_SENTRY_DSN` set: `pnpm --filter web dev`, temporarily throw inside a route component, confirm the fallback `errorComponent` renders and the event appears in the sentry.io web project; remove the throw.
3. With DSN empty: confirm app runs normally, no console/network errors from Sentry.

**Deploy (Coolify):**
1. User creates two sentry.io projects, sets `SENTRY_DSN` (api runtime env) and `VITE_SENTRY_DSN` (web build var), redeploys.
2. Confirm both services healthy; optionally trigger one test error each to confirm prod events + environment tag.

**UptimeRobot:** user creates the 3 monitors (+ optional keyword) per the runbook, then confirms an intentional down state (or the keyword check) fires the email alert; record dashboard URL in the runbook.
