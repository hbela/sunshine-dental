# PRD plan: Appointer Console — operator control plane for the dental-clinic fleet

## Context

Sunshine Dental is deployed **one isolated stack per clinic** (own domain, own Postgres,
own Retell agent, own Coolify resource — see [onboarding-new-clinic.md](onboarding-new-clinic.md)
and [new-clinic-onboarding-plan.md](new-clinic-onboarding-plan.md)). Clinic #2 (Corona) is
being onboarded now; the clinic registry lives in
[../packages/shared/src/clinic.ts](../packages/shared/src/clinic.ts). This is the
"Path A — managed single-tenant" model costed in [business-model.md](business-model.md).

What is missing is a place to see and run the **business** across those stacks. Today the
founder tracks clinics in Obsidian notes, checks health by hand or via UptimeRobot email,
and would bill manually. Past ~3 clinics that stops working.

**Outcome:** a small standalone app — **Appointer Console** — that answers, on one screen,
"is every clinic up?" and "who is paying, and who is about to stop?", and tracks a clinic
from lead through go-live. It **observes** the fleet; it never provisions or touches
patient data.

This session produces the **PRD document only**. No code.

## Decisions locked (from the user)

| Question | Decision |
|---|---|
| Audience | **Operator only** — founder + staff. Invite-only login. No clinic-owner portal, no self-serve signup. |
| Control depth | **Observe only** — polls each stack's public `/api/health`. No tenant API keys, no provisioning automation. |
| Billing | **Stripe subscriptions + hosted Billing Portal** — Checkout to start, Portal for card/invoice self-service, webhooks sync status. No metered overage in MVP. |
| Lifecycle | **Full** — `LEAD → INTAKE → PROVISIONING → PILOT → ACTIVE → PAUSED → CHURNED` + onboarding checklist. |
| Day-one dashboard | **Fleet health.** Revenue/billing views exist as secondary pages, not the headline. |
| Home | New repo `c:\devs\prods\appointer-console`, deployed at `console.appointer.hu`. |

## Deliverables

| File | Purpose |
|---|---|
| `c:\devs\prods\appointer-console\docs\PRD.md` | The PRD (main deliverable) |
| `c:\devs\prods\appointer-console\README.md` | One-paragraph what/why + pointer to the PRD |

## PRD outline and the substance to put in each section

### 1. Summary, problem, goals / non-goals
Goals: single fleet-health view; zero manual billing bookkeeping; every clinic's onboarding
state visible. **Non-goals (MVP):** provisioning automation (Coolify/DNS/Retell), reading
tenant databases, metered per-minute overage, clinic-owner portal, self-serve signup,
non-EUR currencies, i18n (English-only, internal tool), mobile app.

### 2. Users & roles
`OWNER` (full, incl. billing actions and user management) and `STAFF` (read + notes +
checklist). Invite-only — accounts created by an OWNER; no public registration route.

### 3. Core concepts / data model (Prisma + Postgres)
- **Clinic** — `slug` (must equal the tenant stack's `CLINIC_ID`), display/legal name, owner
  contact (name, email, phone), country, timezone, `domain`, `healthUrl`, `status` enum,
  `plan`, `goLiveAt`, `churnedAt`, `churnReason`, free-text notes, and reference links
  (Sentry project, UptimeRobot monitor, n8n webhook prefix, Retell agent id, healthchecks.io).
- **Subscription** — `stripeCustomerId`, `stripeSubscriptionId`, `priceId`, plan, Stripe
  `status`, `currentPeriodEnd`, `cancelAtPeriodEnd`, `trialEndsAt`, `mrrCents`, currency.
  Mirror of Stripe, never the source of truth.
- **Invoice** — from webhooks: id, amount, status, `hostedInvoiceUrl`, `paidAt`. Drives the
  past-due list.
- **HealthCheck** — time series: `checkedAt`, `ok`, httpStatus, `db`, `encryption`,
  `keyFingerprint`, `latencyMs`, error. Retain 90 days, prune job.
- **Incident** — opened when N consecutive failures (or `encryption=locked` > 15 min),
  closed on recovery. Exists so alerts fire once, not every poll.
- **ChecklistItem** — per clinic, seeded from a template mirroring the Phase 2–5 runbook
  (DNS, Coolify resource, env vars, key ceremony, seed, unlock, backups + restore drill,
  n8n workflows, Retell agent + publish, phone number, UptimeRobot/Sentry, DPA signed).
- **User / Session / Account** (better-auth tables), **AuditLog**, **StripeEvent**
  (webhook idempotency by event id).

**Design rule to state explicitly:** the console database holds **no patient PII** — only
business contacts and operational metadata. It polls only the *public, unauthenticated*
`/api/health` (see [../apps/api/src/routes/health.routes.ts](../apps/api/src/routes/health.routes.ts)),
so it stores no tenant secrets.

### 4. Functional requirements — screens
1. **Login** (email+password, better-auth).
2. **Fleet dashboard** (landing): counters (up / down / encryption-locked / no-data), open
   incident list with age, grid of clinic cards (status dot, last-seen, 24 h uptime,
   lifecycle badge). A thin secondary strip: active clinics, MRR, past-due count.
3. **Clinics** list with status filter + **Clinic detail**: overview & links, health history
   (last 24 h/7 d, latency, incidents), subscription panel (plan, status, next invoice,
   *Create checkout link* / *Open billing portal*), onboarding checklist, notes timeline.
4. **New clinic** form (slug, name, contact, domain, health URL, plan, status) — seeds the
   checklist from the template.
5. **Billing**: subscriptions table + exception lists (past-due, trial ending, cancelling at
   period end).
6. **Settings**: operator users, plan↔Stripe price mapping, alert recipients, poll interval.

### 5. Health monitoring spec
Poller inside the API process, default every 5 min: `GET {healthUrl}` with a 5 s
`AbortController` timeout, small concurrency cap, jittered. Classify `ok` / `db-down` /
`locked` / `unreachable` from the documented response shape
(`{status, db, encryption, keyFingerprint, time}`). 3 consecutive failures opens an
incident; recovery closes it. Notify by email (nodemailer/SMTP) and, optionally, an n8n
webhook. State the rule that this **complements, not replaces**, UptimeRobot — the console
can itself be down.

### 6. Billing spec (Stripe)
- Products/prices created in the Stripe dashboard from the tiers in
  [business-model.md §3](business-model.md) (Starter / Professional / Multi-Location, EUR,
  monthly + annual), price IDs mapped in config — no price creation from code.
- **Start:** Checkout Session (`mode: subscription`) with an optional one-off setup-fee line
  item and the `clinicId` in `client_reference_id`/metadata; the operator sends the link.
- **Manage:** Billing Portal session for card updates, invoices, cancellation.
- **Sync:** webhook endpoint with raw-body signature verification
  (`STRIPE_WEBHOOK_SECRET`), idempotent via `StripeEvent`. Handle
  `checkout.session.completed`, `customer.subscription.created|updated|deleted`,
  `invoice.paid`, `invoice.payment_failed`. Plus a manual "resync from Stripe" action.
- MRR derived from subscription price and interval; annual normalised to /12.

### 7. Tech stack & architecture
Deliberately mirror the existing app so patterns transfer:
- **API** — Fastify 5, `fastify-type-provider-zod`, Prisma 6 + Postgres 17, better-auth
  (`admin` plugin, roles as a Prisma enum — same shape as
  [../apps/api/src/lib/auth.ts](../apps/api/src/lib/auth.ts)), `@fastify/helmet`/`cors`/`sensible`,
  `@sentry/node`, `stripe`.
- **Web** — React 19, Vite 7, TanStack Router + Query, Tailwind v4, radix-ui, lucide-react
  — the same set as [../apps/web/package.json](../apps/web/package.json). No i18n, no PWA.
- **Repo** — pnpm workspace + Turborepo, `apps/{api,web}` + `packages/{shared,tsconfig}`.
  *(Note the Windows pnpm gotcha: incremental `pnpm add` can abort — use
  `--lockfile-only` then a clean install.)*
- **Deploy** — its own Coolify resource from a `docker-compose.yml` modelled on
  [../docker-compose.yml](../docker-compose.yml) (db + api + web, nginx in web proxying
  `/api`), `console.appointer.hu`, nightly encrypted backup container, own Sentry project,
  UptimeRobot on its own `/api/health`.
- Env: `DATABASE_URL`, `WEB_ORIGIN`, `BETTER_AUTH_URL/SECRET`, `STRIPE_SECRET_KEY`,
  `STRIPE_WEBHOOK_SECRET`, `SENTRY_DSN`, `SMTP_*`, `ALERT_EMAIL_TO`, `HEALTH_POLL_MINUTES`.

### 8. Security & compliance
Invite-only auth, OWNER/STAFF authorization on every mutating route, audit log, Stripe keys
server-side only, webhook signature verification, no patient PII (so the console is outside
the GDPR patient-data boundary — but business contacts are still personal data: retention +
deletion noted). Own backup + restore drill.

### 9. Milestones (usable MVP)
- **M1** repo scaffold, auth, Clinic CRUD + lifecycle.
- **M2** health poller, incidents, fleet dashboard, alert email. ← *usable alone*
- **M3** Stripe: checkout, portal, webhook sync, billing page.
- **M4** onboarding checklist, settings, Coolify deploy + monitoring of the console itself.

### 10. Success criteria
Any clinic outage or stuck `locked` state is visible in the console within ~5 min; every
active clinic's subscription status matches Stripe with no manual entry; a new clinic can be
taken lead→live entirely inside the app's checklist; the founder stops keeping clinic state
in Obsidian.

### 11. Open questions to flag in the PRD (not blockers)
Usage/COGS per clinic needs a tenant-side read endpoint — deferred, with a sketch. Whether
Corona-style provisioning should ever be automated. Whether clinic owners eventually get a
read-only portal.

## Verification

The deliverable is a document, so verification is a review pass:
1. Re-read [business-model.md §3](business-model.md) (pricing tiers) and confirm the PRD's
   plan table matches.
2. Confirm every checklist item in the PRD's template maps to a step in
   [onboarding-new-clinic.md](onboarding-new-clinic.md).
3. Confirm the health-response fields in §5 match
   [../apps/api/src/routes/health.routes.ts](../apps/api/src/routes/health.routes.ts) exactly.
4. Confirm the non-goals list contains everything the user excluded (portal, self-serve,
   provisioning, metering, tenant data access).

Then, for the follow-up build session (not now): scaffold M1, point a test Clinic row at
`https://sunshinedev.appointer.hu/api/health` to exercise the poller against a real stack,
and drive Stripe in test mode with the `stripe:test-cards` skill + `stripe listen` for
webhooks. (The Stripe MCP server is not authorized in this session — connect it via `/mcp`
in an interactive session if you want MCP-driven Stripe setup.)
