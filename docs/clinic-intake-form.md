# New clinic — intake form

Everything we need before we can build your AI receptionist and hand you the
keys. Fill in the right-hand column; leave a cell blank if it doesn't apply and
we'll follow up. Nothing here is a secret — **please do not send passwords, API
keys or patient data in this document.**

Estimated time to complete: **30–45 minutes**, ideally with the practice owner
and whoever manages the appointment book in the room.

Return the filled form to us and we'll save it as `docs/clinics/<your-id>.md`.
Sections marked ⛔ **block go-live** — we cannot launch without them.

---

## 1. Identity & branding ⛔

| Field | Your answer |
|---|---|
| Legal entity name (for the contract/invoice) | |
| Display name shown to patients (e.g. "Corona Dental") | |
| Short name, ≤12 characters (phone home-screen icon) | |
| Logo — SVG preferred, otherwise PNG ≥512×512 on transparent background | *(attach)* |
| Primary brand colour (hex, e.g. `#55624d`) | |
| Existing website URL | |
| Preferred booking address — a subdomain we host (e.g. `corona.appointer.hu`) **or** your own domain (e.g. `foglalas.coronadental.hu`) | |

> Choosing your own domain means someone with access to your DNS must add one
> `A` record pointing at our server. We'll send the exact value.

## 2. Contact & location ⛔

| Field | Your answer |
|---|---|
| Street address | |
| Postcode + city | |
| Country | |
| Public phone number (what the AI tells patients to call) | |
| Public e-mail address | |
| **Manager e-mail** — receives a summary after every AI call | |
| Parking / public-transport note (patients ask this a lot) | |

## 3. Opening hours ⛔

Used both for what the AI *says* and as the default bookable window we set up in
your calendar. Individual doctors can differ — that's section 4.

| Day | Open | Close | Lunch/closed break |
|---|---|---|---|
| Monday | | | |
| Tuesday | | | |
| Wednesday | | | |
| Thursday | | | |
| Friday | | | |
| Saturday | | | |
| Sunday | | | |

| Field | Your answer |
|---|---|
| Timezone (e.g. `Europe/Budapest`) | |
| How should the AI handle public holidays? (refuse to book / offer next open day / other) | |

## 4. Doctors / providers ⛔

Copy this block once per doctor. The e-mail address becomes their dashboard
login — it must be a real mailbox they can access.

| Field | Doctor 1 | Doctor 2 | Doctor 3 |
|---|---|---|---|
| Title (Dr., Prof., …) | | | |
| Given name | | | |
| Family name | | | |
| Login e-mail | | | |
| Specialty | | | |
| One-sentence bio (patients may hear this) | | | |
| Working days & hours (if different from §3) | | | |
| Bookable by the AI receptionist? (yes/no) | | | |

## 5. Other staff & permissions

| Field | Your answer |
|---|---|
| Practice administrator — name + e-mail (gets the master admin account) ⛔ | |
| Assistants/receptionists — name + e-mail, one per line | |
| Which assistant may manage which doctor's calendar? (view / edit / book) | |

## 6. Services & appointment lengths ⛔

Tick the ones you offer and give us the slot length you want reserved.

| Service | Offered? | Duration (minutes) |
|---|---|---|
| New patient exam | | |
| Regular cleaning / scaling | | |
| Deep cleaning | | |
| Filling | | |
| Crown preparation | | |
| Consultation | | |
| Emergency visit | | |

| Field | Your answer |
|---|---|
| Any service **not** in the list above that the AI must be able to book? | |

> Adding a brand-new service type is a small development change, not a
> configuration one — tell us early and we'll quote it separately.

## 7. Facts the AI must be able to answer ⛔

These become the AI's answers on both the phone and the website chat. Write them
the way you'd want a receptionist to say them. If a question doesn't apply, write
"we don't offer this" — the AI will say that rather than guess.

| Question patients ask | Your answer |
|---|---|
| Which insurers do you work with? Do you take self-paying patients? | |
| How can patients pay? (cash, card, transfer, instalments) | |
| Cancellation / no-show policy, including any fee | |
| What should a **new** patient bring, and how early should they arrive? | |
| What should someone with a dental emergency do during opening hours? | |
| Which emergency number should the AI give for a life-threatening situation? (e.g. 112) | |
| Anything the AI must **never** say or promise (prices, treatment advice, …) | |

## 8. The AI receptionist

| Field | Your answer |
|---|---|
| What should it call itself? (our default persona is "Sarah") | |
| Languages it must speak (we support English, Hungarian, German) | |
| Preferred greeting, in each language | |
| Voice preference (female/male, warm/formal) — we'll send samples to pick from | |
| Must the AI state that it is an AI at the start of the call? (some clinics/regulators require this) | |
| Tone notes — anything specific to your practice | |

## 9. Telephony

| Field | Your answer |
|---|---|
| Do you have a phone number patients already call? If so, which? | |
| Should that number be **ported** to us, **forwarded** to the AI, or should we issue a **new** number? | |
| If forwarding: always, after N rings, or only outside opening hours? | |
| Who holds the contract with your current phone provider? | |
| Should the AI ever transfer to a human? If so, to which number and when? | |

## 10. Legal & data protection ⛔

We store patient names, phone numbers, e-mails and call transcripts. They are
encrypted at rest, and **we cannot read them without a key that only you hold**.

| Field | Your answer |
|---|---|
| Who signs the Data Processing Agreement? (name, role, e-mail) | |
| Data-protection contact at your practice | |
| How long should we keep call recordings and transcripts? (e.g. 90 days) | |
| How long should we keep patient records after last contact? | |
| Your privacy-policy URL (we link it from the chat widget) | |
| Consent wording you want spoken/shown before recording a call | |

> **Encryption key custody:** at go-live we generate a master key and hand it to
> your administrator. It is never stored on our servers, so after every restart
> an admin must unlock the system once from the dashboard. **If you lose the key,
> the patient data is unrecoverable — not even we can restore it.** Plan two
> sealed copies in two locations.

## 11. E-mail sending

Booking confirmations to patients and call summaries to you are sent by e-mail.

| Field | Your answer |
|---|---|
| Should confirmations come from **your** mailbox (looks better to patients, needs a Google Workspace account + a one-time authorisation) or **ours**? | |
| If yours: which address, and who can authorise it? | |
| Reply-to address for patient replies | |

---

## What happens after you return this

1. We provision your isolated environment (own database, own AI agent, own
   backups) — nothing is shared with another clinic.
2. We configure the AI with your facts from §3, §6 and §7 and send you a test
   number to call.
3. You try it, we tune the wording, and we hand over the admin account and the
   encryption key.
4. We switch your real phone number over.

Typical elapsed time from a complete form to a live number: **3–5 working days**.
