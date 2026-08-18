# Onboarding a second clinic (Corona Dental) — intake + infrastructure replication

## Context

Today the product is **single-tenant by construction**: one Prisma schema with no
`Clinic` model, one Retell agent, one n8n workflow set, one Coolify stack per
*environment* (prod `sunshine.appointer.hu` + dev `sunshinedev.appointer.hu`).
Clinic identity is **hardcoded in ~10 places** across API prompts, web locales,
the Vite PWA manifest, the seed and the n8n FAQ node.

A second paying clinic (Corona Dental) is exactly the "Path A — managed
single-tenant" model already costed in [business-model.md](business-model.md)
(~2–6 h per clinic once the playbook exists). The goal of this plan is therefore
twofold:

1. **Stop hardcoding "Sunshine"** — move clinic facts into a per-clinic config
   file selected by one env var, so `main` deploys any clinic without a fork.
2. **Write the runbook + intake form** so clinic #3 is a checklist, not a project.

Decisions taken up front: parameterize the code *and* write the runbook; **reuse
`n8nprod.appointer.hu`** with duplicated workflows on clinic-scoped webhook
paths; give Corona a **dedicated Retell agent + LLM** cloned from Sunshine's;
host at **`corona.appointer.hu`** with a Retell-bought US test number first,
+36 SIP later.

---

## What is clinic-specific today (inventory)

| Surface | File | Today |
|---|---|---|
| Chat receptionist prompt | [../apps/api/src/prompts/chat-receptionist.ts](../apps/api/src/prompts/chat-receptionist.ts) | name, Budapest, hours, address, 112, new-patient docs |
| Chat timezone | [../apps/api/src/services/chat.service.ts:31](../apps/api/src/services/chat.service.ts#L31) | `Europe/Budapest` literal |
| OpenAPI title | [../apps/api/src/plugins/openapi.plugin.ts:13](../apps/api/src/plugins/openapi.plugin.ts#L13) | "Sunshine Dental Clinic API" |
| Seed users/providers/demo data | [../apps/api/prisma/seed.ts](../apps/api/prisma/seed.ts) | `*@sunshine.dental`, Dr. Nagy / Dr. Kis, 3 fake patients, 3 fake call logs |
| Browser title | [../apps/web/index.html:7](../apps/web/index.html#L7) | "Sunshine Dental Clinic" |
| PWA manifest | [../apps/web/vite.config.ts:27-30](../apps/web/vite.config.ts#L27-L30) | name, short_name, description, theme colour |
| UI strings | `apps/web/src/locales/{en,hu,de}/{common,auth,chat}.json` | `appName`, `title`, chat greeting, install prompt |
| Icons | [../apps/web/public/](../apps/web/public/) | favicon.svg, apple-touch-icon, 3 PWA pngs |
| Voice FAQ facts | `workflows/retell-custom-function-router-v2.json` → **FAQ Handler** node | 8 topics × 3 languages: hours, services, insurance (Generali/Medicover), emergency phone, cancellation fee, location, payment |
| Confirmation e-mails | same file + `chat-booking-confirmation.json` | clinic name in EN/HU/DE subject + body; manager summary recipient |
| Voice agent | Retell `agent_0c73886e96f6cf2ad878def30e` / `llm_9144fb5e818b3d841e18ab084b99` | prompt, greeting, voice, `{{backend_base_url}}` dynamic var |

**Do not touch:** `HKDF_SALT` / `KEYCHECK_PLAINTEXT` / key-fingerprint prefix in
[../apps/api/src/lib/crypto.ts](../apps/api/src/lib/crypto.ts#L30-L46). They read
"sunshine" but are **cryptographic domain constants** — changing them strands
every existing ciphertext. Isolation already comes from a per-stack master key.

---

## Phase 0 — Intake: what we need from Corona Dental

Deliverable: **`docs/clinic-intake-form.md`** (a fill-in questionnaire we send the
customer) + the filled copy saved as `docs/clinics/corona.md`. Sections:

1. **Identity** — legal + display name, logo (SVG preferred), brand colour,
   website, desired subdomain (`corona.appointer.hu`) or their own domain.
2. **Contact & location** — street address, postcode, city, patient-facing phone
   and e-mail, **manager e-mail** for post-call summaries.
3. **Opening hours** — per weekday, Saturday, Sunday, lunch break, timezone,
   public-holiday handling.
4. **Providers** — for each doctor: title, given/family name, login e-mail,
   specialty, short bio, weekly availability pattern, bookable by phone y/n.
5. **Staff & roles** — assistants/admins, who may manage whose calendar
   (maps to `CalendarDelegation`).
6. **Services & durations** — which of the 7 `AppointmentType` enum values they
   use and each duration. ⚠️ A *new* service type is a Prisma enum change +
   migration + prompt/glossary work — quote it separately, don't promise it in
   onboarding.
7. **FAQ facts** (drives the voice + chat answers) — insurance partners, payment
   methods, cancellation policy & fee, parking/transport, new-patient
   instructions, emergency instructions and number.
8. **Voice agent** — receptionist persona name, greeting line, languages
   (en/hu/de subset), voice preference, whether local law/practice requires an
   explicit AI disclosure at call start.
9. **Telephony** — existing number? port, forward, or new? who owns the carrier
   contract.
10. **Legal/GDPR** — DPA signatory, data-retention preference, call-recording
    consent wording, privacy-policy URL, data-controller contact.
11. **E-mail sending** — whose mailbox sends confirmations. The n8n Gmail
    credential is **per instance and expires ~weekly** (Testing-mode OAuth app);
    decide now whether Corona uses our sender or their own Google Workspace.

---

## Phase 1 — Parameterize the code (one-time, ~2–3 days)

### 1a. Clinic config package
- **New:** `packages/shared/src/clinic.ts` — `ClinicConfig` type (identity,
  contact, hours, timezone, locales, FAQ blocks per language) + a static registry
  importing every `config/clinics/*.json`, resolved by id with `sunshine` as the
  default. Static imports keep it bundleable by Vite (`@repo/shared` is already a
  dependency of **both** apps and exports raw TS — no build step needed).
- **New:** `config/clinics/sunshine.json` — extracted verbatim from today's
  hardcoded values, so behaviour is byte-identical after the refactor.
- **New:** `config/clinics/corona.json` — filled from the Phase 0 intake.
- Selector: `CLINIC_ID` (API, runtime) and `VITE_CLINIC_ID` (web, **build arg** —
  same mechanism as the existing `VITE_SENTRY_DSN` arg in
  [../docker-compose.yml](../docker-compose.yml)). Both default to `sunshine`.

### 1b. API
- `chat-receptionist.ts`: take a `ClinicConfig` argument; interpolate name, city,
  address, hours, emergency number, new-patient docs, FAQ block. Keep the
  Hungarian glossary and register rules as-is — they are dental-generic and hard-won.
- `chat.service.ts`: timezone from config, not the literal.
- `openapi.plugin.ts`: title from config.
- **New:** `GET /api/faq?topic=&language=` returning the config's FAQ text. This
  makes the n8n **FAQ Handler** node clinic-agnostic (one HTTP call instead of a
  hardcoded dictionary) → a duplicated Corona workflow needs *zero* text edits,
  only a base URL + API key change.

### 1c. Web
- `i18n/index.ts`: add `interpolation.defaultVariables: { clinicName }` from the
  config; replace the literal in `common.json` (`appName`), `auth.json`
  (`title`), `chat.json` (`title`, `greeting`, `installPrompt`) with
  `{{clinicName}}` in all three languages.
- `vite.config.ts`: PWA `name`/`short_name`/`description`/`theme_color` from the
  config; add a `transformIndexHtml` hook to set `<title>`.
- Icons: per-clinic folder (`apps/web/public/clinics/<id>/`) copied into place at
  build time, or simply overwritten per stack — decide during implementation;
  favour the folder so `main` stays shared.

### 1d. Seed
- Add a `--minimal` mode to [../apps/api/prisma/seed.ts](../apps/api/prisma/seed.ts):
  create **only** the admin + providers + assistants and their availability
  `CalendarEvent`s from the clinic config, skipping the demo patients,
  appointments and call logs. Keep the existing `assertSafeToSeed()` gate and the
  canary/`ENCRYPTION_KEY` behaviour untouched — a real clinic must never be
  seeded with fake patient rows, and the seed must stay a first-install-only tool.

### 1e. Regression guard
After the refactor, redeploy **sunshinedev** first and confirm the UI, chat
prompt and FAQ answers are unchanged. Only then touch prod.

---

## Phase 2 — Corona stack on the VPS

Mirrors [deploy.md §11](deploy.md) (the dev-stack recipe) — the compose file
already provisions its own Postgres + backup container per resource, so a third
Coolify resource is a fully isolated stack.

1. **DNS:** A record `corona.appointer.hu` → `116.203.205.166`.
2. **Coolify:** + New → Resource → Docker Compose, same repo/branch `main`,
   `docker-compose.yml`. Domain on the **web** service, port 80, Generate SSL.
   `api`/`db`/`backup` stay internal.
3. **Env vars** (all fresh, none shared with Sunshine):
   `POSTGRES_PASSWORD` (`openssl rand -hex 32`), `WEB_ORIGIN` +
   `BETTER_AUTH_URL` = `https://corona.appointer.hu`, `BETTER_AUTH_SECRET`
   (`openssl rand -base64 32`), `FASTIFY_API_KEY` (`openssl rand -hex 24`),
   `ANTHROPIC_API_KEY`, `N8N_BOOKING_WEBHOOK_URL` =
   `https://n8nprod.appointer.hu/webhook/corona-chat-booking-confirmation`,
   `CLINIC_ID=corona`, plus **build** vars `VITE_CLINIC_ID=corona` and
   `VITE_SENTRY_DSN`. **Never** set `ENCRYPTION_KEY`/`ALLOW_ENV_KEY` on prod.
4. **Key ceremony** (on the clinic admin's machine, per
   [disaster-recovery.md](disaster-recovery.md)): new master key
   `openssl rand -hex 32`, new `age` keypair, escrow the master key in two sealed
   envelopes, put the `age1…` public key in `BACKUP_AGE_PUBKEY`.
5. **Deploy** → boot-time `prisma db push` syncs the schema → seed **once** in the
   api container terminal:
   `ENCRYPTION_KEY=<corona master key> SEED_ALLOW_PROD=1 pnpm exec tsx prisma/seed.ts --minimal`
6. **Unlock:** admin logs in, pastes the master key into the amber banner →
   `/api/health` flips to `unlocked` with the new key fingerprint. Change the
   seeded admin password immediately.
7. **Backups:** Coolify → Scheduled Tasks → `nightly-backup`, container `backup`,
   command `backup-db.sh`; set `STORAGEBOX_*` + `HEALTHCHECK_URL` (a **new**
   healthchecks.io check, `STORAGEBOX_DIR=backups/corona`). Verify with *Run now*.

---

## Phase 3 — n8n workflows (shared instance, clinic-scoped paths)

On `n8nprod.appointer.hu`, import a Corona copy of each workflow and rename the
webhook paths so they never collide with Sunshine's:

| Workflow | Corona webhook path |
|---|---|
| `retell-custom-function-router-v2.json` | `/webhook/corona-custom-functions` |
| `post-call-processing-v2.json` | `/webhook/corona-post-call` |
| `chat-booking-confirmation.json` | `/webhook/corona-chat-booking-confirmation` |

Per copy: point the 5 HTTP nodes at `https://corona.appointer.hu/api/...`, set the
`Authorization: Bearer <corona FASTIFY_API_KEY>` header, repoint the FAQ node at
the new `/api/faq` endpoint (Phase 1b), re-select the Gmail credential and set the
manager-summary recipient to Corona's manager. Activate.

> The committed JSONs stay placeholder templates (`YOUR-API-BASE-URL`) — the live
> instance remains the source of truth, per [../workflows/CLAUDE.md](../workflows/CLAUDE.md).

---

## Phase 4 — Corona Retell agent

- **New script** `workflows/scripts/retell-clone-agent.mjs` (+ `pnpm retell:clone`),
  following the conventions of the existing scripts (`retell-set-backend.mjs`,
  `retell-set-webhooks.mjs`): resolve `RETELL_API_KEY` from env → gitignored
  `.mcp.json`, `--dry-run` support, idempotent read-modify-write.
  It should: fetch the Sunshine LLM + agent, create a new LLM with the clinic's
  facts substituted in the prompt, create a new agent bound to it, copy the 6
  custom tools with URLs kept as `{{backend_base_url}}/webhook/corona-custom-functions`,
  set `default_dynamic_variables.backend_base_url = https://n8nprod.appointer.hu`,
  and set `webhook_url` to the Corona post-call path.
- Swap in Corona's greeting, persona name, language subset and voice
  (`pnpm retell:set-voice` pattern; `cartesia-Chloe` + `openai-Chloe` fallback is
  the current cost-effective default).
- **Publish** the agent — published versions pin webhook/tool config; unpublished
  edits never reach live calls.
- Phone number: buy a Retell US number, set Inbound Agent = Corona, validate the
  full chain, then add the +36 Twilio Elastic SIP trunk
  ([retell-golive.md §3B](archive/retell-golive.md)).
- Keep the dev/prod switch pattern: one Corona agent, `backend_base_url` flipped
  between hosts, never a duplicate dev agent.

---

## Phase 5 — Monitoring

> **Fleet monitoring now lives in Appointer Console** (`c:\devs\prods\appointer-console`,
> served at `console.appointer.hu`). It polls every clinic's public `/api/health` on an
> interval, classifies the `encryption: locked` state explicitly, and opens one incident
> (with a single alert e-mail) per outage — so the per-clinic health view and locked-state
> alerting below are **handled centrally** rather than reconstructed from UptimeRobot e-mails.
> Onboarding a clinic therefore means **adding it in the console** (a checklist item there),
> not building a bespoke monitor. UptimeRobot stays as the *external* prober that catches the
> console itself being down; the two are complementary. See
> [appointer-console-plan.md](appointer-console-plan.md).
>
> ⚠️ **Status: built but not yet deployed.** The console (M1–M4) is code-complete, but the
> `console.appointer.hu` Coolify resource is not created and its restore drill hasn't run.
> Until it goes live, UptimeRobot remains the primary alarm and clinics are added to the
> console retroactively once it ships.

- **Appointer Console:** add the clinic (slug = `CLINIC_ID`, health URL
  `https://<id>.appointer.hu/api/health`, `monitoringEnabled`) so fleet health, incidents and
  the locked-state alert are covered from one dashboard.
- UptimeRobot: add `https://corona.appointer.hu/api/health` (5-min) and the
  bare domain; alert when `encryption` stays `locked` >15 min. Keep this as the independent
  outside-in check (it also covers the console).
- Sentry: new `corona-api` + `corona-web` projects (or one project with an
  environment tag — decide when creating; separate projects keep alert routing
  simple), DSNs into the stack's `SENTRY_DSN` / `VITE_SENTRY_DSN` **build** arg.
- healthchecks.io: the new dead-man's-switch check from Phase 2.7.
- Extend [monitoring-runbook.md](monitoring-runbook.md) with a per-clinic table
  instead of Sunshine-only URLs.

---

## Verification (end-to-end, in order)

```bash
curl https://corona.appointer.hu/api/ping     # {"status":"ok"}
curl https://corona.appointer.hu/api/health   # db ok; encryption unlocked; keyFingerprint set
curl "https://corona.appointer.hu/api/faq?topic=office_hours&language=hu"   # Corona's hours, not Sunshine's
```

1. Browser: login page shows **Corona** branding in en/hu/de; log in as the seeded
   admin; unlock; Calendar shows Corona's providers only.
2. `/chat`: ask "mikor vagytok nyitva?" → Corona hours; run a full booking → row
   in Corona's DB, confirmation e-mail sent via the Corona n8n workflow.
3. Call the Retell test number: greeting names Corona, `check_availability` →
   `book_appointment` creates a real appointment, post-call webhook logs the call
   and e-mails Corona's manager.
4. **Cross-tenant check (the one that must not fail):** confirm nothing appeared
   in Sunshine's DB, n8n executions or Sentry project — and that Sunshine's
   dashboard/chat/voice still behave exactly as before Phase 1.
5. Backups: *Run now* on `nightly-backup` → `[backup] OK corona-<stamp>.dump.age`
   + a restore drill into a scratch DB before go-live.

---

## Deliverables

| File | Purpose |
|---|---|
| `docs/clinic-intake-form.md` | Blank questionnaire sent to a new customer (Phase 0) |
| `docs/clinics/corona.md` | Corona's filled intake + issued domains/IDs (no secrets) |
| `docs/onboarding-new-clinic.md` | The Phase 2–5 runbook, written generically |
| `config/clinics/{sunshine,corona}.json` | Non-secret clinic facts |
| `packages/shared/src/clinic.ts` | Config type + registry |
| `workflows/scripts/retell-clone-agent.mjs` | Per-clinic agent provisioning |

**Sequencing:** Phase 1 lands and is verified against **sunshinedev** before any
Corona resource is created; Phase 2 → 3 → 4 must run in that order (the agent
needs the n8n paths, which need the API base URL and key).
