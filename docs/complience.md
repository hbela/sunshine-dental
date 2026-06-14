When you install a voice-booking dental system in a real clinic, there are typically **three layers of responsibility**:

1. **The dental clinic (data controller / business owner)**
2. **You (software vendor / processor / service provider)**
3. **Third-party providers** (Retell, telephony provider, hosting provider, email/SMS provider)

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
* [Retell AI](https://retellai.com?utm_source=chatgpt.com)
* [Twilio](https://www.twilio.com?utm_source=chatgpt.com) (if used)
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

# 3. TCPA Compliance (US Calls)

TCPA became a hot topic because AI calling exploded recently.

TCPA is mainly a US law.

It regulates:

* Automated calls
* AI-generated calls
* SMS campaigns
* Telemarketing

---

## Important Distinction

### Appointment Reminder

Generally lower risk:

> "You have a dental appointment tomorrow at 10 AM."

Often permissible under healthcare exemptions and consent frameworks.

---

### Marketing Call

Higher risk:

> "Would you like a teeth whitening promotion?"

Different rules apply.

Usually explicit consent is required.

---

# AI Voice Disclosure

The US FCC has recently clarified that AI-generated voices may be treated similarly to artificial/prerecorded voices for regulatory purposes.

A common best practice is:

> "Hello, I'm the Sunshine Dental virtual assistant calling regarding your appointment."

Identify:

* Business
* Purpose
* AI nature of the call

This significantly reduces risk.

---

# Retell-Specific Considerations

If Retell handles:

* Voice recordings
* Transcripts
* Call summaries

Then Retell becomes a subprocessor.

You should verify:

* Data retention
* Data deletion
* Region hosting
* DPA availability

Before onboarding clinics.

---

# What I Would Build Into Your Product

For a commercial dental SaaS, I would make the following features mandatory:

### Compliance Features

✅ Patient consent tracking

✅ Call recording consent flag

✅ AI disclosure script

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
