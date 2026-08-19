# Onboarding a new clinic — operator runbook

Everything needed to take a signed customer from "we have their intake form" to
"patients can chat with the receptionist", using **one isolated stack per clinic**:
its own domain, Postgres, encryption key and n8n mail workflow, all built from the
same `main` branch.

Companions: [`clinic-intake-form.md`](clinic-intake-form.md) (what we ask the
customer), [`deploy.md`](deploy.md) (how the stack works),
[`disaster-recovery.md`](disaster-recovery.md) (keys + backups).

> Worked example throughout: **Corona Dental**, clinic id `corona`, at
> `corona.appointer.hu`. Substitute your own id/domain.

**Budget:** ~1.5–3 hours of operator time spread over 3–5 working days (most of the
elapsed time is DNS, TLS and the customer reviewing the agent's wording).

---

## 0. Prerequisites

- [ ] Signed agreement + DPA.
- [ ] A **complete** [`clinic-intake-form.md`](clinic-intake-form.md) back from the customer.
      Sections marked ⛔ there are hard blockers — chase them before starting.
- [ ] Save the filled form as `docs/clinics/<id>.md` (no secrets in it).

---

## 1. Add the clinic config (code, ~30 min)

All clinic-specific facts live in one file. Nothing else in the codebase needs a
per-clinic edit.

1. Copy [`../packages/shared/src/clinics/sunshine.ts`](../packages/shared/src/clinics/sunshine.ts)
   to `packages/shared/src/clinics/<id>.ts` and fill it from the intake form:
   identity, contact, timezone, languages, brand colours, `officeHoursSummary`,
   the 8 FAQ topics per language, and `seed.staff` / `seed.availability`.
2. Register it in [`../packages/shared/src/clinic.ts`](../packages/shared/src/clinic.ts)
   (`import` + add to the `CLINICS` map).
3. Branding assets (optional): drop `favicon.svg`, `apple-touch-icon.png` and the
   three `pwa-*.png` files into `apps/web/public/clinics/<id>/`, then set
   `brand.assetBasePath: '/clinics/<id>/'`. Omit it to reuse the default set.
4. Verify locally — the config is type-checked, so a missing FAQ topic or a typo'd
   language is a compile error, not a blank answer mid-conversation:

```bash
pnpm check-types
CLINIC_ID=<id> pnpm --filter api dev     # then: curl "localhost:3000/api/faq?topic=location&language=hu"
VITE_CLINIC_ID=<id> pnpm --filter web build   # check dist/index.html <title> + manifest
```

Commit to `main`. Sunshine is unaffected: every consumer defaults to `sunshine`
when `CLINIC_ID` is unset.

---

## 2. The stack on the VPS (~45 min + TLS wait)

Same shape as the dev stack in [`deploy.md` §11](deploy.md). The compose file
brings its own Postgres and backup container, so a new Coolify resource is a
fully isolated environment.

1. **DNS** — A record `corona.appointer.hu` → `116.203.205.166`. Wait for propagation.
2. **Coolify** — *+ New → Resource → Docker Compose*, same GitHub repo, branch
   `main`, compose file `docker-compose.yml`. Assign the domain to the **web**
   service on port 80 and enable *Generate SSL*. Leave `api`, `db` and `backup`
   internal (no domain).
3. **Environment variables** — everything fresh; **never** copy another clinic's:

   | Variable | Value | Notes |
   |---|---|---|
   | `CLINIC_ID` | `corona` | runtime |
   | `VITE_CLINIC_ID` | `corona` | **mark as BUILD variable** |
   | `POSTGRES_PASSWORD` | `openssl rand -hex 32` | secret |
   | `WEB_ORIGIN` | `https://corona.appointer.hu` | |
   | `BETTER_AUTH_URL` | `https://corona.appointer.hu` | must equal the public URL |
   | `BETTER_AUTH_SECRET` | `openssl rand -base64 32` | secret, stable forever |
   | `FASTIFY_API_KEY` | `openssl rand -hex 24` | secret; what this clinic's n8n sends |
   | `ANTHROPIC_API_KEY` | Claude key | omit → **no receptionist at all**; never omit in prod |
   | `N8N_BOOKING_WEBHOOK_URL` | `https://n8nprod.appointer.hu/webhook/corona-chat-booking-confirmation` | |
   | `SENTRY_DSN` / `VITE_SENTRY_DSN` | new Sentry projects | the VITE one is a BUILD variable |
   | `BACKUP_AGE_PUBKEY`, `HEALTHCHECK_URL`, `STORAGEBOX_*` | see step 5 | |

   > **Do NOT set `ENCRYPTION_KEY` or `ALLOW_ENV_KEY` on a clinic's stack.** The
   > API must boot locked; the key lives with the clinic, not on our server.

4. **Key ceremony** — on the clinic administrator's machine, not the VPS
   (details in [`disaster-recovery.md`](disaster-recovery.md)):
   - `openssl rand -hex 32` → the clinic's master key.
   - `age-keygen` → recovery keypair; the `age1…` **public** key goes into
     `BACKUP_AGE_PUBKEY`.
   - Print the master key twice, sealed envelopes, two locations. Have the
     customer open one and read it back once — an untested escrow is no escrow.
5. **Deploy.** Schema syncs automatically at boot (`prisma db push` in the api
   `CMD`). Then seed **once**, in the api container terminal:

```bash
cd apps/api
ENCRYPTION_KEY=<clinic master key> SEED_ALLOW_PROD=1 \
  pnpm exec tsx prisma/seed.ts --minimal
```

   `--minimal` creates only the staff accounts and standard availability from the
   clinic config. **Without `--minimal` the script seeds fake patients and
   appointments** — never do that on a clinic's database. It is a
   first-install tool: re-running it wipes data and re-keys the canary.

   Initial passwords are printed at the end. `SEED_PASSWORD=…` is **required**
   for non-local databases — the seed refuses to run with the repo's well-known
   dev passwords on a real clinic. Record the password in the clinic's password
   manager entry.

6. **Unlock + verify.**

```bash
curl https://corona.appointer.hu/api/ping     # {"status":"ok"}
curl https://corona.appointer.hu/api/health   # db ok, encryption "locked" before unlock
curl "https://corona.appointer.hu/api/faq?topic=office_hours&language=hu"
```

   Admin logs in, pastes the master key into the amber banner → health flips to
   `unlocked` with the clinic's key fingerprint. Change the seeded passwords.

7. **Backups** — Coolify → *Scheduled Tasks* → name `nightly-backup`, container
   `backup`, command `backup-db.sh`, nightly. `STORAGEBOX_DIR` defaults to
   `backups/<id>` from `CLINIC_ID` — only set it to override
   and a **new** healthchecks.io ping URL. Click *Run now* and expect
   `[backup] OK <id>-<stamp>.dump.age`. Do a restore drill into a scratch
   database before go-live.

---

## 3. n8n workflow (~10 min)

We reuse the shared **`n8nprod.appointer.hu`** instance; each clinic gets its own
copy of the one remaining workflow, on a clinic-scoped webhook path.

| Workflow file | Corona webhook path |
|---|---|
| [`../workflows/chat-booking-confirmation.json`](../workflows/chat-booking-confirmation.json) | `/webhook/corona-chat-booking-confirmation` |

Steps:

1. Import, rename to `… (corona)`, change the **Webhook** node's path.
2. Re-select the Gmail credential (credentials never travel with an export) and
   set the recipient/reply-to to the clinic's address.
3. Activate, copy the Production webhook URL into the stack's
   `N8N_BOOKING_WEBHOOK_URL` env, and redeploy.
4. Smoke-test with a sample POST, then with a real booking through the chat UI.

> Booking, availability and patient capture all run **in-process** in the API — n8n
> is only in the mail path. The JSONs in `workflows/` stay placeholder templates
> (`YOUR-API-BASE-URL`); the live instance is the source of truth. See
> [`../workflows/CLAUDE.md`](../workflows/CLAUDE.md).

---

## 4. Review the chat prompt (~20 min + customer review)

There is no per-clinic agent to create: the receptionist prompt is **generated
from the clinic config at runtime** (`apps/api/src/prompts/chat-receptionist.ts`),
so the work in §1 already produced it. What remains is checking it.

1. Render it and read it end to end — greeting, persona name, services, hours,
   emergency number, and anything the customer specified in intake §8.
2. `pnpm --filter api test` covers the mechanical invariants for every clinic in
   the config: no other clinic is named, the emergency number is this clinic's,
   the service list matches exactly, and the Hungarian glossary terms are used.
   A new clinic is picked up automatically — a failure here means §1 is wrong.
3. Have the customer read the greeting and the Hungarian wording. This is the
   step with real elapsed time; everything else is minutes.

## 5. Monitoring (~15 min)

- **Appointer Console** (`console.appointer.hu`): add the clinic — slug = `CLINIC_ID`,
  health URL `https://<id>.appointer.hu/api/health`, monitoring enabled. This is the fleet
  view: it polls every clinic's `/api/health`, treats `encryption: locked` as its own
  incident type, and sends one alert e-mail per outage. It is now the primary place you
  watch the clinic; the checks below stay as the independent outside-in layer (and cover the
  console itself).
  > ⚠️ **Built but not yet deployed** — the console app (M1–M4) is code-complete but the
  > `console.appointer.hu` Coolify resource and its restore drill are still pending. **Until
  > it is live, treat UptimeRobot below as the primary monitor** and add the clinic to the
  > console retroactively once it ships.
- **UptimeRobot:** `https://corona.appointer.hu/api/health` at 5-minute interval,
  plus the bare domain. Alert if `encryption` stays `locked` >15 min — chat
  bookings fail while locked.
- **Sentry:** new `corona-api` and `corona-web` projects; DSNs into `SENTRY_DSN`
  and the `VITE_SENTRY_DSN` **build** variable.
- **healthchecks.io:** the backup dead-man's switch from §2.7.
- Add the clinic's row to [`monitoring-runbook.md`](monitoring-runbook.md).

---

## 6. Go-live checklist

- [ ] `/api/ping`, `/api/health` green; `encryption: unlocked`.
- [ ] `/api/faq?topic=location` returns **this** clinic's address, not another's.
- [ ] Dashboard shows the clinic's branding in every configured language; staff
      can log in; seeded passwords changed.
- [ ] Chat: books an appointment, the confirmation e-mail arrives, and the
      conversation shows up under **Chat Logs** in the dashboard.
- [ ] Chat answers hours/location/insurance from **this** clinic's facts, in each
      configured language.
- [ ] **Cross-tenant check:** nothing new in any other clinic's database, n8n
      executions or Sentry project.
- [ ] Backup ran and a restore drill succeeded.
- [ ] Escrowed key tested by the customer; admin knows the unlock-after-restart
      routine.
- [ ] Chat widget embedded on the clinic's website (or the `/chat` link handed
      over), and the customer has confirmed it loads there.

---

## Known limits (quote separately)

- ~~**New appointment types** are a Prisma enum change + prompt work, not config.~~
  **Fixed 2026-07-26.** Services, durations and per-language names are now
  `ClinicConfig.services` (see [`../packages/shared/src/clinic.ts`](../packages/shared/src/clinic.ts)).
  Adding one is a config edit in that clinic's file — no schema change, no effect
  on other clinics, and it flows automatically to the booking dropdown, the chat
  prompt and the chat tool enum. The one manual follow-up per clinic is the n8n
  label map in the confirmation-email workflow (see
  [`services-config-refactor-plan.md`](services-config-refactor-plan.md) Step 6).
- **Phone-number validation is Hungary-specific**
  ([`../packages/shared/src/phone.ts`](../packages/shared/src/phone.ts)) — a clinic
  outside HU needs that generalised first.
- **One Gmail credential per n8n instance**, and the current one is a Testing-mode
  OAuth app whose token expires roughly weekly. A clinic that wants mail from its
  own domain needs its own Google Workspace authorisation.
- **Languages** are limited to `en` / `hu` / `de`; a fourth means new locale files
  and prompt work.
- Past ~10 clinics this per-stack model stops paying off — that is the point to
  build real multi-tenancy ([`business-model.md`](business-model.md) Path B).
