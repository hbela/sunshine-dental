# Split User `name` into `title` + `givenName` + `familyName`

## Context

A Retell call failed because a patient asked for a doctor by name and the
provider lookup couldn't match. The root cause: the app stores a doctor's whole
name in a single `User.name` string (with the honorific baked in, e.g.
`"Dr. Ibolya Nagy"`), and every provider lookup is a **substring** match:

```ts
where: { user: { name: { contains: providerName, mode: 'insensitive' } } }
```
(`calendar.service.ts:87`, `appointment.service.ts:108`)

Substring matching is **order-sensitive**. In English a patient says
"Dr. Ibolya Nagy" (given → family); in Hungarian the same doctor is
"Dr. Nagy Ibolya" (family → given). Whichever order isn't stored fails to match.
The seed data already mixes both orders (`seed.ts:42` Western, `seed.ts:43`
Hungarian), so this is a live bug.

**Goal:** split the user's name into structured `title` / `givenName` /
`familyName` fields, make provider lookup **token-aware** (matches regardless of
order), and render names **locale-aware** (Hungarian family-first, EN/DE
given-first). The Retell/chat/n8n wire format (`provider_name` as a free-text
string) stays unchanged — the fix is server-side matching plus display.

### Decisions (confirmed with user)
- **Honorific** → new optional `User.title` field ("Dr.").
- **Scope** → `User` (doctors/staff) only. `Patient.name` is left untouched.
- **Backfill** → best-effort auto-split in the migration + manual correction in
  the admin panel; dev DB reseeded with explicit values.

### Key constraint
`User.name` is owned by better-auth (`schema.prisma:11` "Required by better-auth
— do not rename"). We **keep `name`** as a derived, canonical fallback string
and **add** the three new columns. `signUpEmail`/session still work; the UI uses
the structured fields for locale-aware display.

---

## Implementation

### 1. Schema + migration — `apps/api/prisma/schema.prisma`
Add to the `User` model (keep `name`):
```prisma
name       String            // kept: better-auth-owned canonical fallback
title      String?           // honorific, e.g. "Dr."
givenName  String  @default("")
familyName String  @default("")
```
Create a migration (`prisma migrate dev --name split_user_name`). In the
migration SQL, **backfill** existing rows best-effort:
- `title` = leading honorific token if the name starts with `Dr.`/`Dr`, else NULL.
- Remaining tokens after the honorific: first token → `givenName`, rest →
  `familyName` (Western assumption). Admins fix any wrong ordering afterward.

Use `@default("")` so the columns are non-null without a manual default step;
the form makes both required going forward.

### 2. better-auth additional fields — `apps/api/src/lib/auth.ts`
Register the new fields so they are accepted on sign-up and returned in the
session:
```ts
user: {
  additionalFields: {
    title:      { type: 'string', required: false },
    givenName:  { type: 'string', required: false },
    familyName: { type: 'string', required: false },
  },
},
```
(Add alongside the existing `admin`/`emailAndPassword` config.)

### 3. Shared name helpers — new `apps/api/src/lib/name.ts`
Two small pure functions, reused by API + seed (and mirrored in web):
- `canonicalName({ title, givenName, familyName })` → `"Dr. Ibolya Nagy"`
  (Western order; used to populate `User.name`).
- `nameMatchWhere(query: string)` → a Prisma `where` fragment that tokenizes the
  query (strip honorific tokens `Dr`/`Dr.`), and requires **every** remaining
  token to appear in `givenName` OR `familyName` (case-insensitive `contains`).
  Example shape:
  ```ts
  AND: tokens.map(tok => ({ user: { OR: [
    { givenName:  { contains: tok, mode: 'insensitive' } },
    { familyName: { contains: tok, mode: 'insensitive' } },
  ] } }))
  ```
  This matches "Nagy Ibolya" and "Ibolya Nagy" identically.

### 4. Provider lookup — make token-aware (the actual fix)
Replace the duplicated `contains`-on-`name` blocks with `nameMatchWhere`:
- `apps/api/src/services/calendar.service.ts:85-89` (`getAvailableSlots`).
- `apps/api/src/services/appointment.service.ts:106-110` (`book`).

Keep returning a display string for `provider_name` — set it to
`canonicalName(provider.user)` (or keep `provider.user.name`, which we now keep
in sync). No change to the return-shape keys, so n8n/Retell stay compatible.

### 5. Admin create-user path — `apps/api/src/routes/admin.routes.ts`
- `CreateUserBody` zod: replace `name` with `givenName` + `familyName` (both
  `min(1)`) and optional `title`.
- Before `auth.api.signUpEmail`, compute `name = canonicalName(...)` and pass
  `title/givenName/familyName` through the better-auth body (now allowed via
  additionalFields). Response schema + `select` include the new fields.
- GET `/api/admin/users` `select` (line 124): add `title, givenName, familyName`.

### 6. Other API surfaces
- `apps/api/src/routes/users.routes.ts` — add fields to `select`; change
  `orderBy: { name: 'asc' }` → `orderBy: [{ familyName: 'asc' }, { givenName: 'asc' }]`.
- `apps/api/src/routes/providers.routes.ts:10,42,48` — select the new fields;
  return `name: canonicalName(p.user)` (keep the existing `name` key so the web
  provider dropdown keeps working), and additionally expose `title/givenName/
  familyName` for locale-aware rendering.

### 7. Seed — `apps/api/prisma/seed.ts:40-53`
Change the user list to structured fields, e.g.
`{ title: 'Dr.', givenName: 'Ibolya', familyName: 'Nagy', ... }`, and set
`name: canonicalName(u)` when calling `signUpEmail`. Appointment rows
(`seed.ts:229-232`) use `canonicalName(aliceUser)` for `providerName`.

### 8. Web — form, types, display
- **Form** `apps/web/src/routes/_auth/admin/users.tsx`: split the single Name
  input into Given name + Family name inputs (+ optional Title); update
  `CreateValues`, the zod schema (L167-175), and the submit payload (L191-203).
  Table (L109) renders via the new display helper.
- **Hooks/types**: `useAdminUsers.ts` (`AdminUser`, `CreateUserInput`,
  `CreateUserResult`), `useUsers.ts` (`DirectoryUser`), `useProviders.ts`
  (`ProviderListItem`) — add `title?/givenName/familyName`, keep `name`.
- **Display helper** new `apps/web/src/lib/name.ts`:
  `displayName({ title, givenName, familyName }, locale)` → HU: `title família
  given`; EN/DE: `title given família`. Use i18n current language for `locale`.
  Replace the buggy `firstName()` in `apps/web/src/routes/_auth/index.tsx:18`
  with a direct `givenName` read. Apply `displayName` in `AppLayout.tsx:115`,
  `DentalCalendar.tsx:203`, `DelegationsSection.tsx`, `settings.tsx`, and the
  provider/appointment pickers.
- **Settings** `settings.tsx:34-86` (AccountSection): edit Given/Family/Title
  instead of a single Name; keep using `authClient.updateUser` (now with the
  additional fields), deriving `name` client-side or letting better-auth store
  them.

### 9. i18n — `apps/web/src/locales/{en,de,hu}/{admin,settings}.json`
Add keys: `columns.givenName` / `columns.familyName` / `columns.title` and
matching `validation.givenNameRequired` / `validation.familyNameRequired`.
HU: Keresztnév / Vezetéknév / Megszólítás. DE: Vorname / Nachname / Titel.

### 10. Prompt/doc text that assumes an order (small edits)
- `docs/retell-agent-prompt.md:140` — confirmation "scheduled with Dr. [Last
  Name]" → use the full doctor name (or note that order follows the call
  language). `docs/retell-agent-prompt.md:44` already says "names stay as-is".
- `apps/api/src/prompts/chat-receptionist.ts` — no hardcoded order; leave as-is.
- n8n workflows (`workflows/retell-custom-function-router-v2.json`,
  `chat-booking-confirmation.json`) print `provider_name` as returned by the API
  — no change needed since the API still returns a formatted string.

---

## Verification

1. **Migration + reseed (dev DB):** `pnpm --filter api prisma migrate dev` then
   the seed. Confirm `User` rows have populated `title/givenName/familyName` and
   a canonical `name`.
2. **Token matching (the bug):** call the slots API both ways and confirm both
   resolve the same provider:
   - `GET /api/calendar/slots?date=<weekday>&appointment_type=CONSULTATION&provider_name=Nagy%20Ibolya`
   - `...&provider_name=Ibolya%20Nagy`
   - `...&provider_name=Dr.%20Nagy` (single token still works)
   Then `POST /api/appointments` with `provider_name: "Nagy Ibolya"` and confirm
   it books.
3. **Chat receptionist:** via `/chat`, ask "Van szabad időpont Dr. Nagy
   Ibolyánál?" and confirm availability resolves (reuses the same service).
4. **Retell (optional):** run a sim/live call via the retell-mcp asking for a
   doctor in Hungarian family-first order; confirm booking succeeds and the
   post-call/confirmation email shows the doctor name.
5. **Web UI:** admin → Create User with Given/Family/Title; verify it appears in
   the list, provider dropdown, and calendar. Switch language HU↔EN and confirm
   the greeting + sidebar render the correct order (HU family-first). Confirm the
   dashboard greeting shows the given name for a Hungarian-ordered doctor (the
   old `firstName()` bug).
6. `pnpm typecheck` / `pnpm verify` (per repo scripts) across api + web + shared.
7. **Prod backfill:** after deploy, review the auto-split provider rows in the
   admin panel and correct any mis-ordered given/family values by hand.
