# workflows/

n8n workflow JSON for the **Sunshine Dental** platform.

Since the voice agent was retired (2026-08-18), the patient-facing receptionist is the
**text chat** only — see [`docs/voice-agent-retirement.md`](../docs/voice-agent-retirement.md).
Chat books appointments **in-process** in the API (`apps/api/src/services/chat.service.ts`),
so n8n is no longer in the booking path at all. One workflow remains, and it only sends mail.

## Environments

Two n8n instances since the Coolify deployment:

| | Host | API it calls | Purpose |
|---|---|---|---|
| **Prod** | `n8nprod.appointer.hu` | `https://sunshine.appointer.hu/api` (VPS) | Live clinic mail. |
| **Test** | `n8ndev.appointer.hu` | `https://sunshinedev.appointer.hu/api` | Dev/testing — never touches prod data. |

> The `.json` files here are **placeholder templates** (base URL = `YOUR-API-BASE-URL`). The
> source of truth is the live workflows in each n8n instance — export/import between instances
> rather than editing these files.

## Workflows

| File | Workflow Name | Purpose |
|------|--------------|---------|
| `chat-booking-confirmation.json` | Chat Booking Confirmation Email | Webhook the chat API calls after a booking, to email the patient a localized (EN/HU/DE) confirmation. |

### Chat booking confirmation email (why this exists)

The chat receptionist books in-process rather than through a workflow, so nothing would send
the patient a confirmation on its own. This workflow closes that gap: the API POSTs the booking
to its webhook (`N8N_BOOKING_WEBHOOK_URL`) and it sends the confirmation. Its HU copy uses the
chat glossary (`személyi igazolvány` / `TAJ kártya`, `Fogkőeltávolítás`, `Mélytisztítás`).

**Setup after import:** select the `Gmail account 2` credential on the Gmail node → **activate**
→ copy the Production webhook URL into the API's `N8N_BOOKING_WEBHOOK_URL` env (Coolify) →
redeploy. Webhook path: `/webhook/chat-booking-confirmation`.

## Multiple clinics on one n8n instance

Each customer clinic gets its **own copy** of this workflow on the shared prod instance, with a
clinic-scoped webhook path (`/webhook/<clinic>-chat-booking-confirmation`). Full procedure:
[`docs/onboarding-new-clinic.md`](../docs/onboarding-new-clinic.md).

Clinic facts live in [`packages/shared/src/clinics/<id>.ts`](../packages/shared/src/clinic.ts)
and are served by the API, so a clinic's chat prompt and its email copy stay in step.

## How to Import

1. Open the target n8n instance (prod `https://n8nprod.appointer.hu` or test `https://n8ndev.appointer.hu`)
2. Go to **Workflows → Import from file**
3. Select the JSON file and confirm
4. Re-select the Gmail credential (see below), then activate

## Credentials Required

- **Gmail OAuth2** — the **only** n8n credential needed. It must be **recreated per instance**;
  credentials don't travel with an exported workflow. NB `Gmail account 2` is a Testing-mode
  OAuth app whose token expires ~weekly.
- **No PostgreSQL credential** — there are no direct Postgres nodes.

Never hardcode credentials — reference them by name in the n8n UI.

## Conventions

- Node names are descriptive (e.g., "Send Confirmation Email" not "Gmail")
- Dynamic values use n8n expressions (`={{ }}`)
- Each workflow includes a **Configuration Notes** sticky node with setup instructions
- Workflow settings use `executionOrder: "v1"`

## Testing

Trigger the webhook with a sample booking payload and check the execution result in n8n before
activating. A booking made through the chat UI end-to-end is the better test — it exercises the
API's `N8N_BOOKING_WEBHOOK_URL` wiring too, which a manual POST does not.
