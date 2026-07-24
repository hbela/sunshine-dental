# Corona Dental onboarding — session summary (2026-07-24)

What this session did: turned the product from **single-tenant** into a **multi-clinic**
platform, then used it to onboard the first additional clinic — **Corona Dental**
(a demo modelled on a real Szentendre practice, with all proprietary details
anonymized) — **live** on the VPS, its own voice agent, and n8n workflows.

Companion docs: [`onboarding-new-clinic.md`](onboarding-new-clinic.md) (the reusable
runbook), [`clinic-intake-form.md`](clinic-intake-form.md), [`clinics/corona.md`](clinics/corona.md),
[`deploy.md`](deploy.md), [`disaster-recovery.md`](disaster-recovery.md).

---

## 1. What shipped (code — PR #5, merged to `main`)

Multi-clinic parameterization selected by **one env var** (`CLINIC_ID` runtime /
`VITE_CLINIC_ID` build arg, both default `sunshine`), so `main` deploys any clinic
without a fork.

| Area | Change |
|---|---|
| Config | `packages/shared/src/clinic.ts` — `ClinicConfig` type + registry; `clinics/sunshine.ts` (extracted **verbatim**, behaviour unchanged), `clinics/corona.ts` (anonymized demo) |
| API | chat prompt / timezone / OpenAPI title from config; **new public `GET /api/faq`** (clinic-agnostic FAQ); optional **new-patient "promo" prompt chapter** |
| Web | i18next `defaultVariables` (`{{clinicName}}`/`{{personaName}}`) + Vite title/PWA/icons from config |
| Seed | `--minimal` mode = staff + availability only, **no demo patients** |
| Retell | `workflows/scripts/retell-clone-agent.mts` (`pnpm retell:clone`) |
| Infra | `CLINIC_ID` + `VITE_CLINIC_ID` in `docker-compose.yml`, web `Dockerfile`, `.env.example` |
| Docs | intake form, onboarding runbook, filled Corona record |

**Do NOT touch** the crypto domain constants in `apps/api/src/lib/crypto.ts`
(`HKDF_SALT` etc.) — they read "sunshine" but changing them strands ciphertext.
Isolation comes from a per-stack master key, not those strings.

---

## 2. Corona live infrastructure (reference)

| Thing | Value |
|---|---|
| Public URL | `https://corona.appointer.hu` |
| Coolify | project **corona-dental**, one **Docker Compose** resource from `main` (web + api + **db** + backup — no separate Postgres resource) |
| DB | in-stack Postgres; encryption **keyFingerprint `11477ecc`** |
| Clinic id | `corona` (`CLINIC_ID` + `VITE_CLINIC_ID` both = `corona`, the latter a **Build** var) |
| n8n | reuses shared **`n8nprod.appointer.hu`** (which lives in the `sunshine-dental` Coolify project — irrelevant, since n8n→API is public HTTPS) |
| Router workflow | `OSB6pP4BxHqj4rAO` → `/webhook/corona-custom-functions` |
| Post-call workflow | `cTAJOshl2jmBMSGG` → `/webhook/corona-post-call` |
| Chat-booking workflow | `aPWQA4Y08zAFu0bZ` → `/webhook/corona-chat-booking-confirmation` |
| n8n API auth | Header Auth credential `stIuh8gQ7ZAmanJ2` ("Header Auth account") = `Bearer <corona FASTIFY_API_KEY>` |
| Manager summary → | `hajzerbela@gmail.com` (**demo choice**; swap to the real manager at go-live) |
| Retell agent | published; made a live Hungarian test call (`agent_adf77216ba8897613f7cd376de` seen in a post-call payload) — record the real `agent_id`/`llm_id` in `clinics/corona.md` |

**n8n edits applied to each Corona workflow copy** (via the n8n MCP, after a
one-click UI Duplicate): webhook path → `corona-*`; the 5+1 HTTP nodes' host →
`corona.appointer.hu` and auth switched to the `Corona API` header-auth credential
(inline Sunshine key purged); **FAQ Handler rewritten to call `GET /api/faq`**
(single source of truth, shared with the web chat); confirmation-email branding →
"Corona Dental" + phone `+36 26 555 0142`.

---

## 3. How the live pipeline flows

```
Phone call → Retell (Corona agent) → n8n router (n8nprod, corona-custom-functions)
   → Corona API (corona.appointer.hu/api, Bearer FASTIFY_API_KEY) → in-stack Postgres
Call ends → Retell post-call webhook → n8n post-call (corona-post-call) → /api/call-logs
Web chat  → Corona API (in-process booking) → n8n chat-booking → patient email
FAQ (voice + chat) → GET /api/faq → packages/shared/src/clinics/corona.ts
```

A live HU test call verified: Corona greeting, language, availability (Dr. Kovács /
Dr. Tóth), and the **Start-package promo** all working.

---

## 4. Issues hit & fixes (the operational lessons)

1. **Don't create a separate Postgres or n8n resource.** The compose file bundles
   `db` + `backup`; DATABASE_URL points at the in-stack `db`. n8n is the shared
   `n8nprod`. A standalone Postgres would sit unused.
2. **No link in Coolify** → the domain must be set in the **"Domains for web"**
   field (per-service on the Docker Compose General page), `https://…`, then redeploy.
3. **Build failed on `backup.Dockerfile` `apk add` (exit 4)** → transient mirror
   fetch failure, not a config problem (Alpine 3.22 has `postgresql17-client`).
   **Just redeploy.** A failed build never touches the running stack.
4. **n8n `401 UNAUTHORIZED`** → the Header Auth credential value must equal Corona's
   `FASTIFY_API_KEY` **exactly** (no wrong key, no trailing newline). The route uses
   `requireAuthOrApiKey` (strips `Bearer `, compares to the env key).
5. **Wrong data / `Dr. Ibolya Nagy` returned** → the seed had run **without
   `--minimal`**, loading Sunshine's hardcoded demo dataset (incl. fake patients).
   Re-run **`… seed.ts --minimal`** with the same master key (canary unchanged).
6. **`503 ENCRYPTION_LOCKED`** (booking + post-call log failed) → the API **boots
   locked after every restart** (a key rotation + restart re-locked it). Read-only
   availability works while locked; **writes need an admin to re-unlock** via the
   banner. This is the custody model, not a bug.
7. **Login** is `admin@coronadental.example` / `Admin1234!` — the fictional
   `.example` domain, **not** `admin@corona.dental`. `--minimal` re-seed resets the
   password.
8. **Security:** Corona's `FASTIFY_API_KEY` was pasted into chat during debugging →
   **rotate it** (Coolify env + the n8n credential). The encryption **master key**
   must never touch a terminal/chat — that rule held.

---

## 5. Outstanding / next steps

- [ ] **Unlock** Corona's API (admin banner + master key), then re-run a test call
      → confirm the appointment is created, confirmation email sent, and the
      post-call workflow logs the call (no 503).
- [ ] **Rotate** the exposed `FASTIFY_API_KEY` (Coolify → restart api → update the
      n8n `Header Auth account` credential → re-unlock).
- [ ] Record the real Retell `agent_id` / `llm_id` in [`clinics/corona.md`](clinics/corona.md).
- [ ] **Phase 5 — monitoring:** UptimeRobot on `/api/health` alerting when
      `encryption` stays `locked > 15 min` (this session showed exactly why: a
      locked window silently breaks voice bookings); new Sentry projects;
      backup dead-man's-switch (`HEALTHCHECK_URL` + `STORAGEBOX_*`).
- [ ] At real go-live: replace the anonymized values in `clinics/corona.ts` with the
      customer's real facts, swap the manager-summary recipient, add a `+36` SIP
      number, and finalize the DPA.

---

## 6. Principles reinforced

- **One isolated stack per clinic** — own domain, Postgres, master key, Retell
  agent, backups; all from the same `main` branch, differing only by `CLINIC_ID`.
- **n8n → API is always public HTTPS** with the `FASTIFY_API_KEY` bearer, so which
  Coolify project n8n sits in is irrelevant.
- **The master key never lives on the server or in chat**; the API boots locked and
  an admin unlocks after every restart. Escrowed via an `age` recovery keypair.
- **Retell: one agent per clinic**, backend flipped via `backend_base_url`; publish
  to make edits live.
- **`/api/faq` is the single source of clinic facts** for both voice and chat — no
  per-clinic text duplicated in n8n.
