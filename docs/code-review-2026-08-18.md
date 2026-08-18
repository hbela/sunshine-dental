# Code Review — Sunshine Dental Platform

**Date:** 2026-08-18
**Scope:** Full monorepo — `apps/api`, `apps/web`, `packages/*`, `scripts/`, `workflows/`, `docker-compose.yml`, build/lint/test/CI configuration.
**Method:** Static review only. No application code was modified. Secret values are referenced by location and variable name only — none are reproduced here.
**Branch:** `feat/retire-voice-agent` (post voice-agent retirement; chat is the only patient-facing channel).

---

## 1. Executive summary

This is a thoughtfully designed, small, readable codebase with several genuinely strong engineering choices: application-layer AES-256-GCM encryption at rest for patient PII with an admin-custody keyring, HMAC blind indexing for phone lookup, an excellent encrypted-offsite backup script, clean git hygiene for secrets (no `.env` ever committed), full three-language i18n key parity, and a TypeScript-strict frontend with no `any` escapes.

However, the review found **three critical vulnerabilities** that are each independently exploitable against a deployed stack, plus a cluster of high-severity issues around PHI handling in logs, booking integrity, and PHI persistence in the browser. Most critically, **two of the criticals are one-line fixes** and a basic integration test suite would have caught all three.

The single biggest process gap: **there is no CI, no linting on the API, and no frontend tests** — so nothing automated stands between a bad change and production for a system that stores patient health data.

**Top 3 actions (do first):**

1. Close public self-registration (`disableSignUp: true`) — anyone on the internet can currently create a staff account with full patient-data access.
2. Make API-key auth fail closed when `FASTIFY_API_KEY` is unset/empty — today the check silently passes and every machine endpoint is unauthenticated.
3. Put authentication on the n8n booking-confirmation webhook — it is currently an unauthenticated email relay that sends clinic-branded mail from the clinic's Gmail to any address.

---

## 2. What this system is

| Component | Tech | Role |
|---|---|---|
| `apps/api` | Fastify 5, Prisma 6 → PostgreSQL, better-auth, Zod, Sentry | Staff REST API + patient chat (Claude SSE) + auth |
| `apps/web` | Vite 7 SPA, React 19, TanStack Router/Query, Tailwind 4, i18next (en/hu/de), PWA | Staff dashboard + public patient chat widget |
| `packages/shared` | TS (no build step) | Clinic config registry, phone utils, shared Zod schemas |
| `packages/video-generator` | Remotion + Playwright + OpenAI TTS | Marketing-video tooling (not production-critical) |
| `packages/eslint-config`, `packages/typescript-config` | — | Shared configs (eslint-config is **unused**, see P2) |
| `workflows/` | n8n JSON | One remaining workflow: booking-confirmation email |
| `scripts/` | bash/Dockerfile | Encrypted nightly offsite backups |
| Deploy | Coolify on Hetzner VPS, docker-compose, Traefik TLS | Prod + dev stacks |

Notable design: patient PII is encrypted at rest with a master key that is **not stored on the server** — an ADMIN unlocks the in-memory keyring after every boot (`POST /api/admin/unlock`), with a canary to prove correctness. This is a stronger custody model than most clinic software.

---

## 3. Strengths worth keeping

- **Encryption-at-rest design** (`apps/api/src/lib/crypto.ts`): AES-256-GCM, HKDF subkeys, key zeroing, canary-verified unlock, blind index for phone lookup. Well-built and well-tested (`crypto.test.ts`).
- **Backup pipeline** (`scripts/backup-db.sh`): `pipefail`, encrypted to a public key the server can't read from, offsite via rclone, refuses stub dumps (<10 KB sanity check), dead-man's-switch ping skipped on failure, loud warning when backups are local-only. This is genuinely good.
- **Git secrets hygiene:** verified `git log --all` — no `.env` file was ever committed; `.mcp.json` and `docs/transcripts/` (patient PII) are gitignored.
- **Frontend type discipline:** strict TS with `noUncheckedIndexedAccess`, typed i18n keys, zero `any`/`@ts-ignore` in `apps/web/src` and `packages/shared/src`.
- **XSS posture:** no `dangerouslySetInnerHTML`/`eval` anywhere; SSE error strings are mapped to generic translations, not rendered raw; Sentry runs with `sendDefaultPii: false`.
- **i18n:** 13 namespaces × 3 languages with verified key parity; clinic identity injected via interpolation instead of duplicated copy.
- **CORS is restrictive** (explicit origins + credentials), PWA service worker correctly excludes `/api`, Docker build of the web app is a proper multi-stage build with `--frozen-lockfile`.
- **No TODO/FIXME/HACK debt** in application source.

---

## 4. Critical findings

### C1 — Public self-registration creates staff accounts with full PHI access

`apps/api/src/lib/auth.ts:10-13, 25` + `apps/api/src/routes/auth.routes.ts:12-14` + `apps/api/prisma/schema.prisma:25`

```ts
emailAndPassword: { enabled: true, requireEmailVerification: false },
...
admin({ defaultRole: 'ASSISTANT', adminRoles: ['ADMIN'] }),
```

`disableSignUp` is never set (better-auth 1.5.2 supports it), so `POST /api/auth/sign-up/email` is open to the internet. Every new account gets `defaultRole: 'ASSISTANT'` (also the Prisma column default), which passes `requireRole(['ASSISTANT', ...])` on **patients, appointments, chat transcripts, and calendar endpoints**. User creation is supposed to be admin-only (`admin.routes.ts:118`); this bypasses it entirely. Anyone who finds the API can mint a staff login and read the patient database (once the keyring is unlocked — which it is during business hours).

**Fix:** `emailAndPassword: { enabled: true, disableSignUp: true, requireEmailVerification: false }`. One line.

### C2 — API-key authentication fails open when `FASTIFY_API_KEY` is unset or empty

`apps/api/src/middleware/auth.middleware.ts:30-34` (and same pattern at line 25)

```ts
const key = request.headers.authorization?.replace('Bearer ', '');
if (key === process.env.FASTIFY_API_KEY) { return; }
```

Plain `===` against `process.env`. If the env var is **unset**, `undefined === undefined` → every `requireAuthOrApiKey` endpoint (patient read/write, booking, cancel, calendar slots) is unauthenticated. If it is **empty** (what docker-compose produces when Coolify leaves the variable blank: `FASTIFY_API_KEY: ${FASTIFY_API_KEY}` → `""`), then `Authorization: Bearer ` with an empty token matches. Nothing validates the variable at boot — the server starts happily in a fully open state.

**Fix:** validate env at boot (fail to start if `FASTIFY_API_KEY` is missing/short), and require `key` to be non-empty before comparing; use `crypto.timingSafeEqual`.

### C3 — n8n booking-confirmation webhook is an unauthenticated email relay

`workflows/chat-booking-confirmation.json` (webhook node has no `authentication` parameter) + `apps/api/src/services/chat.service.ts:52-62`

The API POSTs `{ patient_name, email, date, time, provider_name, appointment_type, is_new_patient, language }` to `N8N_BOOKING_WEBHOOK_URL` with **no auth or signing header**, and the n8n webhook accepts unauthenticated POSTs, then sends a fully-branded, localized "Appointment Confirmed" email **from the clinic's real Gmail account** to whatever `email` the POST contains. Anyone who learns the webhook URL (it is a guessable path on a documented host: `/webhook/chat-booking-confirmation`) can:

- send convincing phishing email from the clinic's own address to arbitrary victims, with attacker-controlled name/date/time/type, and
- probe/spam at no cost.

The payload also carries patient PII over an unauthenticated channel. **Fix:** add header auth on the n8n webhook (n8n supports it natively) and send a shared secret from the API; validate `email` and field lengths in the Code node.

---

## 5. High findings

### H1 — PHI flows through GET query strings into access logs

`apps/api/src/server.ts:12` (`Fastify({ logger: true })` logs full URLs including query strings) serving:
`apps/api/src/routes/patients.routes.ts:20-24` (`GET /api/patients?search=<name|phone>`), `appointments.routes.ts:20` (`patient_name=`), `calendar.routes.ts` (`provider_name=`); called from `apps/web/src/hooks/usePatients.ts:22-26` and `useAppointments.ts:20-23`.

Patient names/phones land in Fastify logs, nginx access logs, and Sentry fetch/XHR breadcrumbs. For a health-data system this is a GDPR exposure (PHI replicated into log storage with separate retention/access). **Fix:** redact query strings via Pino `redact`, or move name-based filters to POST bodies.

### H2 — Unhandled errors leak internal messages to clients; `sendError` swallows 500s silently

`apps/api/src/app.ts:36` (`reply.send(error)` serializes the raw `Error.message` — Prisma/Anthropic/crypto internals — into the 5xx response) and `apps/api/src/lib/errors.ts:18-23` (unknown errors mapped to a generic 500 **without any logging or Sentry**, so routes using `sendError` make server errors invisible to monitoring). Also, the global handler's coded-`HttpError` branch misses `HttpError`s constructed without a `code` (all 404s), which then fall through as Sentry noise. **Fix:** generic 500 body in the global handler; log+capture in `sendError`; treat `HttpError` uniformly.

### H3 — Double-booking race in appointment creation

`apps/api/src/services/appointment.service.ts:174-218`, no unique constraint on `(providerId, date, startTime)` in `prisma/schema.prisma:136-160`.

Classic check-then-act: `getAvailableSlots` → `prisma.appointment.create` with no transaction and no DB-level uniqueness. Two concurrent bookings (two chat users, or chat + staff UI) for the same slot both succeed. Related: find-or-create patient by `phoneIndex` is racy too (acknowledged in the schema: "legacy dupes possible"), and `book()` creates patient + appointment non-transactionally, leaving orphan patients on failure. **Fix:** partial unique index on active statuses + serializable transaction (or insert-and-catch-conflict).

### H4 — Chat bearer token + full patient transcript persisted in localStorage indefinitely

`apps/web/src/hooks/useChat.ts:17, 48-56`

```ts
const LS_KEY = 'sd.chat'
localStorage.setItem(LS_KEY, JSON.stringify({ ...s, messages: msgs }))
```

The resume token (a bearer credential authorizing posts to the conversation) and the entire message transcript — typically patient name, phone, email, and medical complaints — persist with no expiry, readable by any XSS payload and by the next user of a shared device (clinics share computers; patients use shared/family devices). **Fix:** sessionStorage or a TTL, or persist only id+token and re-fetch messages server-side.

### H5 — Calendar week view silently misses Sunday events for hu/de locales

`apps/web/src/lib/calendar-utils.ts:80-85` vs `apps/web/src/components/calendar/DentalCalendar.tsx:21-28`

react-big-calendar renders Mon–Sun for the Hungarian/German locales, but the fetch window is computed with date-fns defaults (`startOfWeek(date)` → **Sunday**). Events on the trailing Sunday fall outside the fetched range and are silently invisible in week view; month view can miss the last displayed day. For a booking app this is a double-booking amplifier (a slot that looks free isn't). **Fix:** pass `{ weekStartsOn }` from the active date-fns locale into `rangeForView`. A unit test of `rangeForView` would have caught this — see P3.

### H6 — Security-headers middleware installed but never registered; nginx serves no security headers

`apps/api/package.json:23` lists `@fastify/helmet`; nothing registers it. `apps/web/nginx.conf` sets no `Content-Security-Policy`, `X-Frame-Options`/`frame-ancestors`, `X-Content-Type-Options`, `Referrer-Policy`, or `Permissions-Policy`. Consequences: the staff app and public chat can be iframed anywhere (clickjacking), and there is no CSP second line of defense behind H4's localStorage token. **Fix:** register helmet on the API and add headers in nginx.

### H7 — Seeded admin password appears in multiple committed files

`apps/api/prisma/seed.ts:21,203` (`Admin1234!` — necessary for a seed), but also committed in `packages/video-generator/.env.example:3`. `docs/new-db-deploy.md:13` documents "change that seeded admin password on prod" — i.e., any deployed stack where that step was skipped has a publicly documented admin login. **Fix:** placeholder in `.env.example`; add a boot-time check that refuses to run with the seed password outside dev (or forces a password change on first login).

---

## 6. Medium findings

**API**

- **M1 — No global rate limiting.** Only hand-rolled in-memory limits on chat creation/messages (`chat.routes.ts:18-38`, and `convoMsgCount` is never pruned — slow memory leak). Nothing on `/api/auth/sign-in/email`, nothing on `/api/admin/unlock` (an online oracle for the 32-byte master key), nothing on booking. Add `@fastify/rate-limit`.
- **M2 — Unbounded `limit` on list endpoints** (`patients.routes.ts:23`, `appointments.routes.ts:22`, `chat.routes.ts:189`): `z.coerce.number().optional()` with no `.max()`; `limit=1000000` flows straight into Prisma `take` — cheap DoS / mass-exfiltration amplifier once authenticated.
- **M3 — Calendar write endpoints have no body validation** (`calendar.routes.ts:76-129`): body cast `as any`; invalid enum/`new Date(garbage)` → 500s on an authenticated write path.
- **M4 — PHI to third parties without call-site safeguards:** full decrypted transcripts to Anthropic for summarization (`chat.service.ts:466-478` — needs a DPA/BAA decision), booking PII to the n8n webhook (see C3).
- **M5 — API schema publicly disclosed in all environments:** Swagger at `/documentation` and better-auth's `openAPI()` plugin (`lib/auth.ts:26`). Gate behind auth or disable in prod.
- **M6 — Weak account policies:** no email verification, password policy only `min(8)`, non-timing-safe secret comparisons (`auth.middleware.ts:25,32`, `chat.service.ts:358`).
- **M7 — Silent truncation / unbounded includes:** patient search scans only the newest 2000 rows (results silently incomplete beyond the cap); patient detail includes **all** appointments unbounded.
- **M8 — Inconsistent error handling:** some routes use `sendError`, others rely on the global handler — which mishandles `HttpError`s without `code` (see H2). `calendar.routes.ts:29` matches errors by message string.
- **M9 — Stats timezone drift:** chat stats use UTC boundaries while the rest of the app anchors to `clinic.timezone`.

**Web**

- **M10 — Hand-rolled Dialog has no modal semantics or focus management** (`components/ui/dialog.tsx:38-64`): no `role="dialog"`, `aria-modal`, focus trap, initial focus, or focus restore. Every modal in the app inherits this (booking, patient record, delete confirms). Radix is already a dependency — use it.
- **M11 — Silent calendar fetch failures** (`DentalCalendar.tsx:136-147`): `isError` never checked; a failed events fetch renders an "empty" calendar, indistinguishable from "no availability".
- **M12 — Admin role change: instant, unconfirmed, silent on failure, self-lockout possible** (`admin/users.tsx:114-120`): fires on select change with no confirm and no `onError`; an admin can demote the only admin (themselves) in one misclick.
- **M13 — No code splitting:** the public `/chat` PWA (most performance-sensitive surface) downloads the whole staff app — react-big-calendar, Sentry, better-auth, all 39 locale JSONs. Lazy-load the `_auth` subtree and Sentry.
- **M14 — useChat impure state updaters** (`useChat.ts:85-99,152`): persistence driven from inside `setMessages` updaters; if the component unmounts mid-stream, `finally` can persist a stale/empty transcript over the good one. Track the transcript in a ref.
- **M15 — a11y:** off-canvas mobile nav stays focusable while hidden (`AppLayout.tsx:86-90`); unlabeled icon-only delete button and role select (`admin/users.tsx:114-133`); focus rings removed from text inputs (`ui/input.tsx:9`, `ui/select.tsx:10`, `ui/textarea.tsx:9`); validation errors not programmatically associated.
- **M16 — Browser-TZ ≡ clinic-TZ assumption** is load-bearing (dashboard "today", greetings, date parsing) and undocumented in the UI; fine on-site in Budapest, wrong for anyone checking from another timezone.
- **M17 — Booking form has no client-side guard** for past dates/outside availability (`AppointmentModal.tsx:201-218`) — relies entirely on API rejection.

**Packages / cross-cutting**

- **M18 — Calendar contract is triple-defined and drifting:** shared `CalendarEventSchema` (`packages/shared/src/schemas/entities.schema.ts:57-81`) has **zero consumers**; the API calendar routes have no request/response validation; the web hand-maintains a divergent copy (`useCalendar.ts:4-28`). The one entity with no validation anywhere has three divergent definitions.
- **M19 — `"latest"` dependency tags** across `apps/api` and `apps/web` (`better-auth`, `@fastify/*`, `@tanstack/*`, `axios`, …): reproducibility rests entirely on the lockfile; any fresh install floats. Pin versions.
- **M20 — Docker/API:** runs as root (no `USER`); `prisma db push` on every boot (schema-drift risk vs. the `migrations/` directory); base image `node:22-slim` unpinned; single-stage image ships devDependencies (tsx) to prod (a deliberate trade-off for `@repo/shared` exporting raw TS — fine, but document that `tsc && node dist` is broken by design or give shared a build step).
- **M21 — n8n email copy hardcodes Sunshine branding/phone and duplicates the appointment-type names** from shared clinic config — a second clinic on the shared n8n instance would send "Sunshine Dental Clinic" mail unless every copy is hand-edited. Also the Gmail OAuth credential is Testing-mode and **expires ~weekly** (documented in `workflows/CLAUDE.md`), so confirmation emails silently stop unless refreshed — the failure mode of the one remaining workflow.
- **M22 — Stale voice-era references** remain in `apps/api/.env.example:28,32` and the workflow sticky note ("the voice flow emails from its own router node", "dashboard, voice booking"), plus `design/stitch/` still ships `06-call-logs` screens. Post-retirement cleanup was good in code, incomplete in comments/assets.
- **M23 — turbo.json is stale:** `build.outputs` is `.next/**` (Next.js) but the web app is Vite (`dist/**`) and the API's build is unused by Docker — so `turbo build` caches nothing useful.

---

## 7. Low findings (abridged)

- Dead code: `requireApiKey` (unused), `ACTIVE_STATUSES` duplicated inline, FAQ route self-described as dead, `apps/web/src/App.tsx`+`App.css` (Vite scaffold remnants), `usePatientAppointments` (no call sites), `comingSoon` locale keys ×3 languages, unused deps (`nodemailer`, `bcryptjs`, `@fastify/sensible`, `@fastify/helmet`).
- 48 `as any`/`: any`/`@ts-ignore` in the API across 16 files — worst: `request.user` via `@ts-ignore` instead of Fastify module augmentation; route bodies cast `as any`, defeating the Zod inference the schemas exist for.
- Duplication: appointment `serialize()` verbatim in two services; `Row` component ×3; pagination footer ×3; `statusVariant`/`sentimentVariant` ×2; `BadgeVariant` type ×3.
- Double polling: `useEncryptionStatus` + `useExpectedKeyFingerprint` both hit `/api/health` (2 req/min/client); duplicate session fetch on every guarded navigation.
- i18n nits: `openMenu`/`closeMenu` keys missing (always English); dashboard date ignores UI language; `auth.emailPlaceholder` leaks `sunshine.dental` into every clinic's bundle; Hungarian accusative suffix concatenation breaks vowel harmony for other clinic names.
- Repo hygiene: `.claude/settings.local.json` (contains the seed admin credential in an allow-rule) is kept out of git only by a **user-global** ignore, not the repo's `.gitignore`; add it to the repo file. Same for `.commandcode/`.
- `/api/health` publicly exposes keyring lock state + key fingerprint (commented as intentional; mild recon value).
- `nginx.conf`: `proxy_read_timeout 60s` on `/api/` — verify SSE chat streams can't idle longer than 60 s between chunks (heartbeats), or long generations get cut.
- `docs/transcripts/` (retired voice-agent PII) is gitignored but still on disk locally — schedule secure deletion per the retention policy.

---

## 8. Process & tooling gaps

These matter as much as any single bug — two of the criticals would have been caught by basic automation:

- **P1 — No CI.** No `.github/` (or equivalent) at all. No automated build/test/lint gate on changes.
- **P2 — Lint coverage is an illusion.** `turbo run lint` lints only `apps/web`. `apps/api`, `packages/shared`, `packages/video-generator` have no lint script; `@repo/eslint-config` is a dead package nothing extends — and it bundles `eslint-plugin-only-warn`, which would make lint unfailable even if adopted.
- **P3 — No frontend tests; thin backend tests.** `apps/web` has zero tests (the week-start bug H5 and the SSE parser are pure functions — trivially testable). `apps/api` has 4 unit test files (crypto, slots, services, prompts — all good) but **no HTTP/integration tests**: auth middleware (C1/C2), role checks, and the booking race (H3) are entirely untested.
- **P4 — No env validation at boot.** Only `CLINIC_ID` is validated; `DATABASE_URL`, `BETTER_AUTH_SECRET`, `FASTIFY_API_KEY`, `WEB_ORIGIN` are read ad-hoc. C2 is the direct consequence. A Zod-validated env module would prevent the whole class.
- **P5 — Orphaned configs mislead.** `apps/web/tsconfig.app.json`/`tsconfig.node.json` carry stricter flags that are not in effect (nothing references them); `typescript-config` ships a `nextjs.json` preset for a repo with no Next app.
- **P6 — README is the Turborepo starter boilerplate**, not the project. New-maintainer onboarding starts from docs/*.md instead (which are good), but the front door misrepresents the repo.

---

## 9. Prioritized recommendations

| # | Action | Effort | Addresses |
|---|---|---|---|
| 1 | `disableSignUp: true` in better-auth config | 1 line | C1 |
| 2 | Boot-time env validation (fail closed) + non-empty, timing-safe API-key check | ~½ day | C2, P4 |
| 3 | Header auth on the n8n webhook + send the secret from the API; validate email in the Code node | ~½ day | C3, M4 |
| 4 | Unique constraint + transaction for bookings; same for patient find-or-create | 1 day | H3 |
| 5 | Redact query strings from Fastify logs; generic 500 body; log in `sendError` | ~½ day | H1, H2, M8 |
| 6 | localStorage → sessionStorage/TTL for chat token+transcript (or server-side resume) | ~½ day | H4 |
| 7 | Register helmet (API) + security headers in nginx | 1 hour | H6 |
| 8 | Fix `rangeForView` week-start; add unit tests for `calendar-utils` | ~½ day | H5, P3 |
| 9 | Add CI: build + check-types + lint + test on PRs; give api/shared a lint config (without `only-warn`) | 1 day | P1, P2 |
| 10 | Rotate anything that ever touched a shared machine/tunnel: Anthropic key, OpenAI key, DB creds, master key (env files are clean in git, but they live in plaintext on a dev box that was once behind a public ngrok URL) | 1 hour | C3-adjacent ops hygiene |
| 11 | Cap `limit` on list endpoints; add `@fastify/rate-limit` on auth/unlock/booking | ~½ day | M1, M2 |
| 12 | Radix-based Dialog; error states on calendar queries; confirm+error handling on role change | 1 day | M10–M12 |
| 13 | Code-split the staff app out of the public chat bundle | ~½ day | M13 |
| 14 | Resolve the calendar contract: wire shared schemas into api+web or delete them; validate calendar bodies | 1 day | M3, M18 |
| 15 | Replace seed-password copies in committed files; boot-time guard against seed creds in prod | 1 hour | H7 |

---

## 10. Conclusion

The codebase's bones are good — the encryption custody model, backup design, and i18n/type discipline show real care. The risk is concentrated in a small number of auth/exposure mistakes (C1–C3) that are cheap to fix, and in the absence of automation that would keep them fixed. Closing the three criticals, adding boot-time env validation, and standing up a minimal CI gate with a handful of integration tests around auth and booking would move this from "demo-quality with production data" to a defensible production posture for a health-data system.

*Review produced with automated codebase exploration; all critical and high findings were verified against the source (file/line references included). Findings are static-analysis results — runtime behavior (e.g., deployed env values) should be confirmed against the Coolify stacks before remediation sign-off.*
