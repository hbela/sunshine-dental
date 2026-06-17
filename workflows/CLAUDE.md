# workflows/

This directory contains n8n workflow JSON files for the **Sunshine Dental** voice agent integration with [Retell AI](https://www.retellai.com/).

## Agent voice & model (cost choice)

The prod agent (`agent_0c73886e96f6cf2ad878def30e`, LLM `llm_9144fb5e818b3d841e18ab084b99`) runs:

- **Voice: `openai-Chloe`** (~$0.015/min) — chosen over the original `11labs-Marissa` (ElevenLabs, ~$0.08/min) after a 3-way A/B audition confirmed OpenAI/Cartesia hold up in **Hungarian** over the phone. Saves ~$100/mo.
- **Model: `gpt-4.1-mini`** — the reliability/cost sweet spot for a multilingual, tool-calling booking agent (nano was too weak for function-calling). If it starts dropping the `language` param or fumbling `YYYY-MM-DD` dates, step back up.
- All-in ≈ **$0.036/min** (voice + LLM + telephony) ≈ ~$65/mo at ~1,800 min.

Re-run the voice A/B anytime with `pnpm retell:audition` (script: `workflows/scripts/retell-voice-audition.mjs`); change the voice with the same Retell SDK pattern as `retell-add-language.mjs`.

## Workflows

| File | Workflow Name | Purpose |
|------|--------------|---------|
| `retell-custom-function-router-v2.json` | Retell Custom Function Router (v2 - PostgreSQL) | Handles real-time custom function calls from Retell during a live call (slot availability, booking, cancellation, FAQ, patient capture) |
| `post-call-processing-v2.json` | Retell Post-Call Processing (v2 - PostgreSQL) | Runs after a call ends — logs the call to the API and emails a summary to the manager |

## How to Import

1. Open your n8n instance at `https://n8ndev.appointer.hu`
2. Go to **Workflows → Import from file**
3. Select the JSON file and confirm
4. Update any credential references (see below) before activating

## Credentials Required

- **PostgreSQL** — for appointment/patient data operations
- **Gmail OAuth2** — for sending confirmation and summary emails (use `Gmail account 2`)
- **HTTP Request / API** — for the `Log Call to API` node (configure base URL in the workflow settings or via a sticky note)

Never hardcode credentials — reference them by name in the n8n UI.

## Conventions

- Node names are descriptive (e.g., "Book Appointment" not "Postgres")
- Dynamic values use n8n expressions (`={{ }}`)
- Each workflow includes a **Configuration Notes** sticky node with setup instructions
- Workflow settings use `executionOrder: "v1"`

## Re-pointing the router at the current ngrok tunnel

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
