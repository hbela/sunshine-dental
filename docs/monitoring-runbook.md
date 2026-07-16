# Monitoring & Troubleshooting Runbook

How to tell whether the Sunshine Dental stack is healthy, and what to do when the
voice agent (Retell or ElevenLabs) reports that **"the backend is unreachable."**

## Architecture

```
Voice agent (Retell / ElevenLabs)
        │  server tool → HTTPS POST
        ▼
n8n  (n8nprod.appointer.hu/webhook/<path>)   ── health: GET /healthz → {"status":"ok"}
        │  HTTP node, Authorization: Bearer <FASTIFY_API_KEY>
        ▼
Fastify API  (sunshine.appointer.hu/api/…)   ── health: GET /api/health (public)
        │  Prisma
        ▼
Postgres (Prisma.io, pooled)
```

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

## Decision tree — "voice agent says backend unreachable"

1. **Voice-platform conversation log first (fastest).** Retell or ElevenLabs dashboard →
   the failed conversation → tool-call detail. Read the exact **request URL, method,
   headers, body** and the **HTTP status + response body + latency** the tool received.
   - Confirm the URL is the **production** webhook `https://n8nprod.appointer.hu/webhook/<path>`
     — **not** `…/webhook-test/…` (n8n test URLs only respond while the editor is "listening"),
     and not `n8ndev.appointer.hu`.
   - Confirm the tool **timeout** is generous enough (the `slots` lookup does a DB roundtrip).
     A short timeout surfaces as "unreachable" on a slow response.
2. **n8n layer.** Workflow **Active**? Open **Executions** for the incoming call.
   - No execution for the call ⇒ voice agent is hitting the wrong URL / an inactive or
     test webhook. Fix the tool URL, or activate the workflow.
   - Execution errored on the HTTP node ⇒ read the node's response:
     `401` here = `FASTIFY_API_KEY` mismatch; timeout / `5xx` = API or DB problem.
3. **API layer.** `GET /api/health`:
   - `200` ⇒ API + DB fine, so the problem is above this layer (n8n or the voice tool).
   - `503 {"db":"down"}` ⇒ database issue (Prisma.io down / connection limit / bad `DATABASE_URL`).
   - No response / timeout ⇒ API container down → **Coolify → api service → Logs** (Fastify stdout).
4. **Coolify / infra.** api container running & healthy? A recent deploy failed?
   Is env `FASTIFY_API_KEY` present and equal to the Bearer token stored in the n8n HTTP nodes?

## Common root causes (this stack)

- **A caller names a doctor/patient/appointment that doesn't exist** → the API returns a *business* `404` (e.g. `{"error":"Provider not found"}`), which the router's HTTP-node error output must classify — NOT treat as an outage. See the confirmed incident below.
- Voice tool points at `…/webhook-test/…`, a stale/`n8ndev` URL, or the n8n workflow is not **Active** → no execution.
- `FASTIFY_API_KEY` in Coolify ≠ Bearer token in the n8n HTTP nodes → `401`, which the agent reports as "unreachable."
- Voice tool timeout shorter than the n8n → Fastify → DB roundtrip → tool aborts.
- n8n response JSON shape ≠ what the voice tool expects → tool treats a `200` as a failure.

## Confirmed incident — 2026-07-02, "backend unreachable" (was NOT an outage)

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

- **Uptime monitor** (UptimeRobot / Better Stack), 1–5 min interval, email + Slack/Telegram alerts on:
  - `https://sunshine.appointer.hu` (expect 200)
  - `https://sunshine.appointer.hu/api/health` (expect 200)
  - `https://n8nprod.appointer.hu/healthz` (expect 200)
  - _(record the monitor dashboard URL here once created: __________ )_
- **Coolify → Settings → Notifications**: enable email/Discord/Slack/Telegram for **deployment
  failures** and **container-healthcheck failures**.
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
in the settings of the prod workflows: router `kJ4QDaoEWRjdjkhj`, post-call `FBfZ65vr9r6MmTQc`,
dynamic-vars `jUh6a3wia5turKAw`, daily-date `BxgJLziofW7fEME1`.

- **Gotchas:**
  - The error-handler workflow **must stay ACTIVE** on this instance — if inactive it does NOT fire
    (verified). Do not deactivate it.
  - It fires only on *genuine* execution failures. Business 4xx handled via `continueErrorOutput`
    (e.g. provider-not-found) do **not** fail the workflow, so they won't alert — by design.
  - Shares the Gmail OAuth credential with the confirmation-email node; that OAuth app is in
    "Testing" and the token can expire ~weekly. If alerts (or confirmation emails) stop, re-auth the
    Gmail credential in n8n.
- Verified 2026-07-02 with a throwaway failing workflow → handler executed (mode `error`, success),
  email sent; test workflow deleted.

## Next (deferred, not yet implemented)

- Sentry error tracking in the Fastify API (capture 5xx + unhandled exceptions).
- Structured request logging (Pino) with retained logs / log shipping.
- Escalate n8n alerts to Slack/Telegram (currently email-only).
