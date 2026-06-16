# Sunshine Dental — Business Model: Effort, Pricing & Willingness to Pay

> **Status:** Working estimates for planning. All monetary figures are industry-typical ranges, **not guarantees** — validate with 5–10 real prospect conversations before committing to a price.
> **Date context:** 2026. Assumes a solo founder/small team selling to independent and small-group dental clinics (EU focus, GDPR applies).

---

## 1. Time to Build, Deploy & Maintain

### 1a. What's already built (sunk effort)

Much of the hard work exists. From the codebase and PRD:

- ✅ Fastify API (auth, calendar, appointments, patients, call logs)
- ✅ React staff dashboard (calendar, appointments, patients, call logs, admin)
- ✅ Retell AI voice agent + n8n workflows (booking, cancel, patient capture, post-call)
- ✅ PostgreSQL + Prisma schema
- ✅ Multilingual work in progress
- ✅ Deployment path documented (Coolify + Docker on a Hetzner VPS)

This represents roughly **2–4 months of full-time development** already invested. The product works as a **single-clinic** system today.

### 1b. Remaining work, by go-to-market strategy

The big question is *how* you sell. Two paths:

**Path A — "Managed single-tenant" (fastest to first revenue)**
You deploy one isolated instance per clinic (own database, own Retell agent). Manual but simple.

| Task | Estimate |
|------|----------|
| Repeatable deployment script / template per clinic | 1–2 weeks |
| Per-clinic Retell agent + phone number provisioning playbook | 1 week |
| Onboarding checklist (clinic hours, providers, FAQs, voice) | 1 week |
| Basic billing (manual invoice or Stripe Payment Link) | 2–3 days |
| Production hardening + monitoring + backups | 1–2 weeks |
| **Total to first paying pilot** | **~4–6 weeks** |

> Best for your first 1–10 customers. Higher per-customer effort, but you learn fast and earn revenue sooner.

**Path B — "Multi-tenant SaaS" (scalable, more upfront work)**
One platform, many clinics, self-serve. Needed once you're past ~10–15 customers.

| Task | Estimate |
|------|----------|
| Multi-tenancy (data isolation, tenant scoping everywhere) | 3–4 weeks |
| Self-serve onboarding & clinic setup wizard | 2–3 weeks |
| Automated Retell agent + number provisioning per tenant | 2 weeks |
| Stripe subscription billing (plans, metering, dunning) | 2 weeks |
| Admin/operator console (manage all clinics) | 1–2 weeks |
| Usage metering (minutes, calls) for billing & limits | 1 week |
| Security & GDPR compliance features (see checklist below) | 3–5 weeks |
| **Total** | **~14–18 weeks (3.5–4.5 months)** |

> **GDPR compliance is a feature set, not a checkbox.** `compliance.md` lists the following as *mandatory* for a commercial dental SaaS. Some exist today (RBAC ✅, HTTPS ✅, password hashing ✅); the rest add real build time and are baked into the estimate above:
>
> | Feature | Built? |
> |---------|--------|
> | Role-based permissions (RBAC) | ✅ |
> | HTTPS / password hashing | ✅ |
> | Audit logs (appointment & patient changes, user activity) | ⛔ to build |
> | Patient consent + call-recording consent flag | ⛔ to build |
> | AI disclosure script (in-call) | 🟡 verify in Retell agent |
> | Data export (patient access requests) | ⛔ to build |
> | Patient deletion workflow | ⛔ to build |
> | Data retention policy/automation | ⛔ to build |
> | DPA template, subprocessor list, privacy-policy template | 🟡 drafted in `saas-agreement-template.md`, finalize with lawyer |
>
> **Do not skip these before selling to clinics** — for a healthcare buyer, "are you GDPR-compliant?" is a deal-qualifying question, and a breach involving patient data is the one mistake that can end the business.

### 1c. Ongoing maintenance

| Activity | Time |
|----------|------|
| Platform upkeep (deps, security patches, monitoring, bug fixes) | ~15–25% of build effort per year, or ~4–8 hrs/week solo |
| Per-customer onboarding | 2–6 hrs per new clinic (Path A) → <1 hr automated (Path B) |
| Customer support | Budget 1–3 hrs/week per ~10 active clinics early on |
| Retell/n8n prompt tuning as you learn | Ongoing, a few hrs/month |

**Rule of thumb:** plan for maintenance + support to consume **20–40% of one person's time** once you have a handful of live clinics. It is never zero.

---

## 2. Cost to Operate (your COGS per clinic)

Knowing your costs sets the pricing floor. Per clinic, per month:

| Cost | Estimate (monthly) |
|------|--------------------|
| Voice AI (Retell) — ~600 min/clinic @ ~$0.07–0.10/min* | $45–70 |
| Telephony / phone number | $2–5 |
| LLM usage (if billed separately from Retell) | $10–30 |
| Infrastructure share (VPS, Postgres, n8n) | $5–15 |
| Email/SMS notifications | $2–10 |
| **Approx. COGS per clinic** | **~$70–130/mo** |

\* A typical small clinic handles ~150–300 calls/month at ~3 min each. Heavy-volume clinics cost more — meter minutes and charge overage so a busy clinic doesn't erode your margin.

**Plus shared fixed costs:** your time, domain, monitoring tools, accounting, etc.

**Takeaway:** at ~$80–130 variable cost per clinic, any plan at $300+/month carries a healthy gross margin (60–80%+).

---

## 3. Pricing Options

Price on **value delivered**, not cost-plus. The anchor: a single new patient is worth **€500–€1,500+** in first-year revenue, and a human answering service costs **€800–€1,500/month**. Against that, the prices below are easy to justify.

### Recommended 3-tier SaaS pricing

| | **Starter** | **Professional** ⭐ | **Multi-Location** |
|---|---|---|---|
| **Monthly price** | €249–299 | €499–599 | €899+ (or custom) |
| **Best for** | Solo practice, after-hours/overflow | Busy single-location clinic | Groups & DSOs |
| **Call answering** | After-hours + overflow | 24/7 | 24/7 |
| **Included minutes** | ~400/mo | ~1,000/mo | Pooled / custom |
| **Locations / providers** | 1 location, up to 3 providers | 1 location, unlimited providers | Multiple locations |
| **Booking, cancel, reschedule** | ✅ | ✅ | ✅ |
| **Staff dashboard & call logs** | ✅ | ✅ | ✅ |
| **Multilingual** | 1 language | Multiple | Multiple |
| **Patient records & callbacks** | ✅ | ✅ | ✅ |
| **Support** | Email | Priority email | Priority + onboarding manager |
| **Overage** | €0.20–0.30/min | €0.15–0.25/min | Negotiated |

**Add-ons / levers:**
- **One-time setup fee: €300–€1,000** (covers onboarding, number porting, agent tuning). Often waived on annual contracts as an incentive.
- **Annual billing: ~2 months free** (e.g., pay for 10, get 12) — improves cash flow and retention.
- **Per-minute overage** beyond the included bundle — protects your margin on high-volume clinics.

### Why this structure works
- **Starter** removes the "too expensive to try" objection and lands price-sensitive solo dentists.
- **Professional** is the target tier (most buyers pick the middle) and where your margin is best.
- **Multi-Location** lets you capture larger groups without leaving money on the table.
- **Setup fee** filters tire-kickers and funds your onboarding time.

### Alternative models (consider, but harder to sell)
- **Per-minute only** — transparent but unpredictable for the buyer; clinics prefer flat fees.
- **Per-booked-appointment** (e.g., €5–15/appointment) — strong ROI story, but harder to forecast and meter; risky if a clinic's volume is low.
- **Per-seat** — wrong fit here; value is in calls answered, not staff logins.

---

## 4. How Much Will a Customer Pay?

### The willingness-to-pay logic
Dental owners are **ROI-driven and somewhat price-sensitive** (small business, tight margins), but they understand the cost of a lost patient better than most.

Frame every quote as a payback calculation:

> *"The Professional plan is €549/month. If it books you just **one** additional new patient a month — worth €500–€1,500 — it has paid for itself. Most clinics capture several."*

### Realistic price points (EU small-clinic market, 2026)
- **Comfortable sweet spot for a single location: €300–€600/month.**
- Below ~€250 you signal "low value" and erode margin.
- Above ~€700 for a single location, you'll meet resistance unless ROI is proven with their own numbers.
- Groups/DSOs (multiple locations) will pay **€900–€2,500+/month** because the value scales with locations.

### What moves willingness-to-pay UP
- Proven results ("booked 14 extra appointments last month") — get a reference clinic ASAP.
- A free trial or 30-day money-back guarantee (removes risk).
- Showing them their **own** missed-call data during the demo.
- Strong onboarding so they see value in week one.

### What moves it DOWN
- No proof / you're their first customer (offer a discounted **pilot** — see below).
- Clunky setup, robotic voice, or any double-booking in the demo.
- Long contracts before trust is established.

### Pilot pricing for your first customers
For your first 3–5 clinics, trade price for proof and testimonials:
- **50% off for 3–6 months**, or a **€99–149/month "founding customer" rate**, in exchange for feedback and a reference/testimonial.
- This buys you case studies, which are the single biggest lever on everyone else's willingness to pay.

---

## 5. Quick Financial Snapshot

Illustrative, Professional tier @ €549/mo, ~€100 COGS:

| Clinics | MRR | Gross profit (~80%) | Notes |
|---------|-----|---------------------|-------|
| 5 (pilots @ €149) | €745 | ~€250 | Proof-of-concept phase |
| 10 @ €499 | €4,990 | ~€4,000 | Validates the model |
| 25 @ €549 | €13,725 | ~€11,000 | Sustainable solo business |
| 50 @ €549 | €27,450 | ~€22,000 | Justifies hiring help |

**Break-even on your build time** depends on how you value the months already invested, but at ~€11k+/month gross profit (25 clinics), this is a genuinely viable micro-SaaS.

---

## 6. Recommended path

1. **Now → 6 weeks:** Finish Path A. Land 3–5 **pilot clinics** at a discounted founding rate.
2. **Months 2–4:** Collect results and testimonials. Raise price to full rate for new customers.
3. **Once ~10–15 clinics:** Build Path B (multi-tenant) to scale without per-customer effort exploding.
4. **Throughout:** Track your real COGS per clinic and missed-call→booking conversion — those two numbers drive both pricing and your sales pitch.
