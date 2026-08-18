# Corona Dental Szentendre — filled intake

> **Filled instance of [`../clinic-intake-form.md`](../clinic-intake-form.md).**
> This is a **demo** record. It is modelled on a real Szentendre practice to
> mimic a realistic setup, but every proprietary/personal detail — doctor names,
> phone numbers, e-mail, website, exact street address — has been **changed to
> fictional values** to avoid exposing the real clinic. The non-identifying
> operational facts (hours, service range, payment methods, cancellation fee,
> the new-patient "Start package") reflect how such a clinic actually presents
> itself. Replace the fictional values with the customer's real ones before
> go-live. The machine-readable copy lives in
> [`../../packages/shared/src/clinics/corona.ts`](../../packages/shared/src/clinics/corona.ts).

Clinic id: `corona` · Domain: `corona.appointer.hu`

---

## 1. Identity & branding

| Field | Answer |
|---|---|
| Legal entity name | Corona Dental Kft. *(fictional)* |
| Display name | Corona Dental |
| Short name (≤12 chars) | Corona |
| Logo | *(placeholder — using default icon set)* |
| Primary brand colour | `#0f766e` (teal) |
| Existing website | https://corona.appointer.hu *(fictional; real practice site not reproduced)* |
| Booking address | `corona.appointer.hu` (subdomain we host) |

## 2. Contact & location

| Field | Answer |
|---|---|
| Street address | Rózsa utca 7 *(fictional street/number)* |
| Postcode + city | 2000 Szentendre |
| Country | Hungary |
| Public phone | +36 26 555 0142 *(fictional)* |
| Public e-mail | info@coronadental.example *(fictional)* |
| Manager e-mail | manager@coronadental.example *(fictional)* |
| Parking / transport | Street parking nearby; ~15 min walk from the HÉV terminus *(illustrative)* |

## 3. Opening hours

| Day | Open | Close | Break |
|---|---|---|---|
| Monday | 08:00 | 20:00 | 12:00–13:00 |
| Tuesday | 08:00 | 20:00 | 12:00–13:00 |
| Wednesday | 08:00 | 20:00 | 12:00–13:00 |
| Thursday | 08:00 | 20:00 | 12:00–13:00 |
| Friday | 08:00 | 20:00 | 12:00–13:00 |
| Saturday | — | closed | — |
| Sunday | — | closed | — |

| Field | Answer |
|---|---|
| Timezone | `Europe/Budapest` |
| Public holidays | Refuse to book; offer the next open weekday. |

> The real site advertises Mon–Fri 8:00–20:00. The midday break is an assumption
> for the demo — confirm with a real customer.

## 4. Doctors / providers  *(names fictional)*

| Field | Doctor 1 | Doctor 2 | Doctor 3 |
|---|---|---|---|
| Title | Dr. | Dr. | Dr. |
| Given name | Gábor | Anna | Péter |
| Family name | Kovács | Tóth | Nagy |
| Login e-mail | gabor.kovacs@coronadental.example | anna.toth@coronadental.example | peter.nagy@coronadental.example |
| Specialty | General Dentistry & Implantology (director) | Esthetic Dentistry & Orthodontics | Oral Surgery |
| Bio | Practice director; general and implant dentistry. | Esthetic dentistry and orthodontics. | Extractions, bone grafting, sinus lift. |
| Working days | Mon–Fri | Mon–Fri | Tue & Thu (surgery days) |
| Bookable by AI? | Yes | Yes | Yes |

## 5. Other staff & permissions

| Field | Answer |
|---|---|
| Administrator | Practice Admin — admin@coronadental.example *(fictional)* |
| Assistants | Réka Horváth — reka.horvath@coronadental.example *(fictional)* |
| Calendar delegation | Assistant may view + book for all three doctors. |

## 6. Services & appointment lengths

Bookable via the AI (mapped to the system's appointment types):

| Service | Offered? | Duration (min) |
|---|---|---|
| New patient exam | ✅ | 60 |
| Regular cleaning / scaling | ✅ | 30 |
| Deep cleaning | ✅ | 60 |
| Filling | ✅ | 45 |
| Crown preparation | ✅ | 90 |
| Consultation | ✅ | 30 |
| Emergency visit | ✅ | 30 |

Also offered in-clinic (specialist consult first, **not** directly AI-bookable):
implantology, oral surgery (extractions, bone grafting, sinus lift), orthodontics
(removable / fixed / invisible), pediatric dentistry, microscopic root canal.

> These extra services need a specialist consultation to scope, so the agent
> books a **Consultation** and the clinic schedules the procedure. Turning any of
> them into a first-class bookable type is a Prisma enum change — quote separately.

## 7. Facts the AI answers

| Question | Answer |
|---|---|
| Insurance / self-pay | Private clinic. Accepts health-savings-account cards (egészségpénztár) and self-payers; does not bill public insurance. |
| Payment methods | Cash (HUF), bank card (VISA/Mastercard), health-savings-account card. |
| Cancellation policy | Cancel ≥24 h ahead. Within 24 h: standby fee 10,000 HUF per scheduled hour. |
| New-patient instructions | Arrive 10–15 min early; bring photo ID, TAJ card, and a medication list. |
| Emergency during hours | Call the clinic; we fit you in as soon as possible. |
| Life-threatening emergency number | 112 |
| Never say / promise | No specific prices beyond the published Start package; no clinical/treatment advice; no guarantee of a specific doctor/time without a tool check. |

## 8. The AI receptionist

| Field | Answer |
|---|---|
| Name | Petra |
| Languages | Hungarian (primary), English |
| Greeting (HU) | "Corona Dental, jó napot kívánok! Miben segíthetek?" |
| Greeting (EN) | "Corona Dental, hello! How can I help you?" |
| AI disclosure required? | Yes — state it's a virtual/AI assistant in the opening message. |
| Tone | Calm, concise, reassuring; patients may be anxious. |

**New chapter for the prompt (added):** a **"New-patient package"** section. When a
patient says they are new, the agent mentions the **Start package** (31,000 HUF:
panoramic X-ray + cleaning + specialist consult) **once**, as a helpful option,
then continues the normal booking flow. It is config-driven (`promo` in
`corona.ts`) and only appears for clinics that set it — Sunshine has none, so its
prompt is unchanged. See §"New chapter" below.

## 9. Telephony

> **No longer in scope.** The voice agent was retired on 2026-08-18 and the product does not
> touch the clinic's phone line. The clinic's number below is kept only as a contact detail —
> patients who call it reach the clinic's own staff, exactly as before.

| Field | Answer |
|---|---|
| Existing number | Yes (fictional +36 26 555 0142) — clinic-operated, not integrated. |
| Transfer to human? | N/A; the chat logs a callback request instead. |

## 10. Legal & data protection

| Field | Answer |
|---|---|
| DPA signatory | Practice director *(fictional)* |
| Data-protection contact | admin@coronadental.example |
| Chat transcript retention | 90 days |
| Patient record retention | Per HU dental record rules; confirm with the customer. |
| Privacy-policy URL | https://corona.appointer.hu/privacy *(placeholder)* |
| AI disclosure wording | Stated in the assistant's opening message. |

## 11. E-mail sending

| Field | Answer |
|---|---|
| Sender | Ours for the demo (shared n8n Gmail credential). |
| Reply-to | info@coronadental.example |

---

## New chapter added to the prompt

The customer runs a fixed-price new-patient promotion, which is a natural thing
for a receptionist to surface. Rather than hardcode it, it is a `promo` field on
the clinic config that switches on a **"New-patient package"** chapter in the
shared prompt:

```
## New-patient package
- The clinic offers a package for new patients: <promo text>
- When a patient tells you they are new, mention it once, briefly and naturally —
  as a helpful option, not a hard sell. Translate it into the patient's language.
- Do not repeat it later, and do not bring it up for existing patients.
- It is an in-person offer arranged at the clinic — you cannot add it to a booking
  or take payment. If they're interested, note it and continue the booking flow.
```

Rendered by [`buildChatSystemPrompt`](../../apps/api/src/prompts/chat-receptionist.ts)
whenever `clinic.promo` is set. The `promo` text and its translations live in `corona.ts`,
so changing the offer is a config edit, not a prompt edit.

## Issued identifiers (fill during onboarding)

| Item | Value |
|---|---|
| Coolify resource | _(tbd)_ |
| Key fingerprint | _(tbd — after unlock)_ |
| Sentry projects | corona-api, corona-web |
| Backup healthcheck | _(tbd)_ |
