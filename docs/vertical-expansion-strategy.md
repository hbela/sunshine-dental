# Vertical Expansion — Decision & Enabling Refactors

> **Status:** Decision record + planned refactors. Forward-looking — no prospect exists in any
> non-dental vertical yet.
> **Date:** 2026-07-26
>
> **Update 2026-08-18 — the voice channel was retired.** Hungarian voice never reached
> acceptable quality; Hungarian *chat* did, and the customer is happy with it. This does not
> change the decision below — if anything it sharpens it. The argument was always that the
> domain-tuned Hungarian prompt is the moat and the booking engine is the commodity; losing
> the channel that couldn't carry that prompt, while keeping the one that could, is that
> argument playing out. References to the voice prompt below are left as written where they
> record *why* a refactor happened, and updated where they describe how things work now.

## Context

Two clinics are live (Sunshine, Corona) on the `CLINIC_ID` per-stack model. The backend is
effectively identical between them; the genuinely clinic-specific asset is the receptionist
prompt. The open question: do we extend this app to cover hospitals, town halls, and MOT/vehicle
inspection centres, or build a separate app per vertical?

Because there is no prospect in those verticals yet, this document deliberately does **not** build
vertical abstraction. It records the decision, and plans only the refactors that **pay for themselves
on dental alone** and happen to leave the vertical door open.

---

## The short answer

**One codebase, never a fork — but don't generalize yet, and don't chase hospitals or town halls.**

Three separate claims, in order of importance:

### 1. Forking per vertical would be a mistake

The divergence surface is small and the shared surface is the expensive, risky part. Vertical-specific
code sits in exactly six places, none of them subsystems:

| Vertical-specific | Where |
|---|---|
| Service list + durations | `schema.prisma:160`, `appointment.schema.ts:3-21`, `chat.service.ts:70-78`, `locales/*/enums.json` (4 copies) |
| Dental prose + HU glossary | `apps/api/src/prompts/dental-pack.ts` + `chat-receptionist.ts` |
| `FAQ_TOPICS` fixed 8-topic union | `packages/shared/src/clinic.ts:37-46` |
| `Patient` naming | ~1496 identifier occurrences (cosmetic) |
| HU-only phone validation | `packages/shared/src/phone.ts` |
| Branding / repo name | cosmetic |

Everything else is already domain-neutral: `calendar.service.ts` (337 lines of slot computation with
zero dental knowledge), `CalendarEvent`/`CalendarDelegation`/recurrence, the agent tool contracts,
the `ClinicConfig` registry + `getClinic()`, i18n interpolation, auth/RBAC, AES-256-GCM field
encryption + key custody, backup/DR, and the whole onboarding runbook. A fork duplicates precisely
the parts that took months and carry the real risk (crypto, key ceremony, DR), and multiplies every
security patch by N — untenable for a solo/small team.

### 2. The horizontal bet already exists, and it isn't what sells

`c:\devs\prods\booking-for-all` is a production-grade, multi-tenant, self-serve B2B booking SaaS with
Stripe subscriptions, owner roles, and EN/HU/DE — built, then set aside (last commit 2026-06-05; all
2026-07 work is in this repo). The thing that made this product sellable is **not** the booking
engine — there are already two of those. It's the domain-tuned Hungarian AI receptionist and the
reference customers.

That inverts the intuitive framing. The receptionist prompt isn't the small leftover bit; it's the moat.
Generalizing the backend generalizes the commodity. Going wide dilutes the one asset that
differentiates.

### 3. The right second vertical is the one where the *prompt* transfers, not the schema

Ranked by how much of the hard-won asset carries over:

| Vertical | Verdict |
|---|---|
| **Adjacent private healthcare** — GP, dermatology, physio, aesthetic, veterinary | **Best next move.** Reuses the HU medical register, formality rules, `Patient` model, all 8 FAQ topics, safety escalation. Needs the service-list refactor and a new glossary section — near-zero new code. Same buyer profile, same sales motion, same price point. |
| **MOT / vehicle inspection** | Technically a *strict subset* (single resource pool, no PII sensitivity, no medical escalation, no departments). Cheap to build after the refactors below. But the prompt asset transfers ~0%, and HU inspection stations are largely walk-in, price-competitive, low-margin — validate demand before writing a line. |
| **Town hall / city hall** | Adds departments (services scoped to a department, routing step in the agent) — a real but bounded change. The blocker is commercial: central-government booking in Hungary is already consolidated on `idopontfoglalo.kormany.hu`, so the addressable buyer is a budget-constrained municipality buying through public procurement. |
| **Hospitals** | **Don't.** Similar backend, entirely different company. EESZT integration is mandatory for HU healthcare providers; tenders run 6–18 months; IT security review and on-prem demands are routine; anything triage-adjacent edges toward MDR. The adjacent move is larger *private* medical groups, not public hospitals. |

---

## What to do now — three refactors, each justified by dental alone

None of these mention verticals in their rationale. That's the test they had to pass.

### R1 — Services become data, not a Prisma enum *(the big one)*

**Dental-only justification:** Sunshine and Corona cannot have different service lists or durations
today. `AppointmentDurations` is a module-level constant, and the type list is a shared Prisma enum —
so a clinic that offers implant consults or orthodontics needs a schema migration affecting *every*
clinic's stack. Already recorded as a known limit in `docs/onboarding-new-clinic.md:232-245`
("a Prisma enum change + prompt work, **not** config").

**Approach — config, not a DB table.** Mirror the existing FAQ pattern exactly:

- Add to `ClinicConfig` (`packages/shared/src/clinic.ts`):
  ```ts
  services: readonly {
    code: string;                              // 'CLEANING' — stays the wire value
    durationMinutes: number;
    labels: { en: string } & Partial<Record<ClinicLanguage, string>>;
  }[];
  ```
  Keeps compile-time checking via `satisfies ClinicConfig`, needs no admin UI. A DB-backed service
  table is Path B work (`docs/business-model.md:41-48`) — not now.
- `schema.prisma:160-168`: `enum AppointmentType` → `appointmentType String`. Existing rows already
  hold exactly these strings, so it is a widening migration with no data rewrite.
- `packages/shared/src/schemas/appointment.schema.ts`: replace the static `z.enum` and
  `AppointmentDurations` with clinic-aware helpers (`serviceCodes(clinic)`, `durationFor(clinic, code)`).
- `apps/api/src/services/calendar.service.ts:102` and `appointment.service.ts:128`: read duration
  from the clinic config instead of the constant.
- `apps/api/src/services/chat.service.ts:70-78`: build the tool enum from `clinic.services` at
  prompt-build time (it is already per-process via `lib/clinic.ts`).
- `apps/web/src/locales/*/enums.json`: labels now come from `clinic.services[].labels`; keep
  `useEnum.ts` as the fallback path for unknown codes.
- Seed both existing clinics with their current 7 services so behaviour is byte-identical.

### R2 — Split the prompt into a scheduling core + a domain pack

**Dental-only justification (as written 2026-07-26):** the chat prompt and the voice prompt were
hand-maintained twins that already drifted — the voice one was still telling Hungarian callers to
dial 911. The same hard-won HU register rules were written twice, and per-clinic prompt production
was ordered string substitution with an explicit *"the remaining 10% is yours"* caveat.

**Done.** `scheduling-core.ts` + `dental-pack.ts` exist and the prompt is composed from them, with a
committed snapshot test per clinic. The voice half of the twin problem has since been removed
outright, but the composition is what makes a new clinic's prompt correct by construction, so it
earns its keep on its own.

**Approach:** in `apps/api/src/prompts/`, extract two composable pieces:
- `scheduling-core.ts` — tool contracts, date/timezone discipline, language detection + formal
  register (Ön/Sie), booking/cancel flows, tool-error handling, escalation mechanics.
- `dental-pack.ts` — the HU dental glossary (lines 58-72), service phrasing, new-patient documents
  (személyi ig./TAJ), and the medical-emergency escalation text (line 144).

`buildChatSystemPrompt()` becomes `core + pack + clinicFacts(clinic)`. The pack is the seam a vertical
would swap; today there is exactly one pack and that's fine. Lock behaviour with a snapshot test so
the composed output for `sunshine` matches the current string.

### R3 — Make the slot stride configurable

**Dental-only justification:** `calendar.service.ts:148` hardcodes `slotStart += 30`, so a 45-minute
filling can only ever be offered at :00 and :30 and gaps can't be packed. A clinic wanting 15-minute
granularity has no way to ask for it.

**Approach:** add `slotIntervalMinutes?: number` to `ClinicConfig` (default `30`), read it in
`getAvailableSlots`. One config field, one line changed.

---

## What to explicitly NOT do

- **`Patient` → `Person`/`Customer` rename.** ~1496 occurrences touching encrypted fields, the HMAC
  blind index, API contracts, i18n keys, and the chat tool parameters. Real regression risk,
  zero customer value. If a non-medical customer ever needs it, change the **i18n layer only** — the
  UI label already flows through `apps/web/src/locales/*` and `interpolation.defaultVariables`.
- **Departments / resource groups.** Cheap once R1 lands (`Service.departmentId` + `Provider.departmentId`
  + one routing step in the prompt). Build it when a multi-department customer signs, not before.
- **Genericizing `FAQ_TOPICS`.** The 8 topics fit every healthcare clinic. Revisit with vertical #2.
- **Internationalizing `phone.ts`.** Entangled with the HMAC blind index — changing normalisation
  invalidates existing indexes. Only when leaving Hungary, and with a re-index plan.
- **Path B multi-tenancy.** `docs/business-model.md` already sets the trigger at ~10–15 clinics. Nothing
  here changes that.
- **Renaming the `HKDF_SALT` / `KEYCHECK_PLAINTEXT` "sunshine" constants** in `apps/api/src/lib/crypto.ts`
  — they are cryptographic domain separators; renaming strands all existing ciphertext.
- **Renaming the repo now.** The brand is already domain-neutral (`appointer.hu`, `appointer-console`).
  A git rename is cheap whenever it's actually needed.

---

## Verification

1. `pnpm check-types` clean across the workspace.
2. **Behaviour-identical check (the point of R1–R3):** seed a scratch DB for each clinic
   (`CLINIC_ID=sunshine` / `corona`, `pnpm exec tsx prisma/seed.ts --minimal`) and confirm the 7
   services, durations, and seeded availability match production today.
3. **Slot parity:** call `GET /api/calendar/slots` for each appointment type and provider on a seeded
   day, before and after, and diff the slot arrays — must be identical with `slotIntervalMinutes`
   unset.
4. **Booking end-to-end:** book + cancel via `POST /api/appointments` for a 45-min and a 90-min type;
   confirm `durationMinutes` persists correctly with `appointmentType` now a `String`.
5. **Prompt snapshot:** assert `buildChatSystemPrompt(today, sunshine)` equals the pre-refactor string
   (modulo the date), then eyeball the `corona` output for residue.
6. **Chat smoke test:** one HU conversation through `/api/chat` that books and cancels — confirms the
   tool enum is still built correctly and the HU register survived the prompt split.
7. **Cross-tenant check:** boot `CLINIC_ID=corona` against the Sunshine DB and confirm nothing leaks
   the other clinic's services or facts (the check already in `docs/onboarding-new-clinic.md`).
8. Verify an unknown `CLINIC_ID` still throws at boot (`clinic.ts:193-203`).
