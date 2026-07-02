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

## Agent voice & model (cost choice)

The prod agent (`agent_0c73886e96f6cf2ad878def30e`, LLM `llm_9144fb5e818b3d841e18ab084b99`) runs:

- **Voice: `custom_voice_7b088e19c082ed8f759ffd49f4`** ("sunshine") — a custom ElevenLabs voice clone imported via BYOK (paste the ElevenLabs API key into Retell settings → *Import Professional Voices*; the *Community Voices* tab does NOT work for private clones). ElevenLabs runs ~$0.08/min, so voice cost is ~5× the previous `openai-Chloe` — a deliberate brand/quality choice over cost.
  - **Fallback: `fallback_voice_ids: ["openai-Chloe"]`** — a BYOK voice reaches ElevenLabs live per utterance and can fail mid-call (quota/API); the fallback keeps the (cheap, multilingual) previous voice as a safety net.
  - *History:* started on `11labs-Marissa`, then a 3-way A/B audition (`pnpm retell:audition`) picked `openai-Chloe` (~$0.015/min) to save ~$100/mo; superseded by the "sunshine" clone once the client wanted their own voice.
- **Model: `gpt-4.1-mini`** — the reliability/cost sweet spot for a multilingual, tool-calling booking agent (nano was too weak for function-calling). If it starts dropping the `language` param or fumbling `YYYY-MM-DD` dates, step back up.
- All-in ≈ **$0.10/min** (ElevenLabs voice + LLM + telephony), up from ~$0.036/min on `openai-Chloe`.

Change the voice idempotently with `pnpm retell:set-voice` (script: `workflows/scripts/retell-set-voice.mjs`) — it patches `voice_id` + `fallback_voice_ids` via the Retell SDK (`--dry-run` to preview). Re-run the engine A/B anytime with `pnpm retell:audition` (`workflows/scripts/retell-voice-audition.mjs`).

## Workflows

| File | Workflow Name | Purpose |
|------|--------------|---------|
| `retell-custom-function-router-v2.json` | Retell Custom Function Router (v2 - PostgreSQL) | Handles real-time custom function calls from Retell during a live call (slot availability, booking, cancellation, FAQ, patient capture) |
| `post-call-processing-v2.json` | Retell Post-Call Processing (v2 - PostgreSQL) | Runs after a call ends — logs the call to the API and emails a summary to the manager |

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
