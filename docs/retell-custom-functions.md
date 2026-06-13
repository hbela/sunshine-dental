# Retell Custom Functions Configuration

All 6 functions use the **same n8n webhook endpoint URL**:
```
https://n8ndev.appointer.hu/webhook/retell-custom-functions
```

All functions use **HTTP POST** method.

> For each function below, copy the Name, Description, and Parameters JSON Schema into the Retell dashboard under your agent's "Functions" / "Tools" configuration.

> **Multilingual (`language`):** every function takes an optional `language` enum (`en` / `hu` / `de`)
> carrying the caller's detected language. The agent is instructed (see the prompt's *Language
> Handling* section) to set it on every call. The n8n router uses it to localize the FAQ answer and
> the confirmation email; the other functions return language-neutral data that the LLM relays in the
> caller's language. The schemas/code are kept in sync with the live agent by
> `workflows/scripts/retell-add-language.mjs`.

---

## Function 1: check_availability

**Name**: `check_availability`

**Description**: Check available appointment slots for a given date and optional doctor. Slots are computed live from each doctor's own calendar (their available hours minus existing bookings, breaks, and time off), so availability varies by doctor and by date. Call this when a patient wants to schedule or reschedule an appointment to see what times are available. Optionally pass `provider_name` to filter results for a specific doctor; if omitted, slots are returned for the first available doctor.

**URL**: `https://n8ndev.appointer.hu/webhook/retell-custom-functions`

**Method**: POST

**Speak during execution**: Enabled - "Let me check our availability for that date..."

**Parameters (JSON Schema)**:
```json
{
  "type": "object",
  "required": ["date"],
  "properties": {
    "date": {
      "type": "string",
      "description": "The date to check availability for, in YYYY-MM-DD format"
    },
    "appointment_type": {
      "type": "string",
      "description": "Type of appointment needed",
      "enum": [
        "new_patient_exam",
        "cleaning",
        "deep_cleaning",
        "filling",
        "crown_prep",
        "consultation",
        "emergency"
      ]
    },
    "provider_name": {
      "type": "string",
      "description": "Name (or partial name) of the preferred doctor. If omitted, returns slots for the first available provider."
    },
    "language": {
      "type": "string",
      "description": "The caller's detected language, for localizing FAQ answers and the confirmation email. One of: en (English), hu (Hungarian), de (German).",
      "enum": ["en", "hu", "de"]
    }
  }
}
```

---

## Function 2: book_appointment

**Name**: `book_appointment`

**Description**: Book a confirmed appointment slot. Only call this AFTER checking availability and confirming the time with the patient. Requires patient name, contact info, date, time, and appointment type.

**URL**: `https://n8ndev.appointer.hu/webhook/retell-custom-functions`

**Method**: POST

**Speak during execution**: Enabled - "I'm booking that appointment for you now..."

**Parameters (JSON Schema)**:
```json
{
  "type": "object",
  "required": ["patient_name", "phone", "date", "time", "appointment_type"],
  "properties": {
    "patient_name": {
      "type": "string",
      "description": "Full name of the patient"
    },
    "phone": {
      "type": "string",
      "description": "Patient phone number"
    },
    "email": {
      "type": "string",
      "description": "Patient email address (optional but preferred for confirmation)"
    },
    "date": {
      "type": "string",
      "description": "Appointment date in YYYY-MM-DD format"
    },
    "time": {
      "type": "string",
      "description": "Appointment time in HH:MM format (24-hour)"
    },
    "appointment_type": {
      "type": "string",
      "description": "Type of appointment",
      "enum": [
        "new_patient_exam",
        "cleaning",
        "deep_cleaning",
        "filling",
        "crown_prep",
        "consultation",
        "emergency"
      ]
    },
    "is_new_patient": {
      "type": "boolean",
      "description": "Whether this is a new patient"
    },
    "provider_name": {
      "type": "string",
      "description": "Name of the doctor the appointment is booked with, as confirmed during the availability check."
    },
    "notes": {
      "type": "string",
      "description": "Additional notes about the visit reason or special needs"
    },
    "language": {
      "type": "string",
      "description": "The caller's detected language, for localizing FAQ answers and the confirmation email. One of: en (English), hu (Hungarian), de (German).",
      "enum": ["en", "hu", "de"]
    }
  }
}
```

---

## Function 3: cancel_appointment

**Name**: `cancel_appointment`

**Description**: Cancel an existing appointment. The patient must provide their name and the date of the appointment to cancel.

**URL**: `https://n8ndev.appointer.hu/webhook/retell-custom-functions`

**Method**: POST

**Speak during execution**: Enabled - "Let me look up that appointment..."

**Parameters (JSON Schema)**:
```json
{
  "type": "object",
  "required": ["patient_name", "date"],
  "properties": {
    "patient_name": {
      "type": "string",
      "description": "Full name of the patient whose appointment should be cancelled"
    },
    "date": {
      "type": "string",
      "description": "The date of the appointment to cancel in YYYY-MM-DD format"
    },
    "time": {
      "type": "string",
      "description": "The time of the appointment to cancel in HH:MM format (24-hour), if known"
    },
    "reason": {
      "type": "string",
      "description": "Reason for cancellation"
    },
    "language": {
      "type": "string",
      "description": "The caller's detected language, for localizing FAQ answers and the confirmation email. One of: en (English), hu (Hungarian), de (German).",
      "enum": ["en", "hu", "de"]
    }
  }
}
```

---

## Function 4: get_faq_answer

**Name**: `get_faq_answer`

**Description**: Look up answers to frequently asked questions about the dental office, including office hours, services offered, insurance accepted, emergency instructions, cancellation policy, and new patient information. Call this whenever a patient asks about any of these topics.

**URL**: `https://n8ndev.appointer.hu/webhook/retell-custom-functions`

**Method**: POST

**Speak during execution**: Disabled (response is fast)

**Parameters (JSON Schema)**:
```json
{
  "type": "object",
  "required": ["topic"],
  "properties": {
    "topic": {
      "type": "string",
      "description": "The FAQ topic to look up",
      "enum": [
        "office_hours",
        "services",
        "insurance",
        "emergency",
        "cancellation_policy",
        "new_patient_info",
        "location",
        "payment_options"
      ]
    },
    "specific_question": {
      "type": "string",
      "description": "The specific question the patient asked, for more targeted answers"
    },
    "language": {
      "type": "string",
      "description": "The caller's detected language, used to return the FAQ answer in that language. One of: en (English), hu (Hungarian), de (German). Falls back to en.",
      "enum": ["en", "hu", "de"]
    }
  }
}
```

---

## Function 5: capture_patient_info

**Name**: `capture_patient_info`

**Description**: Save new patient information to our records. Call this when you have gathered a new patient's contact details and they are not booking an appointment right now, or when a patient requests a callback from the office.

**URL**: `https://n8ndev.appointer.hu/webhook/retell-custom-functions`

**Method**: POST

**Speak during execution**: Disabled

**Parameters (JSON Schema)**:
```json
{
  "type": "object",
  "required": ["patient_name", "phone"],
  "properties": {
    "patient_name": {
      "type": "string",
      "description": "Full name of the patient"
    },
    "phone": {
      "type": "string",
      "description": "Patient phone number"
    },
    "email": {
      "type": "string",
      "description": "Patient email address"
    },
    "reason": {
      "type": "string",
      "description": "Why the patient called or what they need"
    },
    "is_new_patient": {
      "type": "boolean",
      "description": "Whether this is a new patient"
    },
    "callback_requested": {
      "type": "boolean",
      "description": "Whether the patient requested a callback from the office"
    },
    "preferred_time": {
      "type": "string",
      "description": "The patient's preferred time of day for a callback or visit",
      "enum": ["morning", "afternoon", "evening"]
    },
    "language": {
      "type": "string",
      "description": "The caller's detected language, for localizing FAQ answers and the confirmation email. One of: en (English), hu (Hungarian), de (German).",
      "enum": ["en", "hu", "de"]
    }
  }
}
```

---

## Function 6: list_available_providers

**Name**: `list_available_providers`

**Description**: Get a list of doctors who have at least one available appointment slot on a given date, based on each doctor's own calendar. Call this when the caller asks which doctors are available on a date, or when the caller has no preferred doctor and you want to offer choices before checking specific slots.

**URL**: `https://n8ndev.appointer.hu/webhook/retell-custom-functions`

**Method**: POST

**Speak during execution**: Enabled - "Let me check which of our doctors are available on that date..."

**Parameters (JSON Schema)**:
```json
{
  "type": "object",
  "required": ["date"],
  "properties": {
    "date": {
      "type": "string",
      "description": "The date to check, in YYYY-MM-DD format"
    },
    "appointment_type": {
      "type": "string",
      "description": "Optional appointment type to filter by slot duration feasibility",
      "enum": [
        "new_patient_exam",
        "cleaning",
        "deep_cleaning",
        "filling",
        "crown_prep",
        "consultation",
        "emergency"
      ]
    },
    "language": {
      "type": "string",
      "description": "The caller's detected language, for localizing FAQ answers and the confirmation email. One of: en (English), hu (Hungarian), de (German).",
      "enum": ["en", "hu", "de"]
    }
  }
}
```

**Expected response example**:
```json
{
  "result": "On 2026-03-10, the following doctors have availability: Dr. Anna Kovács (8 slots), Dr. Péter Nagy (3 slots). Do you have a preference?"
}
```

If no providers are available:
```json
{
  "result": "I'm sorry, there are no doctors available on 2026-03-10. Would you like to try a different date?"
}
```

---

## Retell Post-Call Webhook (Separate Configuration)

This is configured in the Retell dashboard under **Account Settings > Webhooks** (not per-function):

**URL**: `https://n8ndev.appointer.hu/webhook/retell-post-call`

**Events to enable**:
- `call_ended`
- `call_analyzed`

---

## Retell Custom Function Request Format

When Retell calls a custom function, it sends a POST request with this structure:

```json
{
  "name": "check_availability",
  "args": {
    "date": "2026-03-15",
    "appointment_type": "cleaning",
    "language": "hu"
  },
  "call": {
    "call_id": "call_abc123",
    "agent_id": "agent_xyz789",
    "from_number": "+15551234567",
    "to_number": "+15559876543",
    "transcript": [
      { "role": "agent", "content": "Hello! How can I help you today?" },
      { "role": "user", "content": "I'd like to schedule a cleaning." }
    ],
    "retell_llm_dynamic_variables": {}
  }
}
```

**Expected response**: A JSON object or plain string (max 15,000 characters). Our n8n workflows return:

```json
{
  "result": "Available times on 2026-03-15 for a cleaning (30 minutes): 8:00 AM, 8:30 AM, 9:00 AM, 2:00 PM, 3:30 PM. Which time would you prefer?"
}
```

The `result` string is passed back to the Retell LLM, which reads it naturally to the caller.
