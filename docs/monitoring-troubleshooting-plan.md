# Diagnose "backend unreachable" + add lightweight monitoring & a troubleshooting runbook

## Context

While testing the new **ElevenLabs "sunshinev3 / form II"** voice agent in production, the agent reported that *"the backend is unreachable."* This raised two questions: (1) what's actually broken, and (2) how do we monitor the app and troubleshoot when it happens again.

**Live checks run during triage show the backend is healthy — nothing is actually down:**

| Target | Result | Meaning |
|---|---|---|
| `https://sunshine.appointer.hu` | `200` | Web (nginx SPA) up |
| `https://sunshine.appointer.hu/api/calendar/slots` (GET) | `401 {"error":"Unauthorized","code":"UNAUTHORIZED"}` | Fastify API up; route works, correctly rejecting unauthenticated calls |
| `https://n8nprod.appointer.hu/healthz` | `200 {"status":"ok"}` | n8n up |
| `https://n8nprod.appointer.hu/webhook/retell-dynamic-vars` (GET) | `404 "not registered for GET… use POST"` | Webhook is registered / workflow reachable |
| `https://sunshine.appointer.hu/api/health` and `/api/ping` | `404` | **No externally reachable health endpoint exists** (only internal `GET /ping` on `localhost:3000`, used by the Docker healthcheck) |

**Architecture (confirmed):** Voice agent → `n8nprod.appointer.hu/webhook/…` → Fastify API (`sunshine.appointer.hu/api/…`, Node 22 + Fastify 5, behind nginx) → Prisma/Postgres. The ElevenLabs agent is wired **via the n8n webhook** (same path pattern as the existing Retell agent). The ElevenLabs agent config lives only in the ElevenLabs dashboard — it is **not in the repo**.

**Conclusion:** "Backend unreachable" is almost certainly the **ElevenLabs server-tool call failing at the ElevenLabs→n8n or n8n→Fastify hop**, not a downed server. The likely culprits are a wrong/test webhook URL, an inactive workflow, a `FASTIFY_API_KEY` Bearer mismatch (→ 401), or a tool timeout — none of which we can currently *see*, because there is **no error tracking, no external uptime monitoring, and no external health endpoint**. This plan fixes the immediate issue, adds lightweight monitoring so the next outage is visible, and captures a reusable runbook.

---

## Part A — Diagnose & fix the ElevenLabs "backend unreachable"

Work top-down from the agent; stop at the first layer that fails.

1. **ElevenLabs conversation log (fastest, do this first).** In the ElevenLabs dashboard, open the failed test conversation → tool-call detail. Record the exact **request URL, HTTP method, headers, request body** and the **HTTP status + response body + latency** the tool received. This alone usually pinpoints the layer. Check specifically:
   - URL is the **production** webhook `https://n8nprod.appointer.hu/webhook/<path>` — **not** `…/webhook-test/…` (n8n test URLs only respond while the editor is "listening") and not `n8ndev`.
   - The `<path>` matches a webhook that actually exists (see step 2).
   - The ElevenLabs tool **timeout** is long enough (the `slots` lookup does a DB roundtrip; if the tool times out at e.g. 5s it will report "unreachable" on a slow response).
2. **n8n layer.** Confirm the target workflow is **Active** and inspect **Executions** for the incoming call:
   - Read-only via n8n MCP: `n8n_list_workflows`, `n8n_get_workflow`, `n8n_executions` (workflows referenced in the repo: router `rQ7I7vX2oAYnNIbR`, post-call `ekK0hiXY1JmcaFPX` — but confirm the ElevenLabs agent isn't pointing at a *new* webhook that was never created/activated).
   - If there is **no execution** for the test call → ElevenLabs is hitting the wrong URL / an inactive/test webhook (fix in ElevenLabs or activate the workflow).
   - If the execution **errored on the HTTP node** → read the failed node's response (a `401` here = `FASTIFY_API_KEY` mismatch; a timeout/`5xx` = API/DB issue).
3. **Fastify → env layer.** If n8n's HTTP node got `401`, the `Authorization: Bearer <key>` sent by n8n does not match `FASTIFY_API_KEY` in Coolify. Verify the Coolify env secret matches the Bearer value stored in the n8n HTTP nodes' credentials. (Reproduce the 401 with the curl in the runbook.)
4. **Confirm the fix** by re-running a test conversation and watching a fresh successful n8n execution + a `200` from the API node.

No repo code change is required for Part A — the fix is configuration (ElevenLabs tool URL/timeout, n8n workflow active state, or the Coolify `FASTIFY_API_KEY` secret). Part B adds the tooling that would have made this diagnosis instant.

---

## Part B — Lightweight monitoring (make the next outage visible)

### B1. Add a public health endpoint to the API
Today the only health check is the internal `GET /ping` (registered at root in `apps/api/src/app.ts`, reachable only as `localhost:3000/ping` for the Docker healthcheck). Add a **public, unauthenticated** endpoint that also verifies the DB, reachable from the internet through nginx.

- **File:** add a small route in `apps/api/src/app.ts` next to `/ping`, or a new `apps/api/src/routes/health.routes.ts` registered with the `/api` prefix.
- **Path:** `GET /api/health` (must be under `/api` so nginx `proxy_pass` forwards it externally; `/ping` at root is not externally reachable).
- **Must be public:** register it **without** the `requireAuthOrApiKey` preHandler (mirror how `/ping` is public), so an uptime monitor can hit it without a key.
- **Body:** do a cheap DB probe using the existing Prisma client (`prisma.$queryRaw\`SELECT 1\``) and return `{ status: "ok", db: "ok", time: <iso> }`; return `503` with `{ status: "error", db: "down" }` if the DB probe throws. This distinguishes "API up but DB down" from a total outage.
- Keep the internal `/ping` as-is for the Docker healthcheck.

### B2. External uptime monitoring + alerts
Set up a free external monitor (UptimeRobot or Better Stack) with **email + Slack/Telegram** alerts on:
- `https://sunshine.appointer.hu` (web, expect `200`)
- `https://sunshine.appointer.hu/api/health` (API + DB, expect `200`) — the new endpoint from B1
- `https://n8nprod.appointer.hu/healthz` (n8n, expect `200`)

1–5 min interval. This is the piece that would have alerted you before a caller did. (External config, no repo change.)

### B3. Coolify notifications
Enable Coolify's built-in notifications (Settings → Notifications: email/Discord/Slack/Telegram) for **deployment failures** and **container-healthcheck failures**, so a crashed API container or failed deploy pages you automatically.

### B4. Durable runbook doc
Create `docs/monitoring-runbook.md` capturing Part C below plus the uptime-monitor URLs and where to click in ElevenLabs/n8n/Coolify — so this knowledge isn't trapped in a chat.

*(Deferred to a later pass, per decision: Sentry error tracking in Fastify, Pino structured request logging, and n8n execution-failure alerts. Noted in the runbook as "next.")*

---

## Part C — Troubleshooting runbook (content for `docs/monitoring-runbook.md`)

**One-shot health sweep (copy/paste):**
```bash
curl -s -o /dev/null -w "web   %{http_code}\n" https://sunshine.appointer.hu
curl -s -w "  api   %{http_code}\n" https://sunshine.appointer.hu/api/health
curl -s -o /dev/null -w "n8n   %{http_code}\n" https://n8nprod.appointer.hu/healthz
# Auth check: 401 = API up but key rejected; 200 = key OK; timeout = API/DB down
curl -s -w "\nslots %{http_code}\n" https://sunshine.appointer.hu/api/calendar/slots \
  -H "Authorization: Bearer $FASTIFY_API_KEY"
```

**Decision tree for "voice agent says backend unreachable":**
1. **ElevenLabs conversation log** → what URL/status did the tool actually get? (wrong URL / timeout / non-2xx)
2. **n8n Executions** → did the call arrive? errored node? (no execution = wrong/inactive webhook; `401` on HTTP node = key mismatch)
3. **API `/api/health`** → `200` = API+DB fine (problem is above); `503`/`db:down` = DB issue; no response = API container down → **Coolify → API service → Logs** (Fastify stdout).
4. **Coolify** → container running/healthy? recent deploy failed? env `FASTIFY_API_KEY` present and matching n8n's Bearer?

**Common root causes (this stack):**
- ElevenLabs tool uses `…/webhook-test/…` or a stale/dev URL, or the n8n workflow is not **Active** → no execution.
- `FASTIFY_API_KEY` in Coolify ≠ Bearer token in n8n HTTP nodes → `401`, agent reads as "unreachable."
- ElevenLabs tool timeout < n8n→Fastify→DB roundtrip → tool aborts.
- n8n response JSON shape ≠ what the ElevenLabs tool expects → tool treats it as a failure.

---

## Critical files
- `apps/api/src/app.ts` — add public `GET /api/health` beside the existing `/ping` (or new `apps/api/src/routes/health.routes.ts` under the `/api` prefix). Reuse the existing Prisma client and mirror `/ping`'s public (no `requireAuthOrApiKey`) registration; see `apps/api/src/middleware/auth.middleware.ts`.
- `docs/monitoring-runbook.md` — **new**, Parts C + the monitor/alert setup.
- External (no repo change): ElevenLabs agent tool config, n8n workflow active-state/URL, UptimeRobot/Better Stack monitors, Coolify notification settings.

## Verification
1. **Part A:** run a fresh ElevenLabs test conversation; confirm a matching **successful** n8n execution and a `200` from the API HTTP node; the agent completes an availability lookup without "unreachable."
2. **B1:** after deploy, `curl https://sunshine.appointer.hu/api/health` returns `200 {"status":"ok","db":"ok",...}`; temporarily point it at a bad DB (or simulate) to confirm it returns `503` (optional).
3. **B2:** trigger a monitor test (or pause the API container briefly in a maintenance window) and confirm the email/Slack alert fires.
4. **B3:** confirm a Coolify test notification is received.
5. **Runbook:** run the one-shot health-sweep block and confirm all three lines report `200` (and `slots` reports `200` with the real key).
