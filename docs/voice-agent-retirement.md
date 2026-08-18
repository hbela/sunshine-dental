# Retiring the voice agent

> **Decided:** 2026-08-18 — the Retell AI voice channel is discontinued. The **chat
> receptionist is the sole patient-facing channel.**

## Why

The chat receptionist reached the quality bar in Hungarian; the voice agent never did. The
clinic reports being satisfied with chat and describes it as near-flawless in Hungarian —
which is the language that matters for both live clinics. Voice remained the weaker channel
in exactly the market the product sells into, and carrying two channels meant maintaining two
prompts, two n8n paths, and a per-minute cost line, to serve the worse one.

Two facts made this cheap to act on:

- **No phone number was ever provisioned.** The Retell account had zero numbers, so no patient
  ever reached the voice agent on a real line. Retiring it broke nothing that was live.
- **Chat books in-process.** The chat agent runs its tools inside the API against the same
  services the dashboard uses, so removing the voice path removed n8n from the booking path
  entirely rather than degrading it.

Notably, the Hungarian glossary work done *for* voice is the part worth keeping — it lives in
`apps/api/src/prompts/dental-pack.ts` and the chat agent uses it.

## What changed in the repo

| Area | Change |
|---|---|
| **Prompts** | `voice-agent.ts` deleted; `scheduling-core.ts` + `dental-pack.ts` stay (chat composes from them). Prompt tests rewritten chat-only, snapshots regenerated. |
| **API** | `call-logs.routes.ts`, `call-log.service.ts` deleted; route deregistered in `app.ts`. `callLog` removed from `ENCRYPTED_FIELDS` and the re-key script. |
| **Schema** | `model CallLog` and `Appointment.callId` dropped. Migration: `prisma/migrations/manual/2026-08-18-drop-call-logs.sql`. |
| **Web** | `/call-logs` route, `useCallLogs.ts`, `callLogs.json` ×3 deleted; nav item removed; the dashboard's call tiles now read chat stats (`useChatStats`). |
| **Tooling** | 11 `retell-*` scripts, `render-voice-prompt.mts`, `patch-ngrok-url.mjs`, `fetch-call-audio.mts`, both voice workflow JSONs, 8 npm scripts, the `retell-ai` MCP server entry, and the orphaned `ffmpeg-static` dep all removed. |
| **Docs** | Guides (EN/HU/DE), order forms (MD + 3 HTML), business model, compliance, SaaS agreement, deploy, runbook, onboarding and the Corona clinic record rewritten chat-first. Voice-only docs moved to [`archive/`](archive/README.md). |

`GET /api/faq` was **kept** even though its only caller (the n8n FAQ node) is gone: it is a
public, non-secret endpoint serving clinic facts from config, which a clinic website could
reasonably embed. Remove it if no such consumer appears.

---

# Teardown checklist

Everything below is **outside the repo** and needs a human. Work top to bottom — the order
matters in one place, flagged below.

### 1. Apply the database migration — before deploying

The api container syncs schema at boot with `prisma db push` **without**
`--accept-data-loss`, so it will refuse to drop the table on its own. Run the migration by
hand, per database, in this order: `dev → sunshinedev → corona prod → sunshine prod`.

```bash
# take a backup first — these hold encrypted patient PII
./scripts/backup-db.sh
psql "$DATABASE_URL" -f apps/api/prisma/migrations/manual/2026-08-18-drop-call-logs.sql
```

- [ ] dev
- [ ] sunshinedev
- [ ] corona prod
- [ ] sunshine prod

**This is irreversible** — call transcripts and summaries are deleted outright, and the backup
is the only rollback. Every row came from a web test call (no phone line ever existed), but
confirm that for the database in front of you before you commit.

### 2. Deactivate the n8n voice workflows — do this BEFORE deleting the agents

> **Why the order matters.** `Retell - Update LLM Date Daily` is a cron that PATCHes the
> agent's LLM every day, and it has `Error Handler — Email Alert` wired as its error workflow.
> Delete the agents first and that cron fails nightly, mailing you an alert every single day
> until you notice. Stop the cron first and it stays quiet.

**Prod — `n8nprod.appointer.hu`** (deactivate, then archive):

- [ ] `BxgJLziofW7fEME1` — Retell - Update LLM Date Daily ← **this one first**
- [ ] `kJ4QDaoEWRjdjkhj` — Retell Custom Function Router (v2 - PostgreSQL)
- [ ] `FBfZ65vr9r6MmTQc` — Retell Post-Call Processing (v2 - PostgreSQL)
- [ ] `jUh6a3wia5turKAw` — Retell - Dynamic Variables
- [ ] `OSB6pP4BxHqj4rAO` — Retell Custom Function Router (corona)
- [ ] `cTAJOshl2jmBMSGG` — Retell Post-Call Processing (corona)

**Test — `n8ndev.appointer.hu`:**

- [ ] `Tbq9RHDDjeT8WvVp` — Retell - Update LLM Date Daily ← **this one first**
- [ ] `rQ7I7vX2oAYnNIbR` — Retell Custom Function Router (v2 - PostgreSQL)
- [ ] `ekK0hiXY1JmcaFPX` — Retell Post-Call Processing (v2 - PostgreSQL)
- [ ] `Ra6FzJOrxiOJFanf` — Retell - Dynamic Variables
- [ ] `a8phBW4ss5tktNI7` — AI Phone Agent with RetellAI *(already inactive — just delete)*

**Leave these alone — they are the chat path and unrelated work:**

| Instance | Keep |
|---|---|
| prod | `r0WvLEAVKvD1V6cs` Chat Booking Confirmation Email · `aPWQA4Y08zAFu0bZ` Chat Booking Confirmation (corona) · `0tdA3t7At1mY7MTh` Error Handler — Email Alert |
| test | `uQOCh9xWEanSPPTo` Chat Booking Confirmation Email · `XJY0b9iwUrJ1AGeC` Founder CRM — Gmail Reply Sync |

- [ ] After deactivating: confirm `Error Handler — Email Alert` is still set as the **Error
      Workflow** on the two Chat Booking Confirmation workflows — it was configured on the
      voice workflows, and those are the only ones left to guard.

### 3. Delete the Retell agents

- [ ] `agent_0c73886e96f6cf2ad878def30e` — "Dental Clinic" (Sunshine; prod tag, v3)
- [ ] `agent_adf77216ba8897613f7cd376de` — "Corona Dental Szentendre"
- [ ] Delete the associated LLMs (Sunshine's is `llm_9144fb5e818b3d841e18ab084b99`)
- [ ] Confirm **Phone Numbers is empty** (it was on 2026-08-18) — if a number appeared since,
      release it *before* deleting the agent so no caller hits a dead route.

### 4. Billing and credentials

- [ ] Cancel / downgrade the **Retell AI** plan — check for a minimum term or prepaid balance.
- [ ] Confirm the final Retell invoice, then **revoke `RETELL_API_KEY`** in the Retell dashboard.
- [ ] Remove the `retell-ai` server block from your local `.mcp.json` (gitignored; the example
      file in the repo is already updated). The MCP server itself lives outside this repo at
      `C:\devs\retell-mcp` — delete or leave as you prefer.
- [ ] If the Cartesia / ElevenLabs / OpenAI voice accounts were only ever used for this agent,
      close them too.

### 5. Deploy and verify

- [ ] Deploy the api + web images built from this branch to each stack.
- [ ] `GET /api/health` → `200`, `encryption: unlocked`.
- [ ] `GET /api/call-logs` → **404** (route gone).
- [ ] Dashboard: no "Call Logs" nav item; the home tiles show *Chats This Week* and populate.
- [ ] Book an appointment through `/chat` end to end and confirm the e-mail arrives — this is
      now the only booking path, so it is the test that matters.

### 6. Customer-facing

- [ ] Re-publish the three user guides (`pnpm guide:publish`). They no longer reference calls,
      and the call-recording audio player and Call Logs screenshot are gone.
- [ ] Re-generate the demo video if it still shows the voice agent
      (`packages/video-generator`).
- [ ] Send Corona the updated guide if they hold a copy of the old one.

---

## Open decisions for you

These are business calls, deliberately left unmade:

1. **Pricing.** COGS per clinic dropped from roughly $70–130/mo to $15–50/mo — the per-minute
   voice and telephony lines are gone. The order forms now show a chat-only structure
   (€249 platform fee + €0.25/conversation, worked example €349/mo vs €619 before), but the
   €249 figure is **inherited from the voice-era model, not re-derived**. Hold the price and
   bank a much better margin, or cut it and compete harder — your call. See `order-form.md`
   and `business-model.md`.
2. **The three-tier ladder** in `business-model.md` was built around included *minutes*, where
   cost scaled steeply with volume. Chat cost is far flatter, so metering at all may no longer
   earn its complexity — a flat per-location fee may sell better and still hold margin.
3. **Positioning.** "Never miss a call" was the strongest line in the pitch and it is no longer
   available. The guides now lead on "never miss an enquiry" and being on the clinic's website,
   which is true but weaker. Worth thinking about what replaces it, especially for clinics
   whose pain genuinely is the phone.
