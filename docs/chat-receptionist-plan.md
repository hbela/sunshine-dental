# Plan: Patient-facing Chat Receptionist

## Context

Today the "virtual receptionist" is **voice-only**: a patient calls, Retell (LLM + TTS)
handles the conversation, n8n routes the 6 tool calls, and the Fastify API (`apps/api`)
does the real booking against Postgres. There is **no way for a patient to reach the
receptionist by text**, and no patient-facing UI at all — the whole web app is behind
staff auth.

We want to give patients a second channel: a **mobile/laptop chat** with the same virtual
receptionist, capable of the same things the phone agent does (answer FAQs, check
availability, book, cancel/reschedule, capture details). The good news from exploration:
the entire booking backend is reusable in-process — the only genuinely new piece is the
"brain" (an LLM tool-calling loop), since **no AI SDK exists in the repo today** (all
reasoning currently lives inside Retell's gpt-4.1-mini).

**Confirmed decisions:** LLM = **Claude Haiku 4.5**; **full parity** with the voice agent;
delivery = **public chat page + reusable floating widget**; **staff-facing Chat Logs view**
in the dashboard.

## Approach

Add a self-contained chat agent inside the existing monorepo — no new app, no n8n hop:

```
Patient browser ──POST /api/chat/* (public, SSE)──▶ Fastify chat.service
                                                        │ Claude Haiku 4.5 tool loop
                                                        ▼ (in-process, no HTTP)
                                        CalendarService / AppointmentService / Patient
                                                        ▼
                                                     Postgres
Staff dashboard ──GET /api/chat/conversations (auth)──▶ Chat Logs view
```

The LLM runs a tool-use loop in the API; each tool calls the **existing services directly**
(no auth key, no network round-trip). Conversation history + a staff-facing transcript are
persisted in two new Prisma models. Streaming to the browser via SSE.

---

## Backend (`apps/api`)

### 1. Dependency
Add `@anthropic-ai/sdk` to `apps/api/package.json`. New env var `ANTHROPIC_API_KEY`
(add to `apps/api/.env.example`, Coolify prod + dev). Model id `claude-haiku-4-5-20251001`.

### 2. Prisma models — `apps/api/prisma/schema.prisma`
Add (mirrors the spirit of `CallLog` but multi-turn):

- `ChatConversation` — `id`, `token` (unguessable secret for browser resume, not exposed to
  staff), `patientId?` (FK `Patient`, set once captured), `appointmentId?`, `language`
  (`en|hu|de`), `status` (`ACTIVE|ENDED`), `summary?`, `sentiment?`, `successful?`,
  `startedAt`, `endedAt?`, timestamps.
- `ChatMessage` — `id`, `conversationId` (FK, cascade), `role` (`USER|ASSISTANT|TOOL`),
  `content` `@db.Text`, `toolName?`, `createdAt`.

Add the `chatConversations` back-relation to `Patient`. Run `prisma db push` + regenerate
client (dev + prod, per `docs/deploy.md` §6a/§11e — **push only, no seed re-run**).

### 3. Chat service — `apps/api/src/services/chat.service.ts` (new)
Core tool-use loop:
1. Load conversation + prior `ChatMessage` history, build Anthropic `messages`.
2. Call Claude Haiku with the system prompt (below) + tool schemas; **stream** text deltas.
3. On `tool_use`, dispatch to a handler, append `tool_result`, loop until end turn.
4. Persist user/assistant/tool messages as they complete.

**Tools mirror the 6 Retell functions** (`docs/archive/retell-custom-functions.md`) but execute
in-process against existing code — reuse, do not reimplement:
- `check_availability` → `CalendarService.getAvailableSlots(date, TYPE, undefined, provider_name)`
- `list_available_providers` → `CalendarService.getAvailableProviders(date, TYPE)`
- `book_appointment` → `AppointmentService.book({...})` (already re-validates the slot &
  find-or-creates the patient by phone — 409-safe against double-booking)
- `cancel_appointment` → `AppointmentService.cancelBySearch({...})`
- `capture_patient_info` → `prisma.patient` create/update (link to conversation)
- FAQ: **fold clinic facts into the system prompt** instead of a `get_faq_answer` tool —
  the n8n FAQ handler exists only because Retell's smaller model needed determinism; Haiku
  can answer hours/location/insurance/emergency directly. (Keeps parity without the n8n dict.)

**Critical enum-casing reuse:** the API enums are UPPER_CASE while the tool/patient language
uses lower_case — replicate the n8n router's `appointment_type.toUpperCase()` mapping (see
`packages/shared/src/schemas/appointment.schema.ts` for the canonical `AppointmentType` /
`AppointmentDurations`). Validate/normalize before calling services.

### 4. System prompt — `apps/api/src/prompts/chat-receptionist.ts` (new)
Adapt `docs/archive/retell-agent-prompt.md`: keep personality, **Language Handling (en/hu/de,
detect & reply in the patient's language)**, scheduling rules, office hours, appointment
types, booking/cancel/reschedule flows. **Strip voice-only bits** (phone read-back, TTS
pacing, "end the call", 911 → use **112** per the EU/i18n note). Inject `today` (Europe/
Budapest) like the voice agent injects `{{current_date}}`.

### 5. Routes — `apps/api/src/routes/chat.routes.ts` (new), registered in `apps/api/src/app.ts`
**Public (patient), no better-auth** — outside the staff guard, like the existing public
`/api/health`. Rate-limit + require the conversation `token`:
- `POST /api/chat/conversations` → create conversation, return `{ id, token }`.
- `POST /api/chat/conversations/:id/messages` → append user msg, **stream assistant reply
  via SSE** (Fastify raw reply). Requires matching `token`.

**Staff (auth), for Chat Logs** — `requireAuth` + `requireRole(['ASSISTANT','ADMIN'])`,
exactly like `call-logs.routes.ts`:
- `GET /api/chat/conversations` (list + filters + pagination), `GET /:id` (with messages),
  `GET /api/chat/stats` (mirror `CallLogService.stats`). Never expose `token` to staff.

Optional summary/sentiment: on conversation end, one cheap Haiku call to fill
`summary`/`sentiment`/`successful` (same idea as Retell post-call analysis).

---

## Frontend (`apps/web`)

### 6. Public chat — new **top-level** route `apps/web/src/routes/chat.tsx`
Public, like `routes/login.tsx` (NOT under `_auth`). Full-page, mobile-first chat: message
list, streaming assistant bubbles (consume SSE), composer, language switcher (reuse
`components/LanguageSwitcher.tsx` + i18next), typing indicator. Persist `{conversationId,
token}` in `localStorage` to resume. Reuse Radix `components/ui/*`, Tailwind v4 theming.

### 7. Floating widget — `apps/web/src/components/chat/ChatWidget.tsx` (new)
A bubble that opens the same chat panel; drop-in, reusable so it can later be embedded on
the clinic's marketing site. Renders the shared `<ChatPanel/>` used by the full-page route.

### 8. i18n — new `chat` namespace in `apps/web/src/locales/{en,hu,de}/chat.json`
Register in `apps/web/src/i18n/index.ts`. UI strings only (the assistant's own replies are
localized by the LLM). Add all three languages (Budapest clinic — parity with existing app).

### 9. Staff Chat Logs view — `apps/web/src/routes/_auth/chat-logs.tsx` (new)
Mirror the existing Call Logs page: list with sentiment/outcome/language, detail drawer with
full transcript and any linked patient/appointment. Add a `useChatLogs` hook
(`apps/web/src/hooks/`, pattern of `useCallLogs`) and a nav entry in
`components/layout/AppLayout.tsx` (role-gated ASSISTANT/ADMIN). Add nav/label strings to the
`nav` locale namespace.

---

## Reuse map (do not rebuild)
| Need | Existing code |
|------|---------------|
| Availability engine | `apps/api/src/services/calendar.service.ts` |
| Booking + slot re-validation + patient upsert | `apps/api/src/services/appointment.service.ts` (`book`, `cancelBySearch`) |
| Type/duration contract & casing | `packages/shared/src/schemas/appointment.schema.ts` |
| Agent behavior/flows/prompt source | `docs/archive/retell-agent-prompt.md`, `docs/archive/retell-custom-functions.md` |
| Tool→service request/response shapes, FAQ text | `workflows/retell-custom-function-router-v2.json` |
| Staff-log route/UI/stats pattern | `call-logs.routes.ts`, `_auth/call-logs.tsx`, `useCallLogs` |
| Public unauth route pattern | `health.routes.ts` (API), `routes/login.tsx` (web) |

## Out of scope for v1 (note as follow-ups)
- Confirmation **email** on chat bookings (voice path sends it via n8n's Gmail node). v1 shows
  on-screen confirmation; wiring the same n8n email webhook is a fast follow.
- Live human handoff to staff (v1 logs a callback via `capture_patient_info`, same as voice).
- Embedding the widget on an external site (component is built widget-ready, but CORS/embed
  hardening is later).

## Verification
1. **Backend loop:** `pnpm --filter api dev`, `curl -N` an SSE round-trip against
   `POST /api/chat/conversations` then `.../messages` — confirm streaming + a real
   `book_appointment` writes a `CONFIRMED` row and creates/links the `Patient`.
2. **Double-booking guard:** book the same slot twice → second returns the 409 path and the
   agent offers alternatives (proves `AppointmentService.book` re-validation still governs).
3. **Multilingual:** send a Hungarian and a German message → assistant replies in-language and
   passes `YYYY-MM-DD`/`HH:MM` to tools (spot-check DB values).
4. **Web:** open `/chat` on a narrow viewport, book end-to-end; confirm it appears in the
   Calendar/Appointments dashboard (shared DB) and under the new **Chat Logs** view with
   transcript + linked patient. Verify `/chat` is reachable **logged-out**.
5. **Regression:** `pnpm typecheck` / `pnpm build`; confirm the voice path (n8n → API) is
   untouched (shared services unchanged in signature).
6. Use `/verify` (or `/run`) to drive the real app before committing.
