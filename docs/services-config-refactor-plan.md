# R1–R3 Refactor Plan — Services as Config, Prompts as Modules, Configurable Slot Stride

> **Status:** Planned, not started. Targets the two live clinics (Sunshine, Corona).
> **Date:** 2026-07-26
> **Prompted by:** `docs/vertical-expansion-strategy.md`, which identified these three restrictions.
> Generalization to other verticals is explicitly **out of scope** here — every change below is
> justified by the two dental clinics we run today.

## Context

`docs/vertical-expansion-strategy.md` recorded three restrictions in the current implementation. The
generalization question is now set aside — this plan fixes those restrictions before they bite:

- **R1** — appointment types are a Prisma enum + a module-level duration constant, so Sunshine and
  Corona cannot differ, and adding one service means a schema change across every stack.
- **R2** — the chat prompt hardcodes the service list and duplicates hard-won HU register rules that
  also live, hand-maintained, in the Retell voice prompt. They have already drifted.
- **R3** — `calendar.service.ts` walks availability on a hardcoded 30-minute stride.

**Intended outcome:** a clinic's services, durations, labels and slot granularity become config;
both prompts are rendered from one set of modules; behaviour for Sunshine and Corona is unchanged on
day one.

### The one sharp edge

`AppointmentType` is a real Postgres enum (`apps/api/prisma/schema.prisma:160-168`) and the api
container boots with `prisma db push` **without** `--accept-data-loss` (`apps/api/Dockerfile` `CMD`).
An enum→String change will **fail the boot**, not apply silently. The column must be altered by hand
*before* the new image is deployed. This is the only step with downtime risk and it is why the
rollout is sequenced per stack.

There is also almost no safety net: the entire repo has one test file
(`apps/api/src/lib/crypto.test.ts`), no `test` task in `turbo.json`, and no CI. Step 0 fixes that
first.

---

## Step 0 — Safety net

- Add a `test` task to `turbo.json` and a root `test` script. `vitest ^4.1.10` is already a
  devDependency of `apps/api` and needs no config (defaults pick up `**/*.test.ts`).
- Put **all** new tests in `apps/api` — it can import `@repo/shared`, so neither `packages/shared`
  nor `apps/web` needs vitest installed.
- Capture a **pre-refactor baseline** to diff against later:
  - `apps/api/src/prompts/__baseline__/sunshine.txt` and `corona.txt` — the current
    `buildChatSystemPrompt` output for each clinic.
  - Slot arrays from `GET /api/calendar/slots` for every type × seeded provider on a seeded day.

## Step 1 — `ClinicConfig` gains services (and slot interval)

In `packages/shared/src/clinic.ts`, alongside the existing `FAQ_TOPICS` / `faqAnswer` pattern:

```ts
export interface ClinicService {
  /** UPPER_SNAKE — the DB and HTTP value. The agent surface uses code.toLowerCase(). */
  code: string;
  durationMinutes: number;
  /** en is required (prompts are English and it is the fallback). */
  labels: { en: string } & Partial<Record<ClinicLanguage, string>>;
}
```

Added to `ClinicConfig`: `services: readonly ClinicService[]`, `defaultServiceCode?: string`
(falls back to `services[0].code`), `slotIntervalMinutes?: number` (**R3**, default 30).

Helpers exported from the same file, mirroring `faqAnswer`'s fallback style:
`serviceCodes`, `agentServiceCodes` (lowercase), `findService` (case-insensitive),
`durationFor`, `serviceLabel(clinic, code, lang)`, `defaultServiceCode`, `slotInterval`.

**Keep the UPPER↔lower invariant.** The n8n router does a blind `.toUpperCase()` at
`workflows/retell-custom-function-router-v2.json:194,266,582` — agent code must remain exactly
`code.toLowerCase()`.

Extend `getClinic()`'s existing fail-loudly-at-boot validation (`clinic.ts:193-203`) to assert:
non-empty services, unique codes matching `/^[A-Z][A-Z0-9_]*$/`, positive durations, a resolvable
`defaultServiceCode`, positive `slotIntervalMinutes`.

Populate `packages/shared/src/clinics/sunshine.ts` and `corona.ts` with today's 7 services and
durations (`CLEANING` 30, `NEW_PATIENT_EXAM` 60, `DEEP_CLEANING` 60, `FILLING` 45, `CROWN_PREP` 90,
`CONSULTATION` 30, `EMERGENCY` 30) so behaviour is byte-identical.

> Take the HU labels from the **prompt/n8n** wording (`Fogkőeltávolítás`), not from
> `apps/web/src/locales/hu/enums.json`, which says `Fogtisztítás` — these have already drifted, and
> config now becomes the single source.

## Step 2 — Retire the enum in shared

`packages/shared/src/schemas/appointment.schema.ts`: delete `AppointmentTypeSchema` and
`AppointmentDurations`; widen `AppointmentSchema.appointmentType` to `z.string()`.

That widening is load-bearing: `AppointmentSchema` is the **response** schema on five routes
(`apps/api/src/routes/appointments.routes.ts:24,48,65,98,124`), so a closed enum would reject
clinic-specific codes on the way *out*.

Consumers to update — all four import sites plus the two duration lookups:

- `apps/api/src/routes/appointments.routes.ts:89` — `appointment_type` becomes `z.string()`; validate
  against the clinic in `AppointmentService.book` and surface a clean 400 via the existing
  `sendError` / `apps/api/src/lib/errors.ts` helper.
- `apps/api/src/services/calendar.service.ts:102,148,195` — `durationFor(clinic, type)`,
  `slotStart += slotInterval(clinic)` (**R3**), and the hardcoded `'CONSULTATION'` default →
  `defaultServiceCode(clinic)`.
- `apps/api/src/services/appointment.service.ts:135,198` — `durationFor`; the
  `appointmentType: type as any` cast exists only because of the Prisma enum and can go.
- `apps/api/src/services/chat.service.ts:33,72-80,230` — `normalizeType` becomes
  `findService(clinic, t)?.code`; `APPOINTMENT_TYPE_ENUM` is built from `agentServiceCodes(clinic)`
  (`clinic` is already a process-wide constant via `apps/api/src/lib/clinic.ts`, so the module-level
  `tools` array can read it directly); `'CONSULTATION'` → `defaultServiceCode(clinic)`.

## Step 3 — Prisma enum → String

- `apps/api/prisma/schema.prisma:147`: `appointmentType String`; delete the `enum AppointmentType`
  block at 160-168.
- Regenerate the client (`pnpm --filter api db:generate`). It lives under `apps/api/src/generated/`
  but is **gitignored**, so it does not appear in the diff — regenerate locally after pulling.
- The demo seed's four literal codes (`apps/api/prisma/seed.ts:410-413`) stay valid as strings. The
  `--minimal` path creates no appointments, so real clinics have no seed concern.

**The manual migration, run once per database (dev, sunshinedev, sunshine prod, corona prod):**

```sql
ALTER TABLE "Appointment" ALTER COLUMN "appointmentType" TYPE TEXT USING "appointmentType"::text;
DROP TYPE "AppointmentType";
```

Run this **before** deploying the new image. Afterwards the boot-time `db push` sees TEXT ≡ String and
is a no-op. In the window between the ALTER and the deploy the old image keeps working — Prisma passes
enum values through as strings.

## Step 4 — R2: prompts become modules, and the voice prompt gets generated

Split `apps/api/src/prompts/chat-receptionist.ts` into:

- `prompts/scheduling-core.ts` — persona, language detection + formal register (Ön/Sie), scheduling
  rules, booking and cancel/reschedule flows, tool-error handling, clinic facts. The
  `## Appointment types (and duration)` block (lines 94-101) is now **generated** from
  `clinic.services` with per-language labels.
- `prompts/dental-pack.ts` — the HU glossary minus the per-type names now coming from config
  (`tisztítás` not `takarítás`, `fogorvos` never `fogász`, TAJ/személyi ig., the fixed phrasings),
  the dental-anxiety line, and the medical-emergency escalation text.
- `chat-receptionist.ts` keeps `buildChatSystemPrompt(today, clinic)` — its only caller is
  `apps/api/src/services/chat.service.ts:406` — as a composition of the two.

Then add `prompts/voice-agent.ts` exporting `buildVoiceSystemPrompt(clinic)`: the same core + pack,
but with voice mechanics (phone read-back, TTS pacing, end-of-call) and FAQ via the `get_faq_answer`
tool rather than inlined facts — matching the section order of `docs/retell-agent-prompt.md`.

New script `workflows/scripts/render-voice-prompt.mts` (`pnpm prompt:voice -- --clinic <id>`).
`rewritePrompt()` / `residue()` in `workflows/scripts/retell-clone-agent.mts:102-125` — the
"remaining 10% is yours" string substitution — are replaced by a render call.

> **Do not blindly overwrite the live prompt.** It has been hand-tuned (see
> `docs/retell-hu-prompt-new-2026-07-20.txt`). Render, diff against the live LLM, fold any missing
> tuning back into the modules, and only then push. Back up the live prompt first.

## Step 5 — Web

- New `apps/web/src/i18n/useServiceLabel.ts`: look up `CLINIC.services` by code in the active
  language, falling back to the existing `tEnum('appointmentType', code)`. Replace the five
  `tEnum('appointmentType', …)` call sites (`components/calendar/AppointmentModal.tsx:105`,
  `routes/_auth/appointments.tsx:199,284`, `routes/_auth/index.tsx:183`,
  `routes/_auth/patients.tsx:208`).
- `apps/web/src/components/calendar/AppointmentModal.tsx:30,190,246-253` — the one real dropdown:
  options and default come from `CLINIC.services` instead of `AppointmentTypeSchema.options`.
- `apps/web/src/routes/_auth/appointments.tsx:34` — delete `const TYPES`, dead code.
- Leave `apps/web/src/locales/*/enums.json` in place as the fallback path; `useEnum`'s `defaultValue`
  already degrades unknown codes without crashing.

## Step 6 — Live systems (after the code lands, one clinic at a time, each approved first)

**Make the API the source of labels** so n8n stops hardcoding them: add `appointment_type_label`
(resolved from `clinic.services` in the request language) to the appointment serializer in
`apps/api/src/services/appointment.service.ts:36` and to the chat booking payload in
`apps/api/src/services/chat.service.ts:276`.

Then, per clinic:

- **n8n** — in the two Code nodes that hardcode label maps, prefer `appointment_type_label` and keep
  the existing `replace(/_/g,' ')` fallback: `workflows/retell-custom-function-router-v2.json:366`
  (`typeNames`, EN) and `workflows/chat-booking-confirmation.json:20` (`TYPE_NAMES`, EN/HU/DE).
- **Retell** — sync the `appointment_type` enum on `check_availability`, `book_appointment` and
  `list_available_providers` from clinic config. Model this on
  `workflows/scripts/retell-add-language.mjs`, which already does an idempotent SDK round-trip to
  patch a tool param enum. Push the rendered prompt, then **publish**.
- Update `docs/retell-custom-functions.md` and `docs/onboarding-new-clinic.md` (§"Known limits" — the
  "appointment types are a Prisma enum change, not config" entry is now false).

---

## Rollout order

1. Steps 0–5 on a branch; verify locally against both clinic configs.
2. Back up each database (`scripts/backup-db.sh`) — non-negotiable, these hold encrypted patient PII.
3. Per stack, in order **sunshinedev → corona prod → sunshine prod**: run the ALTER, deploy, smoke test.
4. Step 6 per clinic once its stack is healthy.

## Verification

1. `pnpm check-types` and `pnpm test` clean across the workspace.
2. **Slot parity** — the real regression check. Diff `GET /api/calendar/slots` output for every
   service × seeded provider on a seeded day against the Step 0 baseline: **identical** for both
   clinics with `slotIntervalMinutes` unset.
3. **Prompt snapshot** — `buildChatSystemPrompt(today, clinic)` for `sunshine` and `corona` differs
   from the Step 0 baseline only in the generated service block. Reviewed by eye once, then frozen as
   a committed snapshot.
4. **Booking end-to-end** — book and cancel a 45-min (`FILLING`) and a 90-min (`CROWN_PREP`)
   appointment via `POST /api/appointments`; confirm `durationMinutes` persists with
   `appointmentType` now `String`, and that the GET/list response schemas accept it.
5. **Rejects unknown types** — `POST /api/appointments` with `appointment_type: "ROOT_CANAL"` returns
   a clean 400, not a 500 or a silent 30-minute booking.
6. **Prove the restriction is gone** — temporarily add a `ROOT_CANAL` service to the Corona config
   only, and confirm: it appears in Corona's dropdown, prompt and chat tool enum; it is bookable with
   its own duration; **no** Prisma migration is needed; and Sunshine is entirely unaffected. Revert.
7. **R3** — set `slotIntervalMinutes: 15` on a scratch config and confirm slots appear on quarter
   hours; unset restores the baseline exactly.
8. **Chat smoke test** — one HU conversation through `/api/chat` that books and cancels, confirming
   the tool enum is built correctly and the HU register survived the prompt split.
9. **Cross-tenant check** — boot `CLINIC_ID=corona` and confirm no Sunshine services or facts leak
   (the check already in `docs/onboarding-new-clinic.md`); an unknown `CLINIC_ID` and a malformed
   service code both still throw at boot.
10. **Post-deploy, per clinic** — a real booking through the voice agent and through chat, and confirm
    the confirmation email shows a properly localized service name.
