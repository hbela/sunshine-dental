# Retell Go-Live Checklist (Phone Number + Publish)

Companion to [`deploy.md`](./deploy.md). That guide ships the **backend** (web + api +
the n8n webhooks). This one covers the **Retell** side: publishing the voice agent and
binding a real phone number so patients can actually call.

> Retell is a hosted product — you don't "deploy" it. The agent already lives in
> Retell's cloud; going live means **publishing** it and **attaching a phone number**.

---

## Current state (verified against the account)

| Thing | Value | Ready? |
|-------|-------|--------|
| Agent | `Dental Clinic` — `agent_0c73886e96f6cf2ad878def30e` | exists |
| LLM | `llm_9144fb5e818b3d841e18ab084b99` — `gpt-4.1-mini`, persona "Sarah" | ✅ |
| Voice | `openai-Chloe` | ✅ |
| Languages | `en-US`, `hu-HU`, `de-DE` | ✅ |
| 6 custom tools | all POST → `https://n8ndev.appointer.hu/webhook/retell-custom-functions` | ✅ |
| Post-call webhook | `https://n8ndev.appointer.hu/webhook/retell-post-call` | ✅ |
| **Agent published** | `is_published: false` | ❌ **do this** |
| **Phone number** | none provisioned | ❌ **do this** |

Tools present: `check_availability`, `list_available_providers`, `book_appointment`,
`cancel_appointment`, `get_faq_answer`, `capture_patient_info` (+ built-in `end_call`).
These match [`retell-custom-functions.md`](./retell-custom-functions.md).

---

## Step 1 — Confirm the tool/webhook host is production

All 7 endpoints point at **`n8ndev.appointer.hu`**. The "dev" in the name is the only
concern. Before publishing:

- If that n8n instance **is** your production automation host → nothing to change.
- If you stand up a separate prod n8n → update **all 6 tool URLs** and the **post-call
  webhook** in the agent, then re-publish. The repo can regenerate the agent tools via
  `workflows/scripts/retell-add-language.mjs` (SDK round-trip).

Either way, confirm the chain closes end-to-end:

```
Phone call → Retell → n8n (n8ndev.appointer.hu) → your API (https://your-domain.com/api/...) → Postgres
```

The n8n → API hop must send the `FASTIFY_API_KEY` header (deploy.md §9). Without a
matching key the API rejects the call and bookings silently fail.

### Optional hardening — auth the Retell → n8n hop

Today the Retell tools send **no auth header** (`headers: {}`), so the n8n webhook URL is
callable by anyone who learns it. To lock it down: add a shared-secret header on each
Retell tool (e.g. `X-Retell-Secret`) and verify it in the n8n webhook node, rejecting
mismatches.

---

## Step 2 — Publish the agent

Retell agents are versioned; a phone number can only route to a **published** version.

Dashboard → **Agents → Dental Clinic → Publish** (top-right). Re-publish after every
later edit (prompt, tools, voice). Publishing the agent publishes its LLM version too.

---

## Step 3 — Get a phone number

Two paths; choice depends on country.

### A. Buy from Retell (US/Canada only) — fastest, best for testing
Dashboard → **Phone Numbers → Buy Number** → pick area code → set **Inbound Agent =
Dental Clinic**. ~$2/mo, live in minutes. Use this to test the full pipeline even though
the clinic is in Hungary.

### B. Bring your own — required for a Hungarian +36 number
Retell does **not** sell EU/HU numbers. Buy the local number from a carrier (Twilio
*Elastic SIP Trunking* is the usual route) and connect it via SIP:

1. **Twilio:** buy the +36 number → create a SIP trunk → point origination/termination
   at Retell's SIP URI.
2. **Retell:** *Phone Numbers → Import / Connect via SIP* → set **Inbound Agent =
   Dental Clinic**.

> Recommended order: do **A** now to validate everything, then add **B** before the
> clinic goes live for real patients.

---

## Step 4 — Billing & verification

- Add a **payment method** in Retell — required to keep a number or take calls beyond
  trial minutes. Cost ≈ per-minute (telephony + voice + LLM) + ~$2/mo number.
- **Inbound** needs no special verification.
- **Outbound** (reminders/callbacks): US numbers need A2P/brand registration; with a
  Twilio SIP trunk that compliance lives on Twilio's side.

---

## Step 5 — Test the live number

1. Call the number from a phone.
2. Verify the agent greets in HU/EN and detects your language.
3. Walk a booking: it should hit `check_availability` → `book_appointment` and create a
   real appointment (check the web app / Postgres).
4. Hang up → confirm the **post-call webhook** fired (n8n execution + any post-call
   processing in `workflows/post-call-processing-v2.json`).

---

## Quick reference — shortest path to "I can call it"

1. (Step 1) Confirm `n8ndev.appointer.hu` is the host you want live.
2. (Step 2) Publish the **Dental Clinic** agent.
3. (Step 3A) Buy a US number → inbound agent = Dental Clinic.
4. (Step 4) Add a payment method.
5. (Step 5) Call it.

Swap in the Hungarian SIP number (Step 3B) once the pipeline is verified.
