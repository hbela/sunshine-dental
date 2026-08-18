# Split n8n into dev + prod; point production at n8nprod → sunshine.appointer.hu

## Context

Today a single n8n instance (`n8ndev.appointer.hu`) serves **both** testing and
production for the Sunshine Dental voice agent. The app is now deployed on Hetzner/Coolify
at `sunshine.appointer.hu`, and a fresh **`n8nprod.appointer.hu`** instance has been created
in Coolify. The goal: make **`n8nprod` the production automation host** (the live Retell
agent talks to it), and demote **`n8ndev` to a pure testing instance** that drives a **local
API via ngrok** — so test calls never mutate production data.

Nothing in the app calls n8n (verified: no `N8N_*` env; `FASTIFY_API_KEY` is inbound only).
The flow is one-directional: **Retell → n8n → `sunshine.appointer.hu/api` → Postgres**, with
the API's response returning synchronously up the same chain. So "hook up with
sunshine.appointer.hu" means only: (a) n8nprod's HTTP nodes call the prod API (already true in
the dev copies), and (b) Retell's webhooks are repointed from n8ndev → n8nprod.

## Current state (source of truth = the LIVE dev workflows, not the repo `workflows/*.json`, which are placeholders)

Four Retell workflows on n8ndev (personal project `hWEjSxr6yCvjioyj`):

| Workflow | ID | Trigger / path | Calls | Credential |
|---|---|---|---|---|
| Retell Custom Function Router (v2) | `rQ7I7vX2oAYnNIbR` | webhook `retell-custom-functions` | 5 HTTP → `sunshine.appointer.hu/api/{calendar/slots, calendar/available-providers, appointments, appointments/cancel, patients}` + Bearer `FASTIFY_API_KEY`; 1 Gmail | Gmail "Gmail account 2" (`aWAJj5cZJRVKPWzK`) |
| Retell Post-Call Processing (v2) | `ekK0hiXY1JmcaFPX` | webhook `retell-post-call` | HTTP → `sunshine.appointer.hu/api/call-logs` + Bearer key; Gmail summary → `hajzerbela@gmail.com` | Gmail "Gmail account 2" (`aWAJj5cZJRVKPWzK`) |
| Retell - Dynamic Variables | `Ra6FzJOrxiOJFanf` | webhook `retell-dynamic-vars` | returns `current_date` (code only) | none |
| Retell - Update LLM Date Daily | `Tbq9RHDDjeT8WvVp` | **cron** `1 0 * * *` (no webhook) | Retell API GET+PATCH LLM `llm_9144fb5e…` (hardcoded Retell key) | none |

Retell → n8n references to repoint (agent `agent_0c73886e96f6cf2ad878def30e`, LLM `llm_9144fb5e818b3d841e18ab084b99`):
- **6 LLM custom-tool URLs** → `https://n8ndev.appointer.hu/webhook/retell-custom-functions`
- **Agent `webhook_url`** (post-call) → `https://n8ndev.appointer.hu/webhook/retell-post-call`
- Dynamic-vars: **not wired yet** (no phone number provisioned — `retell_list_phone_numbers` is empty). Wire it to `n8nprod` when a number is added.

Constraints:
- The **n8n MCP is bound to n8ndev** → n8nprod import/activation/credentials are **manual UI steps** (user). The Retell repoint + the dev-side ngrok revert are scriptable.
- **Credentials cannot be exported** with a workflow → the Gmail cred must be recreated on n8nprod. (Note: "Gmail account 2" is a Testing-mode OAuth app whose token expires ~weekly — see the n8n email architecture memory.)
- Two secrets ride inside the workflow JSON: `FASTIFY_API_KEY` (`93dfa…`) and the Retell key (`key_947d…`). Both were also exposed in chat.

## Target architecture

```
PROD:  Retell (live agent + phone number)  →  n8nprod.appointer.hu  →  https://sunshine.appointer.hu/api  →  VPS Postgres
TEST:  Retell test agent / dashboard sim   →  n8ndev.appointer.hu   →  ngrok → 127.0.0.1:3000 (local API)  →  local Postgres
```

## Migration steps

### A. Stand up the workflows on n8nprod (manual, n8n UI — chosen: export/import)
1. In **n8ndev** UI, open each of the 4 workflows → **⋯ menu → Download** (exports JSON). (These live exports are the source of truth; the repo JSONs are placeholders and are missing dynamic-vars + cron.)
2. In **n8nprod** UI → **Import from File** for each of the 4.
3. **Recreate the Gmail credential** on n8nprod: Credentials → New → *Gmail OAuth2* named "Gmail account 2". Then open **Send Confirmation Email** (Router) and **Email Manager Summary** (Post-Call) and select it. No other credentials are needed.
4. Sanity-check the HTTP nodes still target `https://sunshine.appointer.hu/api/...` with the `FASTIFY_API_KEY` bearer (imported copies inherit dev's values — which are already prod). No change expected.
5. **Activate** the 3 webhook workflows (Router, Post-Call, Dynamic Variables) so their `/webhook/...` (production) URLs go live.
6. **Cron placement (run-in-one-place):** keep **Update LLM Date Daily active on prod only**; **deactivate it on n8ndev** so the LLM prompt date isn't PATCHed twice/raced. (Dynamic-vars covers per-call date anyway.)
7. Confirm prod webhook is reachable: `curl -sS -X POST https://n8nprod.appointer.hu/webhook/retell-dynamic-vars` → should return `{ "current_date": "…" }`.

### B. Cut Retell over to n8nprod (scripted — chosen: repoint script)
New file **`workflows/scripts/retell-set-webhooks.mjs`** (mirrors `retell-set-voice.mjs` conventions: `createRequire('C:/devs/retell-mcp/')`, key from env → `../../.mcp.json`, idempotent, `--dry-run`, optional `--base <url>` defaulting to `https://n8nprod.appointer.hu`):
- `client.agent.retrieve` → if `webhook_url !== ${BASE}/webhook/retell-post-call`, `client.agent.update(AGENT_ID, { webhook_url })`.
- `client.llm.retrieve` → remap every `general_tools[]` entry of `type: 'custom'` to `url = ${BASE}/webhook/retell-custom-functions`, then `client.llm.update(LLM_ID, { general_tools })`. (The Retell MCP only exposes prompt updates, so tool-URL edits must go through the SDK — same technique as `retell-add-language.mjs`.)
- Print a diff; no-op when already in sync.
- Add `"retell:set-webhooks": "node workflows/scripts/retell-set-webhooks.mjs"` to root `package.json`.
- Run `--dry-run` first, then apply. **Re-publish the agent** in the Retell dashboard afterward (a published version pins its webhook/tool config; the edit only reaches live calls after re-publish).

### C. Revert n8ndev to the local test loop
- Point the dev **Router** HTTP nodes back at the ngrok tunnel with the existing tool: `pnpm n8n:patch-ngrok` (`workflows/patch-ngrok-url.mjs`, targets the dev instance via `.mcp.json`). Requires `ngrok http 127.0.0.1:3000` running.
- **Check the dev Post-Call** "Log Call to API" node too — if `patch-ngrok` only rewrites the Router, manually point that node at the ngrok base as well (else dev post-call still writes to prod `call-logs`).
- Leave the dev webhook workflows active for testing. To actually exercise them end-to-end, drive n8ndev from a **cloned Retell "test" agent** (webhooks → n8ndev) or the Retell dashboard simulation — the prod agent now points only at n8nprod.

### D. Docs + memory
- `workflows/CLAUDE.md`: add a "dev/prod n8n split" note (prod = n8nprod → sunshine.appointer.hu; dev = n8ndev → ngrok/local) and reframe the existing "Re-pointing the router at the current ngrok tunnel" / Testing sections as **testing-only**.
- `docs/archive/retell-golive.md`: Step 1 + the state table currently say all endpoints are `n8ndev.appointer.hu` and voice `openai-Chloe`; update host → `n8nprod.appointer.hu` and note the split (voice already corrected elsewhere).
- Update the Coolify VPS deployment memory with the prod host = `n8nprod.appointer.hu`.

## Files to change
- **New:** `workflows/scripts/retell-set-webhooks.mjs`
- **Edit:** `package.json` (add `retell:set-webhooks`)
- **Edit:** `workflows/CLAUDE.md`, `docs/archive/retell-golive.md`
- **No app/API code changes** — the app doesn't touch n8n.

## Verification (end-to-end)
1. `curl -X POST https://n8nprod.appointer.hu/webhook/retell-dynamic-vars` → `{ current_date }` (prod n8n live).
2. `node workflows/scripts/retell-set-webhooks.mjs --dry-run` → shows agent + 6 tool URLs flipping n8ndev → n8nprod; then apply and confirm the follow-up read shows n8nprod everywhere.
3. Re-publish the agent; place a **Retell test call** (or dashboard sim): booking should hit `check_availability`/`book_appointment` and create an appointment visible in the **prod** web app; hang up → the **n8nprod** Post-Call execution logs to `/api/call-logs` and emails the summary.
4. Confirm the **n8nprod** execution log shows the calls (not n8ndev), and that a **local** test via n8ndev + ngrok writes to the **local** DB only.

## Optional hardening (recommended while touching this)
- **Rotate the exposed secrets:** new `FASTIFY_API_KEY` in Coolify API env **and** in the n8nprod Router + Post-Call bearer headers (keep them matched); new Retell API key in the cron node. Do prod first, then dev.
- Add a shared-secret header (e.g. `X-Retell-Secret`) on the Retell custom tools and verify it in the n8nprod webhook nodes (the Retell→n8n hop is currently unauthenticated — see `docs/archive/retell-golive.md` §Optional hardening).

## Open considerations
- A dedicated **test Retell agent** (clone of Dental Clinic, webhooks → n8ndev) is the clean way to keep exercising the dev loop once the prod agent is pinned to n8nprod; otherwise use the dashboard simulation.
- The Gmail "Gmail account 2" OAuth app is in **Testing** mode → its token expires ~weekly; the new n8nprod credential will need periodic re-consent unless the OAuth app is moved to Production.
