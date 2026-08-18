When you install a voice-booking dental system in a real clinic, there are typically **three layers of responsibility**:

1. **The dental clinic (data controller / business owner)**
2. **You (software vendor / processor / service provider)**
3. **Third-party providers** (Anthropic, hosting provider, email provider)

The exact legal requirements depend on the country, but since you're in Hungary and mentioned dental clinics, the most relevant frameworks are:

* European Union GDPR
* National healthcare/privacy regulations
* If calling patients in the US: TCPA
* Potentially HIPAA if serving US healthcare providers

---

# 1. Dental Clinic Responsibilities

The clinic is usually the **Data Controller**.

They decide:

* Why patient data is collected
* Which patients are contacted
* Appointment policies
* Retention periods

Typical obligations:

### Privacy Notice

Patients must be informed that:

* Calls may be handled by an AI assistant
* Calls may be recorded
* Personal data is processed
* Data is stored electronically

Example:

> "Appointment booking calls may be handled by an AI assistant and recorded for quality and scheduling purposes."

---

### Lawful Basis

The clinic must have a lawful basis to process:

* Name
* Phone number
* Appointment details
* Dental treatment scheduling information

Usually:

* Contractual necessity
* Legitimate interest
* Healthcare-related legal obligations

---

### Patient Rights

The clinic must be able to:

* Export patient data
* Correct patient data
* Delete data when legally permitted
* Respond to access requests

Your software should support these operations.

---

# 2. Your Responsibilities (Software Vendor)

You are typically a **Data Processor**.

You process data on behalf of the clinic.

Common responsibilities:

### Security

You must implement reasonable security measures:

* HTTPS everywhere
* Password hashing
* RBAC
* Audit logs
* Backups
* Encryption at rest where feasible

For a dental application I would strongly recommend:

* Audit trail for appointment changes
* Audit trail for patient record modifications
* User activity logging

### Encryption at rest — implemented

Sunshine Dental encrypts all patient PII at the application level before it
reaches PostgreSQL:

* **What**: patient names, phone numbers, emails, visit reasons, notes,
  appointment PII, full voice-call and chat transcripts, chat summaries,
  provider phone/bio. Staff login records stay conventional (passwords are
  hashed by better-auth).
* **How**: AES-256-GCM per field with a random IV (`enc:v1:` prefixed values);
  exact phone lookups use a keyed HMAC-SHA256 blind index, so no plaintext is
  ever queryable in SQL.
* **Key custody**: a single 32-byte master key is generated and held by the
  clinic administrator. It is **never stored on the server** — after every
  restart an ADMIN unlocks the API (`POST /api/admin/unlock`) and the key
  lives only in process memory. A key-check canary rejects wrong keys before
  any data could be written.
* **Consequence**: the hosting operator, the database provider, database dumps,
  and backups only ever contain ciphertext. The clinic controls who can read
  patient data.
* **Honest limits** (state this in the DPA): the running application must
  decrypt data to serve the dashboard, the AI receptionist (Anthropic), and
  booking emails (n8n), so those subprocessors receive plaintext by design;
  and losing the master key makes the encrypted data permanently unreadable —
  the escrow procedure in `docs/deploy.md` §8a is mandatory.

---

### Data Processing Agreement (DPA)

Every clinic should sign:

* Software agreement
* Data Processing Agreement

The DPA explains:

* What data is processed
* Where it is stored
* Which subprocessors are used

Example subprocessors:

* [Hetzner](https://www.hetzner.com?utm_source=chatgpt.com)
* [Anthropic](https://www.anthropic.com)
* [OpenAI](https://openai.com?utm_source=chatgpt.com) (if used)
* [Google Cloud](https://cloud.google.com?utm_source=chatgpt.com) (if used)

---

### Breach Notification

If your system is breached:

* Notify affected clinic(s)
* Provide incident details
* Cooperate with investigation

GDPR can require notification within strict timelines.

---

# 3. AI Disclosure (chat)

> **Superseded:** this section used to cover **TCPA** (the US law on automated and
> AI-generated *calls*) and in-call AI voice disclosure. The voice agent was retired on
> **2026-08-18**, and the product no longer places or answers phone calls at all, so TCPA
> and the FCC's artificial-voice rules are simply out of scope. What survives is the
> transparency duty, which applies to a text assistant just as much as a spoken one.

Patients must be able to tell they are talking to a machine, not a member of staff.

**EU:** the AI Act's transparency rule (Art. 50) requires that a person interacting with an
AI system is informed of that fact, unless it is obvious from the context. A chat assistant
that writes like a receptionist is exactly the case the rule is aimed at — do not rely on
"obvious from the context".

**Implementation in this product:**

* The assistant identifies the clinic, its purpose, and its AI nature in the opening message.
* The clinic's privacy notice states that website enquiries may be handled by an AI assistant
  and that conversations are stored.
* The disclosure is contractually required to stay enabled (see the Order Form's Compliance
  Acknowledgment) — a clinic may not strip it out to make the assistant look human.

**Marketing vs. service.** The assistant is inbound and service-only: it answers questions and
books appointments a patient asked for. It never initiates outbound contact and never promotes
treatments, which keeps it clear of the consent regimes that govern marketing outreach. If you
ever add outbound messaging (reminders, recalls, promotions), that is a **new** legal analysis
— for e-mail/SMS this means ePrivacy consent in the EU, and revisiting TCPA if you sell in the US.

---

# Subprocessor Considerations

The AI assistant sends conversation content to **Anthropic** (Claude), which therefore acts as a
subprocessor for any patient data that appears in a chat. Verify and record, before onboarding
clinics:

* Data retention and deletion
* Region of processing, and transfer safeguards (SCCs) if data leaves the EU
* DPA availability and terms
* Whether inputs may be used for model training (they must not be)

The same questions apply to the hosting provider and the e-mail provider. Note that patient PII
is encrypted at rest in this product with a key only the clinic holds — that limits exposure at
the database and backup layer, but **not** what is sent to the model in a live conversation.

---

# What I Would Build Into Your Product

For a commercial dental SaaS, I would make the following features mandatory:

### Compliance Features

✅ Patient consent tracking

✅ Chat transcript retention + consent flag

✅ AI disclosure in the assistant's opening message

✅ Audit logs

✅ Data export

✅ Patient deletion workflow

✅ Data retention policies

✅ Role-based permissions

✅ DPA template

✅ Subprocessor list

✅ Privacy policy template

---

# If You Sell Only in Hungary / EU

Your biggest concern is usually:

1. GDPR
2. Healthcare confidentiality
3. Secure hosting
4. AI transparency
5. Proper contracts with clinics

TCPA generally becomes relevant only when:

* Your customers are in the US, or
* Calls/SMS are made to US phone numbers.

For an EU-only dental scheduling platform, GDPR and healthcare privacy requirements are usually far more important day-to-day than TCPA.
