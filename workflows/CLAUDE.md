# workflows/

This directory contains n8n workflow JSON files for the **Sunshine Dental** voice agent integration with [Retell AI](https://www.retellai.com/).

## Environments (dev / prod split)

Two separate n8n instances since the Coolify deployment:

| | Host | API it calls | Purpose |
|---|---|---|---|
| **Prod** | `n8nprod.appointer.hu` | `https://sunshine.appointer.hu/api` (VPS) | The **live** Retell agent's webhooks point here. |
| **Test** | `n8ndev.appointer.hu` | local Fastify via **ngrok** (`127.0.0.1:3000`) | Dev/testing loop — never touches prod data. |

The live agent (`agent_0c73886e96f6cf2ad878def30e`) is repointed prod↔test with
`pnpm retell:set-webhooks` (patches `webhook_url` + the 6 custom-tool URLs; `--dry-run` to
preview, `--base <url>` to override). **Re-publish the agent** in the Retell dashboard after
repointing — published versions pin webhook/tool config.

Four Retell workflows run on the prod instance: the **Router** (`retell-custom-functions`),
**Post-Call** (`retell-post-call`), **Dynamic Variables** (`retell-dynamic-vars`), and the
**Update LLM Date Daily** cron. The cron should be **active on prod only** (deactivate the dev
copy) so the LLM date isn't PATCHed twice. See `docs/n8n-dev-prod-split-plan.md`.

> The `.json` files here are **placeholder templates** (base URL = `YOUR-API-BASE-URL`). The
> source of truth is the live workflows in each n8n instance — export/import between instances
> rather than editing these files.

## Multiple clinics on one n8n instance

Each customer clinic gets its **own copy** of the three workflows on the shared
prod instance, with clinic-scoped webhook paths (`/webhook/<clinic>-custom-functions`,
`/webhook/<clinic>-post-call`, `/webhook/<clinic>-chat-booking-confirmation`) and
that clinic's `FASTIFY_API_KEY` on the HTTP nodes. Full procedure:
[`docs/onboarding-new-clinic.md`](../docs/onboarding-new-clinic.md).

The one workflow edit a new copy needs beyond URLs and keys: the **FAQ Handler**
node should call `GET <api-base>/api/faq?topic=…&language=…` instead of carrying a
hardcoded answer dictionary. Clinic facts now live in
[`packages/shared/src/clinics/<id>.ts`](../packages/shared/src/clinic.ts) and are
served by the API, so the voice agent and the text chat can never drift apart.

## Agent voice & model (cost choice)

The prod agent (`agent_0c73886e96f6cf2ad878def30e`, LLM `llm_9144fb5e818b3d841e18ab084b99`) runs:

- **Voice: `cartesia-Chloe`** — a predefined Cartesia voice, billed inside Retell's standard per-minute bundle (no external ElevenLabs account/bill). In use since agent v2 (verified against the live agent 2026-07-10).
  - **Fallback: `fallback_voice_ids: ["openai-Chloe"]`** — keeps the previous (cheap, multilingual) voice as a safety net if the primary TTS fails mid-call.
  - *History:* started on `11labs-Marissa` → 3-way A/B audition (`pnpm retell:audition`) picked `openai-Chloe` (~$0.015/min, saved ~$100/mo) → briefly an ElevenLabs BYOK custom clone "sunshine" (`custom_voice_…`, ~$0.08/min, agent v0–v1 only; imported via Retell settings → *Import Professional Voices*) → **`cartesia-Chloe`** (current).
- **Model: `gpt-4.1`** (the live LLM; earlier notes said `gpt-4.1-mini`) — a multilingual, tool-calling booking agent needs the reliability (nano/mini were too weak for consistent function-calling). Post-call analysis runs on `gpt-4.1-mini`.
- All-in per minute = Retell bundle (Cartesia voice + telephony) + GPT-4.1 LLM — cheaper than the old ElevenLabs-clone setup (~$0.10/min); check the Retell dashboard for the current exact rate.

Change the voice idempotently with `pnpm retell:set-voice` (script: `workflows/scripts/retell-set-voice.mjs`) — it patches `voice_id` + `fallback_voice_ids` via the Retell SDK (`--dry-run` to preview). Re-run the engine A/B anytime with `pnpm retell:audition` (`workflows/scripts/retell-voice-audition.mjs`).

## Workflows

| File | Workflow Name | Purpose |
|------|--------------|---------|
| `retell-custom-function-router-v2.json` | Retell Custom Function Router (v2 - PostgreSQL) | Handles real-time custom function calls from Retell during a live call (slot availability, booking, cancellation, FAQ, patient capture) |
| `post-call-processing-v2.json` | Retell Post-Call Processing (v2 - PostgreSQL) | Runs after a call ends — logs the call to the API and emails a summary to the manager |
| `chat-booking-confirmation.json` | Chat Booking Confirmation Email | Webhook the **chat** API calls after an in-process booking, to email the patient a confirmation (the voice flow emails from its own router node instead). Localized EN/HU/DE; reuses the `Gmail account 2` credential. |

### Chat booking confirmation email (why this exists)

The patient **text chat** (`apps/api` → `chat.service.ts`) books appointments **in-process**, so it never hits the Retell router's `Send Confirmation Email` node — chat bookings would send no email. The `chat-booking-confirmation` workflow closes that gap: the API POSTs the booking to its webhook (`N8N_BOOKING_WEBHOOK_URL`) and it sends the same localized confirmation. Its HU copy uses the corrected chat glossary (`személyi igazolvány` / `TAJ kártya`, `Fogkőeltávolítás`, `Mélytisztítás`), so it's slightly ahead of the voice router's older HU wording.

**Setup after import:** select the `Gmail account 2` credential on the Gmail node → **activate** → copy the Production webhook URL into the API's `N8N_BOOKING_WEBHOOK_URL` env (Coolify) → redeploy. Webhook path: `/webhook/chat-booking-confirmation`.

## How to Import

1. Open the target n8n instance (prod `https://n8nprod.appointer.hu` or test `https://n8ndev.appointer.hu`)
2. Go to **Workflows → Import from file**
3. Select the JSON file and confirm
4. Re-select the Gmail credential (see below) and, for the test instance, repoint the HTTP nodes at ngrok, before activating

## Credentials Required

- **Gmail OAuth2** — the **only** n8n credential needed (both `Send Confirmation Email` and
  `Email Manager Summary` use `Gmail account 2`). It must be **recreated per instance** —
  credentials don't travel with an exported workflow. NB `Gmail account 2` is a Testing-mode
  OAuth app whose token expires ~weekly.
- **No PostgreSQL credential** — despite the "(v2 - PostgreSQL)" names, the webhooks reach the
  DB **over HTTP** through `…/api/...`, authenticated by the `FASTIFY_API_KEY` bearer header on
  the HTTP nodes (must match the API's env). There are no direct Postgres nodes.

Never hardcode credentials — reference them by name in the n8n UI.

## Conventions

- Node names are descriptive (e.g., "Book Appointment" not "Postgres")
- Dynamic values use n8n expressions (`={{ }}`)
- Each workflow includes a **Configuration Notes** sticky node with setup instructions
- Workflow settings use `executionOrder: "v1"`

## Re-pointing the router at the current ngrok tunnel (TEST instance / n8ndev only)

> Prod (`n8nprod`) calls `https://sunshine.appointer.hu/api` directly — no ngrok. This section
> applies **only** to the `n8ndev` testing instance driving a local API.

The router's 5 HTTP nodes (Get Available Slots, Book Appointment, Cancel Appointment, Create
Patient, Get Available Providers) call the local Fastify API through an **ngrok tunnel**, whose
URL changes every time ngrok restarts. When it goes stale, availability/booking calls return
empty and the agent silently falls back to a callback (books nothing).

Fix it in one command (reads the live URL from ngrok's local API and patches the live workflow):

```bash
pnpm n8n:patch-ngrok            # or: node workflows/patch-ngrok-url.mjs
pnpm n8n:patch-ngrok --dry-run  # preview changes without writing
```

- Reads `N8N_API_URL` / `N8N_API_KEY` from env, else from the gitignored `../.mcp.json`
  (`mcpServers["n8n-mcp"].env`). No secrets in the script.
- Requires ngrok running (`ngrok http 127.0.0.1:3000`); override detection with `NGROK_URL=...`.
- The Bearer API key in the nodes is unrelated to ngrok and is left untouched.

## Testing

- The router workflow is triggered via webhook from Retell — test with a real or simulated Retell call, or POST to the webhook URL manually
- The post-call workflow is also webhook-triggered — use a test POST with a sample Retell payload
- Check execution results in n8n after each test run before going live
- **Empty availability / unexpected callback during testing usually means a stale ngrok URL** — run `pnpm n8n:patch-ngrok` first, then re-test.

## Saving a call transcript

Export any Retell call to `docs/transcripts/<call_id>.md` (metadata + analysis summary + tool
calls + full transcript):

```bash
pnpm retell:save-transcript               # most recent call
pnpm retell:save-transcript --latest      # same
pnpm retell:save-transcript call_abc123…  # a specific call
pnpm retell:save-transcript --latest --agent agent_0c73886e96f6cf2ad878def30e
```

`RETELL_API_KEY` is read from env, else from the gitignored `.mcp.json`
(`mcpServers["retell-ai"].env`). Script: `workflows/scripts/retell-save-transcript.mjs`.
