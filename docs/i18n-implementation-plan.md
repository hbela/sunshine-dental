# i18n / Multilingual Plan — Web App + Voice Agent (English · Hungarian · German)

> Goal: make **both** patient/staff channels work in **English (`en`, fallback)**, **Hungarian
> (`hu`)**, and **German (`de`)** — the React admin app *and* the Retell phone agent.

Status legend: `[ ]` todo · `[~]` in progress · `[x]` done

## Why

The clinic is in **Hungary** and serves patients from different countries — notably many
**German-speaking** patients who call for affordable, high-quality care, plus Hungarian and English
speakers. Today everything is English-only: the web admin UI is hardcoded English, and the Retell
voice agent (`agent_0c73886e96f6cf2ad878def30e` / LLM `llm_9144fb5e818b3d841e18ab084b99`) runs at
`language: en-US` with an English prompt and English n8n responses/FAQ/emails.

**Decisions:**
- Languages: **en** (fallback), **hu**, **de**.
- Voice: **auto-detect the caller's language from speech** (one multilingual agent).
- Web UI default: **browser-detected, fall back to English**.

**Architectural principle — the API stays language-neutral.** Fastify returns data + canonical enum
codes, never localized prose. Localization lives only in the two presentation layers (the React app,
and the Retell prompt + n8n nodes). Booking/availability behave identically in every language.

---

# Track A — Web admin app (`apps/web`), en/hu/de

Library: **`react-i18next`** + **`i18next`** + **`i18next-browser-languagedetector`**; JSON resources
bundled by Vite; `date-fns` locales for dates; `Intl` for numbers.

## A0. Setup & infrastructure
- [x] Add deps to `apps/web`: `i18next`, `react-i18next`, `i18next-browser-languagedetector`.
- [x] `src/i18n/index.ts`: init i18next — `supportedLngs: ['en','hu','de']`, `fallbackLng: 'en'`,
      detector order `['localStorage','navigator']`, `interpolation.escapeValue: false`.
- [x] Import `./i18n` in `src/main.tsx` **before** `<RouterProvider>`; update `<html lang>` on change.
- [x] Typed keys via `react-i18next.d.ts` module augmentation (missing keys = TS errors).

## A1. Locale files
```
apps/web/src/locales/{en,hu,de}/
  common.json  nav.json  auth.json  dashboard.json  calendar.json
  appointments.json  patients.json  callLogs.json  settings.json
  admin.json  enums.json  validation.json
```
- [x] `en` is the source-of-truth key set; `hu` and `de` mirror it exactly. (11 namespaces; `validation`
      messages folded into the feature namespaces — `auth`/`appointments`/`calendar` — rather than a
      standalone file.)

## A2. Formatting helper
- [x] `src/i18n/useFormat.ts` exposing `formatDate/formatTime/formatDateTime/formatNumber`, reading the
      active locale (`date-fns` `enUS`/`hu`/`de`, `Intl.NumberFormat`).

## A3. String extraction (replace hardcoded text with `t(...)`)
File-by-file — representative paths:
- [x] `components/layout/AppLayout.tsx` — nav labels, "Sunshine Dental", "Logout", role → `nav`,`common`.
- [x] `routes/login.tsx` → `auth`.
- [x] `routes/_auth/index.tsx` (Dashboard) → `dashboard`.
- [x] `routes/_auth/calendar.tsx` + `components/calendar/DentalCalendar.tsx` → `calendar`.
- [x] `components/calendar/AppointmentModal.tsx` (row labels, booking form) → `appointments`,`common`.
- [x] `components/calendar/EventEditorModal.tsx` → `calendar`.
- [x] `routes/_auth/appointments.tsx`, `patients.tsx`, `call-logs.tsx`, `admin/users.tsx`, `settings.tsx`.
- [ ] `hooks/useCalendar.ts` + `lib/*` toasts/errors → `common`. (No literal user-facing strings found
      there yet — errors surface via `apiErrorMessage`; revisit when toasts are added.)
- [ ] Sweep `components/ui/*` for embedded text / aria-labels. (Primitives are text-free today; recheck.)

## A4. Dates, numbers & calendar
- [x] Replace raw `date-fns` `format(...)` (e.g. `AppointmentModal.tsx` ~L106-107) with `useFormat`.
- [x] Configure `react-big-calendar` localizer with the active `date-fns` locale + translated
      `messages` (next/previous/today/month/week/day/agenda/noEventsInRange…) + `culture`.
- [x] `lib/calendar-utils.ts` is pure date math — **no change**, just confirm.
- [x] HU/DE weeks start Monday — `date-fns` locales handle it; confirmed rbc respects it via `culture`.

## A5. Enums & dynamic labels
- [x] `enums.json` maps for `AppointmentType / AppointmentStatus / Role / CalendarEventType`
      (keys = canonical codes from `@repo/shared`); `useEnum().tEnum()` helper replaces
      `appointmentType.replace(/_/g,' ')`. **Display only — values sent to the API stay canonical.**

## A6. Switcher & persistence
- [x] 3-way `LanguageSwitcher` (EN/HU/DE) in the header **and** the Settings page (now a real section).
- [x] Persist to `localStorage` (`sd.lang`); restore via detector; update `<html lang>`.
      (`document.title` is static "Sunshine Dental" — no per-page titles to localize yet.)

## A7. QA & tooling
- [x] en/hu/de key-parity check (script) — all 11 namespaces match. *(CI wiring still TODO.)*
- [ ] Optional ESLint `no-literal-string` guard scoped to `src/routes` & `src/components`.
- [ ] Trilingual QA pass: every page, both roles, calendar views, modals, toasts, empty/error states;
      watch layout overflow (HU/DE strings run 30-40% longer).

*(Future, not v1: per-user `User.locale` in Prisma; API `Accept-Language` error messages.)*

---

# Track B — Voice agent (Retell + n8n), auto-detect en/hu/de

The multilingual **gpt-4.1** LLM converses in the caller's language; n8n localizes only the
**written/factual** patient-facing output (FAQ, confirmation email).

## B0. Retell agent configuration — **spike first** (riskiest)
- [x] Enable **multilingual / auto-detect** on the agent — live agent is already `language: "multi"`,
      model `gpt-4.1` (multilingual STT). Confirmed via `retell_get_agent`.
- [~] Pick a **voice that speaks EN + HU + DE acceptably** — **Hungarian TTS is the main unknown**.
      Live voice is `11labs-Marissa` (ElevenLabs multilingual model covers en/hu/de). Retell voice
      metadata exposes only `accent` (no per-language list) and **no voice is tagged Hungarian**, so an
      ElevenLabs voice is the right single-voice architecture for a `multi` agent. **Listening audition
      of Hungarian quality is a human task — still TODO before launch.**
- [x] Agent-level voice/language already set (no dashboard step needed for this change). Tool/prompt
      edits are scripted via `workflows/scripts/retell-add-language.mjs` (Retell SDK round-trip), so no
      `update_agent` MCP extension was required.

## B1. System prompt — add a "Language Handling" section (targeted merge, **do NOT overwrite**)
The live prompt is the source of truth (richer than docs; includes the 2026-06-12 search-cap rule).
- [x] Inserted a *Language Handling* section into the live prompt (between Personality and Core
      Responsibilities) via the round-trip script: detect en/hu/de from the opening turns; conduct the
      whole call in it; relay English tool data in the caller's language; **pass `language` to every
      custom function**. Mirrored in `docs/archive/retell-agent-prompt.md`.

## B2. Custom-function tool schemas — add `language`
- [x] Added optional `language` enum (`en`/`hu`/`de`) to all 6 custom tools via the SDK `general_tools`
      round-trip (`workflows/scripts/retell-add-language.mjs`, idempotent). Verified live; `end_call`
      and all existing fields preserved. Mirrored in `docs/archive/retell-custom-functions.md`.

## B3. n8n router localization (workflow `rQ7I7vX2oAYnNIbR`)
- [x] **FAQ Handler**: split into **per-language dictionaries (en/hu/de)** keyed by `body.args.language`
      (fallback en, then en topic, then a localized fallback line). Content corrected to real HU facts
      (Budapest address, +36 phone, HUF amounts, Generali/Medicover, **emergency → 112**). Applied live
      + mirrored to the local JSON. *(Facts are working data, not a real clinic's verified policy —
      human review still recommended.)*
- [x] **Send Confirmation Email**: added a **Localize Email** Code node (en/hu/de subject + HTML body,
      reads `body.args.language`) wired `Has Email?`(true) → Localize Email → Gmail; Gmail now reads
      `$json.subject/html/sendTo`. Appointment-type label localized. Applied live + mirrored locally.
- [x] **Format\* nodes** (availability/booking/cancel/providers/patient): left returning English data;
      the multilingual LLM relays it in the caller's language (B1). *(No change — confirmed.)*

## B4. Docs & tests
- [x] Update `docs/archive/retell-agent-prompt.md` (Language section + multilingual agent settings) +
      `docs/archive/retell-custom-functions.md` (`language` param on all 6 functions) to mirror live.
- [ ] Extend the **Retell Simulation** scenario set with HU + DE personas (re-seed same day, use
      `Nagy`/`Kis`, give personas a terminal exit — see the simulation loop-guard notes).

---

## Verification

**Track A:** `pnpm --filter web dev`; switch en→hu→de; confirm every page/modal/calendar view +
dates/numbers localize with no English leakage (outside user data); run the key-parity check.

**Track B (per language):**
1. Re-seed availability the same day (`pnpm --filter @repo/api db:seed`); confirm
   `GET /api/calendar/available-providers?...` is non-empty.
2. Drive the webhook (smoke-test pattern) with `language: "hu"`/`"de"`: `get_faq_answer` returns
   localized FAQ; `book_appointment` (+`provider_name`+`language`) creates the appointment under the
   right provider (language-neutral) and the email renders in that language; hard-delete test rows.
3. Run a **Retell test/simulation** call per language end-to-end (greeting → availability → booking);
   confirm the agent stays in the caller's language and audio quality is acceptable.

## Risks
- **Hungarian voice (TTS) + transcription quality** — biggest unknown; spike B0 first.
- LLM relaying English tool data into HU/DE — validate phrasing; fall back to data-return if weak.
- **FAQ factual accuracy** per language (addresses, HUF, insurers) — real content + human review.
- Web UI text expansion (HU/DE longer) — watch sidebar/buttons/tables.
- Keep enum **codes** canonical end-to-end; only labels/prose are translated.

## Suggested sequencing
1. This doc (done). 2. **B0 voice spike** (de-risk Hungarian). 3. Track A A0-A4 ∥ B1-B3.
4. Track A bulk extraction + B4 docs/tests. 5. Full trilingual QA on both channels.
