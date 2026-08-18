# Monitoring & Troubleshooting Runbook

How to tell whether the Sunshine Dental stack is healthy, and what to do when the
chat receptionist stops booking or stops answering.

## Architecture

```
Patient browser  (sunshine.appointer.hu/chat)
        │  HTTPS
        ▼
Fastify API  (sunshine.appointer.hu/api/chat/…)   ── health: GET /api/health (public)
        │  ├── Anthropic API (Claude Haiku 4.5)  — the receptionist itself
        │  ├── Prisma → Postgres (in-stack)      — calendar, patients, transcripts
        │  └── n8n webhook (fire-and-forget)     — confirmation e-mail only
        ▼
Postgres (in-stack, `db:5432`)
```

The booking path is **entirely in-process**: the chat tools call the same services the
dashboard does. n8n is downstream of a completed booking and only sends mail, so an n8n
outage costs confirmation e-mails, not bookings.

Deployment: Hetzner VPS via **Coolify** (Docker Compose). `sunshine.appointer.hu` →
Traefik → nginx (web SPA) → `/api` reverse-proxied to the `api` container on `:3000`.

## Health endpoints

| Endpoint | Auth | Purpose |
|---|---|---|
| `GET https://sunshine.appointer.hu/api/health` | public | API **and** DB (`SELECT 1`). `200 {"status":"ok","db":"ok"}` healthy; `503 {"db":"down"}` = DB issue. |
| `GET localhost:3000/ping` (internal) | public | Container liveness only, used by the Docker healthcheck. Not exposed externally. |
| `GET https://n8nprod.appointer.hu/healthz` | public | n8n liveness. |

## One-shot health sweep (copy/paste)

```bash
curl -s -o /dev/null -w "web    %{http_code}\n" https://sunshine.appointer.hu
curl -s -o /dev/null -w "api    %{http_code}\n" https://sunshine.appointer.hu/api/health
curl -s -o /dev/null -w "n8n    %{http_code}\n" https://n8nprod.appointer.hu/healthz
# Auth check: 401 = API up but key rejected; 200 = key OK; timeout/000 = API or DB down
curl -s -o /dev/null -w "slots  %{http_code}\n" \
  "https://sunshine.appointer.hu/api/calendar/slots?date=2026-07-03&appointment_type=CHECKUP" \
  -H "Authorization: Bearer $FASTIFY_API_KEY"
```

Expected when healthy: `web 200`, `api 200`, `n8n 200`, `slots 200` (with the real key).
`slots 401` with a real key ⇒ the key is wrong/rotated. `slots 400` ⇒ key is fine, just missing query params.

## Decision tree — "the chat isn't working"

Start by naming the symptom precisely; the three failure modes have different causes.

**A. Chat won't reply at all** (patient sends a message, nothing comes back)

1. `GET /api/health` → `200` ⇒ API + DB fine, suspect Anthropic. `503 {"db":"down"}` ⇒
   database. No response ⇒ api container down → **Coolify → api → Logs**.
2. **Anthropic**: check the api logs for `401` (bad/rotated `ANTHROPIC_API_KEY`), `429`
   (rate limit / spend cap), or `5xx` from the provider. Check
   [status.anthropic.com](https://status.anthropic.com). A missing `ANTHROPIC_API_KEY`
   disables the receptionist entirely — the endpoint is up but has no model behind it.
3. **Sentry** (`sunshine-dental-api`) for an exception on the chat route.

**B. Chat replies but won't book** (says it can't find slots, or offers a callback instead)

1. Is the keyring **locked**? `GET /api/health` returns **200 even when locked** — check the
   body for `"encryption":"locked"`. Booking writes patient PII, so it fails while locked.
   Unlock via `POST /api/admin/unlock`.
2. Are there actually free slots? `GET /api/calendar/slots?date=…&appointment_type=…` with
   the API key. Empty availability (no provider availability seeded, everything booked, or a
   date outside the search window) reads to a patient as "the system is broken".
3. A *business* `404` — patient names a provider who doesn't exist — is correct behaviour,
   not an outage. The assistant should offer another doctor.

**C. Bookings succeed but no confirmation e-mail**

This is the n8n path and never blocks a booking. Check, in order:
1. `N8N_BOOKING_WEBHOOK_URL` is set on the api service and points at the **Production**
   webhook URL — not `…/webhook-test/…`, which only responds while the n8n editor is listening.
2. The workflow is **Active** on `n8nprod.appointer.hu`, and its **Executions** show the booking.
3. The Gmail credential — `Gmail account 2` is a Testing-mode OAuth app whose token expires
   roughly **weekly**. This is the single most common cause. Re-auth it in n8n.

## Common root causes (this stack)

- **`Gmail account 2` token expired** (~weekly) → bookings fine, no confirmation e-mails.
- **Keyring left locked after a restart/deploy** → chat can answer questions but not book.
- **`ANTHROPIC_API_KEY` missing, rotated, or over its spend cap** → no receptionist at all.
- **`N8N_BOOKING_WEBHOOK_URL` unset or pointing at a test webhook** → silent e-mail loss.
- **No provider availability seeded for the clinic** → the assistant truthfully reports no
  slots, which the clinic reports as "the chat is broken".

## Historical incident — 2026-07-02, "backend unreachable" (was NOT an outage)

> **Kept as a lesson, not a live procedure.** The voice agent and the n8n router workflow
> described below were retired on 2026-08-18 and no longer exist. The transferable point is
> the last line: a *business* 4xx mis-classified as a system error looks exactly like an
> outage to the person on the other end.


A production test call reported the backend unreachable. Root cause traced via Retell call log
→ n8nprod execution #9 (`kJ4QDaoEWRjdjkhj`): the caller asked for **"Dr. Kiss"** (not a real
provider — clinic has Dr. Ibolya Nagy and Dr. István). `GET /api/calendar/slots?provider_name=Dr. Kiss`
correctly returned `404 {"error":"Provider not found"}`. The router's `Get Available Slots` node
(`onError: continueErrorOutput`) routed that 404 to `Format API Error`, which **blanket-returned
`SYSTEM_ERROR` ("scheduling system temporarily unavailable")** — designed for 5xx/timeouts — and the
agent verbalized it as "backend unreachable."

**Fix applied** (both prod `kJ4QDaoEWRjdjkhj` and dev `rQ7I7vX2oAYnNIbR`): `Format API Error` now
inspects `$input.first().json.error.status`/`.message` and returns:
- `PROVIDER_NOT_AVAILABLE` for a `404 Provider not found` (agent offers another/any doctor),
- `REQUEST_NOT_COMPLETED` for other `4xx`,
- `SYSTEM_ERROR` only for `5xx`/timeout/connection errors (genuine outage).

Verified: `POST /webhook/retell-custom-functions` with `provider_name:"Dr. Kiss"` → `PROVIDER_NOT_AVAILABLE`;
with no provider → real slots. **Takeaway:** a voice agent saying "backend unreachable" is often a
*business* 4xx mis-handled by the workflow, not an infra outage — always read the n8n execution first.

## External monitoring & alerts

- **Uptime monitor — UptimeRobot** (implemented), 5-min interval, email alerts to
  `hajzerbela@gmail.com` (add Slack/Telegram later to match the deferred escalation). Three
  HTTP(s) monitors:
  - **Web SPA** — `https://sunshine.appointer.hu` — expect **200**.
  - **API + DB** — `https://sunshine.appointer.hu/api/health` — expect **200**.
    - **Keyword sub-check (recommended):** a second monitor on the same URL requiring the
      keyword `"encryption":"unlocked"`. Rationale: `/api/health` returns **200 even when the
      keyring is locked** (see [`../apps/api/src/routes/health.routes.ts`](../apps/api/src/routes/health.routes.ts)),
      so a plain up/down check can't detect a post-restart **locked** state where patient PII
      can't be decrypted. The keyword monitor alerts on that. Unlock via
      `POST /api/admin/unlock`.
  - **n8n liveness** — `https://n8nprod.appointer.hu/healthz` — expect **200**.
  - **Created 2026-07-22** — all three monitors are live.
  - _(record the monitor dashboard URL here: __________ )_
- **Why UptimeRobot on top of Coolify:** Coolify's notifications are *inside-out* (the VPS's
  own view). UptimeRobot is the *outside-in* view Coolify can't give — DNS resolution, TLS-cert
  expiry, Traefik/nginx edge routing actually serving 200, and **response-body correctness**
  (the `encryption:unlocked` keyword). Keep both.
- **Coolify → Settings → Notifications**: email is **already enabled** for **Deployment
  failure, Backup failure, Scheduled Task failure, Docker Cleanup failure, Server Disk Usage,
  Server Unreachable, and Server Patching**. (Optional: add Discord/Slack/Telegram later.)
- **Backup dead-man's switch** (healthchecks.io): the nightly job pings `HEALTHCHECK_URL`
  **only on success**, so a *missed* run alerts, not just a failed one. Red ⇒ triage per
  [`disaster-recovery.md`](disaster-recovery.md#triage): Coolify → Scheduled Task → logs;
  check `BACKUP_DATABASE_URL` (must be the **direct, non-pooled** URL — `pg_dump` is
  unreliable through a pooler) and the `postgresql-client` major version vs the server.
  _(record the check URL here once created: __________ )_

### n8n execution-failure email alert (implemented)

Workflow **`Error Handler — Email Alert`** (`0tdA3t7At1mY7MTh`, n8nprod): Error Trigger → Gmail
(`Send Alert Email`, cred `SSHDHAefkBUth5jw`) → emails **hajzerbela@gmail.com** with the failed
workflow name, execution id/URL, last node, and error message. It is wired as the **Error Workflow**
in the settings of the prod workflows. Since the voice workflows were retired, the only
workflow it still guards is the **chat booking confirmation** — re-check that the Error
Workflow is still set on it after any re-import.

- **Gotchas:**
  - The error-handler workflow **must stay ACTIVE** on this instance — if inactive it does NOT fire
    (verified). Do not deactivate it.
  - It fires only on *genuine* execution failures. Business 4xx handled via `continueErrorOutput`
    (e.g. provider-not-found) do **not** fail the workflow, so they won't alert — by design.
  - Shares the Gmail OAuth credential with the confirmation-email node; that OAuth app is in
    "Testing" and the token can expire ~weekly. If alerts (or confirmation emails) stop, re-auth the
    Gmail credential in n8n. Note the failure mode: when the token dies, the thing that would
    tell you it died is broken too — so treat "suspiciously quiet" as a prompt to check.
- Verified 2026-07-02 with a throwaway failing workflow → handler executed (mode `error`, success),
  email sent; test workflow deleted.

### Sentry error tracking (implemented)

Error capture in **both** the API and the web SPA. Both are **no-ops without a DSN**, so
local dev and any un-configured environment are unaffected.

**Projects (sentry.io, EU region — `ingest.de.sentry.io`, org `o4507850050109440`):**
`sunshine-dental-api` and `sunshine-dental-web`. Created 2026-07-22; both verified end-to-end
with a delivered smoke-test event. EU-region ingest keeps error data in the EU alongside the
clinic's other data. **DSNs are not stored in the repo** — they live in Coolify (and in the
gitignored local `.env` files for dev).

**Privacy — patient PII (GDPR):** both SDKs set **`sendDefaultPii: false` explicitly**, so
request bodies, headers, cookies and IP addresses are never attached to events. This is set
deliberately rather than relying on the SDK default, so a future SDK change can't silently
start shipping PII. Keep it that way; if you ever need more request context, add
**scrubbed** fields rather than flipping this flag.

- **API — `@sentry/node`.** Init lives in [`../apps/api/src/instrument.ts`](../apps/api/src/instrument.ts),
  imported as the **first** line of [`../apps/api/src/server.ts`](../apps/api/src/server.ts).
  5xx / unhandled exceptions are reported from the existing `setErrorHandler` in
  [`../apps/api/src/app.ts`](../apps/api/src/app.ts) — via `Sentry.captureException` on the
  genuine-error fallthrough only (validation 400s and coded HttpErrors like `ENCRYPTION_LOCKED`
  return earlier and are **not** reported). Errors-only, `tracesSampleRate: 0`.
  - **DSN:** runtime env `SENTRY_DSN` — set as a Coolify **Environment Variable** on the `api`
    resource (wired in `docker-compose.yml`). Empty = disabled.
- **Web — `@sentry/react`.** Init in [`../apps/web/src/main.tsx`](../apps/web/src/main.tsx)
  reading `import.meta.env.VITE_SENTRY_DSN`; a root `errorComponent` in
  [`../apps/web/src/routes/__root.tsx`](../apps/web/src/routes/__root.tsx) captures render/route
  errors and shows a translated fallback. `init` also auto-captures unhandled errors + promise
  rejections. Errors-only, `tracesSampleRate: 0`.
  - **DSN:** **build-time** `VITE_SENTRY_DSN` (baked into the static bundle) — set as a Coolify
    **BUILD variable** on the `web` resource, passed via `ARG VITE_SENTRY_DSN` in
    [`../apps/web/Dockerfile`](../apps/web/Dockerfile). A browser DSN is public/non-secret.
    **Changing it requires a rebuild, not just a restart.** Empty = disabled.
- **Test:** temporarily throw in an API route (→ event in the api project) or a web component
  (→ fallback UI renders + event in the web project); remove the throw afterwards.

## Next (deferred, not yet implemented)

- Structured request logging (Pino) with retained logs / log shipping.
- Escalate n8n + Sentry alerts to Slack/Telegram (currently email-only).
