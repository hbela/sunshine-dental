# i18n Implementation Plan — Multi-language Web App (English + Hungarian)

> Goal: make the **web app** (`apps/web`) multi-language, starting with **English (`en`, default)** and **Hungarian (`hu`)**, with a clean structure for adding more languages later.

Status legend: `[ ]` todo · `[~]` in progress · `[x]` done

---

## 1. Scope

**In scope (v1):**
- All user-facing UI text in `apps/web` (nav, pages, forms, modals, buttons, toasts, validation messages).
- Date / time / number formatting per locale (Hungarian uses `YYYY. MM. DD.`, 24-hour, `,` decimal).
- `react-big-calendar` toolbar + labels.
- Enum display labels (appointment types, statuses, roles, calendar-event types).
- A language switcher + persistence of the user's choice.

**Out of scope (tracked as future phases, see §9):**
- API response/error messages (Fastify) — stay English in v1; client maps known codes later.
- The **Retell voice agent** Hungarian experience (Hungarian voice, prompt, FAQ data, n8n responses) — separate, larger track.
- Translating data entered by users (patient names, notes).

---

## 2. Approach & library choice

- **`react-i18next`** (+ `i18next`) — the standard for React/Vite; works with TanStack Router and shadcn.
- **`i18next-browser-languagedetector`** — detect from localStorage → `navigator.language`, default `en`.
- **Resources bundled as JSON** under `apps/web/src/locales/<lng>/<namespace>.json` (no network backend needed; Vite bundles them).
- **Dates** via existing `date-fns` + its locales (`enUS`, `hu`); **numbers** via `Intl.NumberFormat`.
- Default + fallback language: `en`. No RTL needed (both `en` and `hu` are LTR).

**Decisions to confirm (defaults chosen — change here if desired):**
- Persistence: **localStorage** (`sd.lang`) in v1. *(Optional later: add `User.locale` to persist server-side per user — see §9.)*
- Namespacing: split by feature area (below) rather than one giant file, to keep PR diffs small.

---

## 3. Locale file structure

```
apps/web/src/
  i18n/
    index.ts            ← i18next init (resources, detector, fallback)
    useFormat.ts        ← locale-aware date/number helpers (wraps date-fns + Intl)
  locales/
    en/
      common.json       ← buttons, generic words (save, cancel, loading, error…)
      nav.json          ← sidebar labels
      auth.json         ← login page
      dashboard.json
      calendar.json     ← calendar page + rbc toolbar + event editor
      appointments.json ← appointment modal/list/booking form
      patients.json
      callLogs.json
      settings.json
      admin.json        ← users admin
      enums.json        ← AppointmentType / AppointmentStatus / Role / CalendarEventType labels
      validation.json   ← zod/react-hook-form messages
    hu/
      …same files, Hungarian values
```

> Keep keys identical across `en` and `hu`. `en` is the source of truth for the key set.

---

## 4. Phase 0 — Setup & infrastructure

- [ ] Add deps to `apps/web`: `i18next`, `react-i18next`, `i18next-browser-languagedetector`.
- [ ] Create `src/i18n/index.ts`: init i18next with the namespaces above, `fallbackLng: 'en'`, `supportedLngs: ['en','hu']`, language detector (order: `localStorage`, `navigator`), and `interpolation.escapeValue: false`.
- [ ] Create empty `en/*.json` and `hu/*.json` files with matching keys (start with `common`, `nav`).
- [ ] Import `./i18n` in `src/main.tsx` **before** `<RouterProvider>`, and confirm `<html lang>` updates on language change (e.g. via an effect on `i18n.language`).
- [ ] Add a typed `t` helper / module augmentation (`react-i18next.d.ts`) so missing keys are TypeScript errors.

## Phase 1 — Core framework wiring

- [ ] Create `src/i18n/useFormat.ts` exposing `formatDate`, `formatTime`, `formatDateTime`, `formatNumber` that read the active locale (`date-fns` `hu`/`enUS`, `Intl`).
- [ ] Add a `LanguageSwitcher` component (uses `i18n.changeLanguage`, writes `localStorage`).
- [ ] Decide switcher placement: header in `components/layout/AppLayout.tsx` **and** the Settings page (§Phase 5).

## Phase 2 — Extract UI strings (by area)

> For each file: replace hardcoded text with `t('namespace:key')`, add keys to `en/*.json`, then translate in `hu/*.json`.

- [ ] `components/layout/AppLayout.tsx` — nav labels, "Sunshine Dental", "Logout", role display → `nav.json`, `common.json`.
- [ ] `routes/login.tsx` — auth form (labels, buttons, errors) → `auth.json`.
- [ ] `routes/_auth/index.tsx` — Dashboard → `dashboard.json`.
- [ ] `routes/_auth/calendar.tsx` + `components/calendar/DentalCalendar.tsx` — page chrome, controls → `calendar.json`.
- [ ] `components/calendar/AppointmentModal.tsx` — row labels ("Date", "Time", "Phone", "Notes"), booking form, buttons → `appointments.json` + `common.json`.
- [ ] `components/calendar/EventEditorModal.tsx` — availability/blocked/vacation editor → `calendar.json`.
- [ ] `routes/_auth/appointments.tsx` — list/filters/empty states → `appointments.json`.
- [ ] `routes/_auth/patients.tsx` — `patients.json`.
- [ ] `routes/_auth/call-logs.tsx` — `callLogs.json`.
- [ ] `routes/_auth/admin/users.tsx` — `admin.json`.
- [ ] `routes/_auth/settings.tsx` — `settings.json` (also hosts the switcher).
- [ ] `hooks/useCalendar.ts` + `lib/*` — toast/success/error strings surfaced to the user → `common.json`.
- [ ] Sweep `components/ui/*` for any embedded text (e.g. dialog close, aria-labels).

## Phase 3 — Dates, numbers & calendar

- [ ] Replace raw `date-fns` `format(...)` calls with `useFormat` helpers passing the active locale (notably `AppointmentModal.tsx` lines ~106–107, and any agenda/list formatting).
- [ ] Configure `react-big-calendar` localizer with the active `date-fns` locale and pass a translated `messages` prop (next/previous/today/month/week/day/agenda/date/time/event/noEventsInRange…) and `culture`.
- [ ] Verify `lib/calendar-utils.ts` wall-clock logic is locale-independent (it is — pure date math; **no change**, just confirm).
- [ ] Localize week start if needed (Hungarian weeks start Monday — `date-fns` `hu` locale handles this; confirm rbc respects it).

## Phase 4 — Enums & dynamic labels

- [ ] Build `enums.json` maps for `AppointmentType`, `AppointmentStatus`, `Role`, `CalendarEventType` (keys = enum values from `@repo/shared`).
- [ ] Add a helper `tEnum(kind, value)` and replace ad-hoc displays (e.g. `appointmentType.replace(/_/g,' ')`) across calendar/appointments components.
- [ ] Ensure values **sent to the API stay canonical** (uppercase enum codes) — only the **display** is translated.

## Phase 5 — Language switcher & persistence

- [ ] Wire `LanguageSwitcher` into the header and Settings page.
- [ ] Persist to `localStorage` (`sd.lang`); restore on load via the detector.
- [ ] Update `<html lang>` and `document.title` on change.
- [ ] (Optional) Pre-select from `navigator.language` on first visit when no stored value.

## Phase 6 — QA, tooling & docs

- [ ] Add an ESLint guard for hardcoded JSX text (e.g. `eslint-plugin-i18next` `no-literal-string`) — opt-in, scoped to `src/routes` & `src/components`.
- [ ] Add a CI/script check that `en` and `hu` key sets match (no missing/extra keys).
- [ ] Manual QA pass in both languages: every page, both roles, calendar views, modals, toasts, empty/error states; check for layout overflow (Hungarian strings run longer).
- [ ] Update `README.md` / this doc with "how to add a language" + "how to add a translatable string".

---

## 9. Future / optional tracks (not v1)

- [ ] **Per-user persistence:** add `locale String?` to `User` (Prisma), expose via auth/profile, hydrate i18next from it on login (overrides localStorage).
- [ ] **API message i18n:** have Fastify return stable error **codes** (it already returns some `code`s); map to translated strings client-side, or send `Accept-Language` and translate server-side.
- [ ] **Voice agent Hungarian:** Hungarian Retell voice + a `hu` system prompt + Hungarian `get_faq_answer` data + Hungarian n8n response strings. Large, separate effort — link from `docs/retell-agent-prompt.md`.

---

## Acceptance criteria (v1)

- [ ] Switching to Hungarian translates **all** visible UI text on every page (no English leakage outside user data).
- [ ] Dates, times, and numbers render in Hungarian format when `hu` is active.
- [ ] Language choice persists across reloads.
- [ ] Adding a third language requires only a new `locales/<lng>/` folder + switcher entry (no code changes in components).
- [ ] Values sent to the API are unchanged (enums stay canonical); booking/availability still work in both languages.

## Risks & notes

- Hungarian text is typically **30–40% longer** than English — watch sidebar/button/table layouts.
- Keep translation keys **semantic** (`appointments.bookButton`), not English-literal, so copy edits don't churn keys.
- `react-big-calendar` + `date-fns` locale wiring is the fiddliest part — tackle it on a spike before bulk extraction.
- Don't put translations in `packages/shared` (it's API-shared); enum **codes** live in shared, enum **labels** live in `apps/web/locales`.
