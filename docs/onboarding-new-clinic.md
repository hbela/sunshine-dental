# Onboarding a new clinic — operator runbook

Everything needed to take a signed customer from "we have their intake form" to
"patients can call the number", using **one isolated stack per clinic**: its own
domain, Postgres, encryption key, Retell agent and n8n workflows, all built from
the same `main` branch.

Companions: [`clinic-intake-form.md`](clinic-intake-form.md) (what we ask the
customer), [`deploy.md`](deploy.md) (how the stack works), [`retell-golive.md`](retell-golive.md)
(phone numbers), [`disaster-recovery.md`](disaster-recovery.md) (keys + backups).

> Worked example throughout: **Corona Dental**, clinic id `corona`, at
> `corona.appointer.hu`. Substitute your own id/domain.

**Budget:** ~2–4 hours of operator time spread over 3–5 working days (most of the
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
   language is a compile error, not a blank answer on a live call:

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
   | `ANTHROPIC_API_KEY` | Claude key | omit → chat disabled, voice unaffected |
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
   clinic config. **Without `--minimal` the script seeds fake patients,
   appointments and call logs** — never do that on a clinic's database. It is a
   first-install tool: re-running it wipes data and re-keys the canary.

   Initial passwords are printed at the end (override with `SEED_PASSWORD=…`).

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

## 3. n8n workflows (~30 min)

We reuse the shared **`n8nprod.appointer.hu`** instance; each clinic gets its own
copy of the three workflows on clinic-scoped webhook paths.

| Workflow file | Corona webhook path |
|---|---|
| [`../workflows/retell-custom-function-router-v2.json`](../workflows/retell-custom-function-router-v2.json) | `/webhook/corona-custom-functions` |
| [`../workflows/post-call-processing-v2.json`](../workflows/post-call-processing-v2.json) | `/webhook/corona-post-call` |
| [`../workflows/chat-booking-confirmation.json`](../workflows/chat-booking-confirmation.json) | `/webhook/corona-chat-booking-confirmation` |

Per copy:

1. Import, rename to `… (corona)`, change the **Webhook** node's path.
2. Point the 5 HTTP nodes at `https://corona.appointer.hu/api/...` and set
   `Authorization: Bearer <corona FASTIFY_API_KEY>`.
3. **FAQ Handler node:** replace the hardcoded dictionary with an HTTP GET to
   `https://corona.appointer.hu/api/faq?topic={{...}}&language={{...}}` and return
   `result` from the response. The API is now the single source of FAQ truth —
   the same answers the chat gives — so no clinic text lives in n8n.
4. Re-select the Gmail credential (credentials never travel with an export) and
   set the manager-summary recipient to the clinic's manager address.
5. Activate, then smoke-test each webhook with a sample POST before wiring Retell.

> The JSONs in `workflows/` stay placeholder templates (`YOUR-API-BASE-URL`); the
> live instance is the source of truth. See [`../workflows/CLAUDE.md`](../workflows/CLAUDE.md).

---

## 4. Retell agent (~45 min + customer review)

```bash
pnpm retell:clone -- --clinic corona --dry-run   # review first, always
pnpm retell:clone -- --clinic corona
```

The script ([`../workflows/scripts/retell-clone-agent.mts`](../workflows/scripts/retell-clone-agent.mts))
clones the reference agent + LLM, substitutes the clinic's facts into the prompt,
points the 6 custom tools at `{{backend_base_url}}/webhook/corona-custom-functions`,
sets `default_dynamic_variables.backend_base_url`, and sets `webhook_url` to the
clinic's post-call path. It refuses to create a second agent for a clinic that
already has one.

Then, by hand:

1. **Read the whole prompt** in the dashboard. The script prints any line that
   still names the source clinic — fix those, plus the greeting, the persona name
   and anything the customer specified in intake §8.
2. Voice: `pnpm retell:set-voice` (defaults `cartesia-Chloe` with an
   `openai-Chloe` fallback — the current cost/quality choice).
3. **Publish the agent.** Published versions pin webhook and tool config; an
   unpublished edit never reaches a live call.
4. Phone number: buy a Retell test number, set *Inbound Agent* = the new agent,
   validate the whole chain, then move to a real +36 number via a Twilio Elastic
   SIP trunk ([`retell-golive.md` §3B](retell-golive.md)).
5. Record `agent_id` and `llm_id` in `docs/clinics/<id>.md`.

Keep **one agent per clinic**, flipped between n8n hosts with
`retell-set-backend.mjs` — do not create a separate dev agent
([`no-duplicate-agent.md`](no-duplicate-agent.md)).

---

## 5. Monitoring (~15 min)

- **UptimeRobot:** `https://corona.appointer.hu/api/health` at 5-minute interval,
  plus the bare domain. Alert if `encryption` stays `locked` >15 min — voice and
  chat bookings fail while locked.
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
- [ ] Chat: books an appointment and the confirmation e-mail arrives.
- [ ] Voice: test call books an appointment, post-call summary e-mail arrives,
      call log appears in the dashboard.
- [ ] **Cross-tenant check:** nothing new in any other clinic's database, n8n
      executions or Sentry project.
- [ ] Backup ran and a restore drill succeeded.
- [ ] Escrowed key tested by the customer; admin knows the unlock-after-restart
      routine.
- [ ] Real phone number pointed at the agent.

---

## Known limits (quote separately)

- ~~**New appointment types** are a Prisma enum change + prompt work, not config.~~
  **Fixed 2026-07-26.** Services, durations and per-language names are now
  `ClinicConfig.services` (see [`../packages/shared/src/clinic.ts`](../packages/shared/src/clinic.ts)).
  Adding one is a config edit in that clinic's file — no schema change, no effect
  on other clinics, and it flows automatically to the booking dropdown, both
  prompts and the chat tool enum. Two follow-ups are still manual per clinic:
  the Retell tool `appointment_type` enum, and the n8n label maps (see
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
