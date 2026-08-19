import Anthropic from '@anthropic-ai/sdk';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { prisma } from '../lib/prisma.js';
import { HttpError } from '../lib/errors.js';
import { agentServiceCodes, defaultServiceCode, findService, isValidPhoneNumber } from '@repo/shared';
import { CalendarService } from './calendar.service.js';
import { AppointmentService } from './appointment.service.js';
import { buildChatSystemPrompt } from '../prompts/chat-receptionist.js';
import { clinic, clinicToday } from '../lib/clinic.js';
import { assertUnlocked, decryptString, encryptString } from '../lib/crypto.js';
import { decryptRow, decryptRows, encryptRow, phoneIndexOf } from '../lib/crypto-fields.js';

// Sonnet for stronger Hungarian/German (Haiku produced register drift and
// calques); prompt caching below keeps the cost near the old Haiku setup.
const MODEL = 'claude-sonnet-5';
const MAX_TOKENS = 1024;
const MAX_TOOL_ITERATIONS = 6; // safety cap on tool round-trips within one turn
const LANGS = ['en', 'hu', 'de'] as const;

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new HttpError(503, 'Chat is not configured (missing ANTHROPIC_API_KEY)');
  }
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _client;
}


/** lower_case tool value (e.g. "new_patient_exam") → the clinic's UPPER code, or undefined. */
function normalizeType(t?: string): string | undefined {
  return findService(clinic, t)?.code;
}

/**
 * Ask n8n to email the patient a booking confirmation, mirroring the voice
 * agent's `Send Confirmation Email` node (the chat books in-process and would
 * otherwise send nothing). Best-effort: a no-op unless `N8N_BOOKING_WEBHOOK_URL`
 * is configured and the patient gave an email, and it never throws — a failed
 * email must not fail an already-committed booking.
 */
async function sendBookingConfirmationEmail(payload: {
  patient_name: string;
  email?: string | null;
  date: string;
  time: string;
  provider_name?: string | null;
  appointment_type: string;
  is_new_patient?: boolean;
  language?: string;
}): Promise<void> {
  const url = process.env.N8N_BOOKING_WEBHOOK_URL;
  if (!url || !payload.email) return;
  // The webhook requires this shared secret (header auth in n8n plus a
  // fail-closed check inside the workflow). Missing = skip loudly rather than
  // POST an unauthenticated request the workflow must reject anyway.
  const secret = process.env.N8N_WEBHOOK_SECRET;
  if (!secret) {
    console.error('N8N_WEBHOOK_SECRET is not set — skipping booking confirmation email');
    return;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-webhook-secret': secret },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch {
    /* best-effort — the booking already succeeded */
  } finally {
    clearTimeout(timer);
  }
}

/** What this clinic actually offers, lowercased — n8n and the router upper-case it back. */
const APPOINTMENT_TYPE_ENUM = agentServiceCodes(clinic);
const LANGUAGE_PARAM = {
  type: 'string' as const,
  enum: [...clinic.languages],
  description: `The patient's detected language (${clinic.languages.join('/')}). Always set it.`,
};

/**
 * The 5 chat tools. FAQ answers are folded into the system prompt rather than
 * exposed as a sixth tool. Each executes in-process against the existing
 * services — nothing here goes out to n8n.
 */
const tools: Anthropic.Tool[] = [
  {
    name: 'check_availability',
    description:
      "Check available appointment slots for a date and optional doctor. Slots are computed live from each doctor's calendar. Call before offering or confirming any time.",
    input_schema: {
      type: 'object',
      required: ['date'],
      properties: {
        date: { type: 'string', description: 'Date in YYYY-MM-DD format' },
        appointment_type: { type: 'string', enum: APPOINTMENT_TYPE_ENUM, description: 'Type of appointment' },
        provider_name: { type: 'string', description: 'Preferred doctor name (partial ok). Omit for first available.' },
        language: LANGUAGE_PARAM,
      },
    },
  },
  {
    name: 'list_available_providers',
    description:
      'List doctors who have at least one open slot on a date. Use when the patient has no preferred doctor or asks who is available.',
    input_schema: {
      type: 'object',
      required: ['date'],
      properties: {
        date: { type: 'string', description: 'Date in YYYY-MM-DD format' },
        appointment_type: { type: 'string', enum: APPOINTMENT_TYPE_ENUM, description: 'Optional type to size slots' },
        language: LANGUAGE_PARAM,
      },
    },
  },
  {
    name: 'book_appointment',
    description:
      'Book a confirmed appointment. Only call AFTER check_availability and after confirming the time with the patient.',
    input_schema: {
      type: 'object',
      required: ['patient_name', 'phone', 'date', 'time', 'appointment_type'],
      properties: {
        patient_name: { type: 'string', description: 'Full name of the patient' },
        phone: { type: 'string', description: 'Patient phone number' },
        email: { type: 'string', description: 'Patient email (optional, preferred for confirmation)' },
        date: { type: 'string', description: 'Date in YYYY-MM-DD format' },
        time: { type: 'string', description: 'Time in 24-hour HH:MM format' },
        appointment_type: { type: 'string', enum: APPOINTMENT_TYPE_ENUM, description: 'Type of appointment' },
        is_new_patient: { type: 'boolean', description: 'Whether this is a new patient' },
        provider_name: { type: 'string', description: 'Doctor confirmed during availability check (omit for auto-assign)' },
        notes: { type: 'string', description: 'Reason for visit or special needs' },
        language: LANGUAGE_PARAM,
      },
    },
  },
  {
    name: 'cancel_appointment',
    description: 'Cancel an existing appointment by patient name and date (optional time).',
    input_schema: {
      type: 'object',
      required: ['patient_name', 'date'],
      properties: {
        patient_name: { type: 'string', description: 'Full name of the patient' },
        date: { type: 'string', description: 'Date of the appointment in YYYY-MM-DD format' },
        time: { type: 'string', description: 'Time in HH:MM (24-hour), if known' },
        reason: { type: 'string', description: 'Reason for cancellation' },
        language: LANGUAGE_PARAM,
      },
    },
  },
  {
    name: 'capture_patient_info',
    description:
      'Save patient contact details or log a callback request (patient is not booking now, or a human needs to follow up).',
    input_schema: {
      type: 'object',
      required: ['patient_name'],
      properties: {
        patient_name: { type: 'string', description: 'Full name of the patient' },
        phone: { type: 'string', description: 'Patient phone number' },
        email: { type: 'string', description: 'Patient email address' },
        reason: { type: 'string', description: 'What the patient needs' },
        is_new_patient: { type: 'boolean', description: 'Whether this is a new patient' },
        callback_requested: { type: 'boolean', description: 'Whether the patient wants a callback' },
        preferred_time: { type: 'string', enum: ['morning', 'afternoon', 'evening'], description: 'Preferred time of day' },
        language: LANGUAGE_PARAM,
      },
    },
  },
];

async function capturePatient(input: any) {
  // Phone is ciphertext in the DB — dedupe by the HMAC blind index instead.
  const phoneIndex = phoneIndexOf(input.phone);
  const existing = phoneIndex
    ? await prisma.patient.findFirst({ where: { phoneIndex } })
    : null;
  if (existing) {
    // Fallbacks may be the existing row's ciphertext values — encryptRow
    // leaves already-encrypted values untouched.
    return prisma.patient.update({
      where: { id: existing.id },
      data: encryptRow('patient', {
        name: input.patient_name ?? existing.name,
        email: input.email ?? existing.email,
        reason: input.reason ?? existing.reason,
        ...(typeof input.is_new_patient === 'boolean' ? { isNewPatient: input.is_new_patient } : {}),
        ...(typeof input.callback_requested === 'boolean' ? { callbackRequested: input.callback_requested } : {}),
        ...(input.preferred_time ? { preferredTime: input.preferred_time } : {}),
      }),
    });
  }
  return prisma.patient.create({
    data: encryptRow('patient', {
      name: input.patient_name,
      phone: input.phone ?? null,
      phoneIndex,
      email: input.email ?? null,
      reason: input.reason ?? null,
      isNewPatient: input.is_new_patient ?? true,
      callbackRequested: input.callback_requested ?? false,
      preferredTime: input.preferred_time ?? null,
    }),
  });
}

/** Execute one tool call and return a JSON string result for the model. */
async function runTool(conversationId: string, name: string, input: any): Promise<string> {
  try {
    // Reject a malformed phone before booking/saving so the model can ask the
    // patient to correct it (mirrors the voice agent's phone shape check).
    if ((name === 'book_appointment' || name === 'capture_patient_info') && input.phone) {
      if (!isValidPhoneNumber(input.phone)) {
        return JSON.stringify({
          error: `The phone number "${input.phone}" doesn't look valid. Ask the patient to repeat it — a Hungarian mobile is +36 followed by 9 digits (e.g. +36 20 257 6701).`,
          code: 'INVALID_PHONE',
        });
      }
    }

    switch (name) {
      case 'check_availability': {
        const type = normalizeType(input.appointment_type) ?? defaultServiceCode(clinic);
        const { slots, duration, provider_name } = await CalendarService.getAvailableSlots(
          input.date,
          type,
          undefined,
          input.provider_name,
        );
        return JSON.stringify({
          date: input.date,
          provider_name,
          appointment_type: type,
          duration_minutes: duration,
          available_times: slots,
        });
      }
      case 'list_available_providers': {
        const type = normalizeType(input.appointment_type);
        const providers = await CalendarService.getAvailableProviders(input.date, type);
        return JSON.stringify({ date: input.date, providers });
      }
      case 'book_appointment': {
        const type = normalizeType(input.appointment_type);
        if (!type) return JSON.stringify({ error: 'Unknown appointment type', code: 'BAD_TYPE' });
        const appt = await AppointmentService.book({
          patient_name: input.patient_name,
          phone: input.phone,
          email: input.email,
          appointment_type: type,
          date: input.date,
          time: input.time,
          provider_name: input.provider_name,
          is_new_patient: input.is_new_patient,
          notes: input.notes,
          call_id: `chat_${conversationId}`,
        });
        await prisma.chatConversation.update({
          where: { id: conversationId },
          data: { appointmentId: appt.id, ...(appt.patientId ? { patientId: appt.patientId } : {}) },
        });
        // Mirror the voice flow's confirmation email (best-effort, email-only).
        await sendBookingConfirmationEmail({
          patient_name: input.patient_name,
          email: input.email,
          date: appt.date,
          time: appt.startTime,
          provider_name: appt.providerName,
          appointment_type: String(input.appointment_type ?? type).toLowerCase(),
          is_new_patient: input.is_new_patient,
          language: input.language,
        });
        return JSON.stringify({
          booked: true,
          appointment: {
            date: appt.date,
            time: appt.startTime,
            provider_name: appt.providerName,
            appointment_type: appt.appointmentType,
            duration_minutes: appt.durationMinutes,
          },
        });
      }
      case 'cancel_appointment': {
        const res = await AppointmentService.cancelBySearch({
          patient_name: input.patient_name,
          date: input.date,
          time: input.time,
          reason: input.reason,
        });
        if (!res.found) return JSON.stringify({ found: false });
        return JSON.stringify({
          found: true,
          cancelled: {
            date: res.appointment.date,
            time: res.appointment.startTime,
            provider_name: res.appointment.providerName,
          },
        });
      }
      case 'capture_patient_info': {
        const patient = await capturePatient(input);
        await prisma.chatConversation.update({
          where: { id: conversationId },
          data: { patientId: patient.id },
        });
        return JSON.stringify({ saved: true });
      }
      default:
        return JSON.stringify({ error: `Unknown tool ${name}`, code: 'UNKNOWN_TOOL' });
    }
  } catch (err: any) {
    const code =
      err?.statusCode === 409
        ? 'SLOT_UNAVAILABLE'
        : err?.statusCode === 400
          ? 'INVALID_INPUT'
          : 'SYSTEM_ERROR';
    return JSON.stringify({ error: err?.message ?? 'Something went wrong', code });
  }
}

function serializeConversation(c: any) {
  return {
    id: c.id,
    patientId: c.patientId,
    appointmentId: c.appointmentId,
    language: c.language,
    status: c.status,
    summary: c.summary,
    sentiment: c.sentiment,
    successful: c.successful,
    messageCount: c._count?.messages ?? c.messages?.length ?? 0,
    startedAt: c.startedAt.toISOString(),
    endedAt: c.endedAt ? c.endedAt.toISOString() : null,
    createdAt: c.createdAt.toISOString(),
  };
}

export interface StreamCallbacks {
  onText: (delta: string) => void;
  onTool: (name: string) => void;
}

export class ChatService {
  /** Create a new conversation; returns the id + the secret resume token. */
  static async createConversation(language?: string) {
    // No PII is written here, but a locked keyring would fail the very first
    // message anyway — fail fast so the widget shows its "unavailable" state.
    assertUnlocked();
    const lang = LANGS.includes(language as any) ? (language as string) : 'en';
    const token = randomBytes(24).toString('hex');
    const convo = await prisma.chatConversation.create({ data: { token, language: lang } });
    return { id: convo.id, token };
  }

  /** Verify the browser's token matches the conversation, or throw 404. */
  static async requireConversation(id: string, token: string) {
    const convo = await prisma.chatConversation.findUnique({ where: { id } });
    const presented = Buffer.from(token ?? '');
    const expected = convo ? Buffer.from(convo.token) : Buffer.alloc(0);
    if (!convo || presented.length !== expected.length || !timingSafeEqual(presented, expected)) {
      throw new HttpError(404, 'Conversation not found');
    }
    return convo;
  }

  /**
   * Patient-facing transcript for resuming a conversation after a page reload.
   * Token-authenticated like posting; the browser no longer persists messages
   * locally (GDPR), so this is how the widget restores them. Tool rows are
   * staff-only and excluded.
   */
  static async transcript(id: string, token: string) {
    const convo = await this.requireConversation(id, token);
    const rows = decryptRows(
      'chatMessage',
      await prisma.chatMessage.findMany({
        where: { conversationId: convo.id, role: { in: ['USER', 'ASSISTANT'] } },
        orderBy: { createdAt: 'asc' },
      }),
    );
    return {
      messages: rows.map((m) => ({
        id: m.id as string,
        role: (m.role === 'USER' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: m.content as string,
      })),
    };
  }

  /**
   * Append a user message and stream the assistant's reply, running the tool
   * loop. Callbacks fire as text/tool events occur; returns the full reply text.
   */
  static async streamReply(conversationId: string, userText: string, cb: StreamCallbacks): Promise<string> {
    assertUnlocked();
    await prisma.chatMessage.create({
      data: { conversationId, role: 'USER', content: encryptString(userText) },
    });

    // Rebuild conversation context from prior visible turns (tool blocks are
    // not replayed). Rows are decrypted here: the model needs plaintext.
    const history = decryptRows(
      'chatMessage',
      await prisma.chatMessage.findMany({
        where: { conversationId, role: { in: ['USER', 'ASSISTANT'] } },
        orderBy: { createdAt: 'asc' },
      }),
    );
    // Coalesce consecutive same-role turns so the Messages API always sees a
    // valid user/assistant alternation (a prior failed turn can leave an
    // assistant-less user message otherwise).
    const messages: Anthropic.MessageParam[] = [];
    for (const m of history) {
      const role: 'user' | 'assistant' = m.role === 'USER' ? 'user' : 'assistant';
      const last = messages[messages.length - 1];
      if (last && last.role === role && typeof last.content === 'string') {
        last.content = `${last.content}\n\n${m.content}`;
      } else {
        messages.push({ role, content: m.content });
      }
    }

    const system = buildChatSystemPrompt(clinicToday(), clinic);
    let assistantText = '';

    for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
      const stream = client().messages.stream({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        // Cache breakpoint on the system block caches the whole fixed prefix
        // (tools + system, ~3.3k tokens): every call after the first within the
        // cache TTL pays the 90%-discounted cache-read rate instead of full input.
        system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
        tools,
        messages,
      });
      stream.on('text', (delta) => {
        assistantText += delta;
        cb.onText(delta);
      });
      const final = await stream.finalMessage();

      const turnText = final.content
        .filter((b) => b.type === 'text')
        .map((b) => (b as any).text)
        .join('');
      if (turnText.trim()) {
        await prisma.chatMessage.create({
          data: { conversationId, role: 'ASSISTANT', content: encryptString(turnText) },
        });
      }

      if (final.stop_reason !== 'tool_use') break;

      messages.push({ role: 'assistant', content: final.content as Anthropic.ContentBlockParam[] });
      const toolResults: Anthropic.ContentBlockParam[] = [];
      for (const block of final.content) {
        if (block.type !== 'tool_use') continue;
        cb.onTool(block.name);
        const result = await runTool(conversationId, block.name, block.input);
        await prisma.chatMessage.create({
          data: { conversationId, role: 'TOOL', content: encryptString(result), toolName: block.name },
        });
        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result });
      }
      messages.push({ role: 'user', content: toolResults });
    }

    return assistantText;
  }

  /**
   * Mark a conversation ended and (best-effort) generate summary/sentiment for
   * the staff Chat Logs view. Never throws to the caller.
   */
  static async endConversation(id: string, token: string) {
    const convo = await this.requireConversation(id, token);
    if (convo.status === 'ENDED') return;

    let summary: string | null = null;
    let sentiment: string | null = null;
    let successful: boolean | null = null;

    try {
      const msgs = decryptRows(
        'chatMessage',
        await prisma.chatMessage.findMany({
          where: { conversationId: id, role: { in: ['USER', 'ASSISTANT'] } },
          orderBy: { createdAt: 'asc' },
        }),
      );
      if (msgs.length && process.env.ANTHROPIC_API_KEY) {
        const transcript = msgs.map((m) => `${m.role}: ${m.content}`).join('\n');
        // Write the summary in the patient's language (sentiment stays an English enum).
        const langName =
          ({ en: 'English', hu: 'Hungarian', de: 'German' } as Record<string, string>)[
            convo.language
          ] ?? 'English';
        const res = await client().messages.create({
          model: MODEL,
          max_tokens: 300,
          system: `You analyze a dental clinic chat transcript between a patient (USER) and the receptionist (ASSISTANT). Write the "summary" in ${langName} (the patient's language). Respond ONLY with compact JSON: {"summary": string (1-2 sentences, in ${langName}), "sentiment": "Positive"|"Neutral"|"Negative", "successful": boolean (did the patient accomplish their goal, e.g. booked or got their answer)}. Keep "sentiment" exactly one of those three English words.`,
          messages: [{ role: 'user', content: transcript }],
        });
        const text = res.content
          .filter((b) => b.type === 'text')
          .map((b) => (b as any).text)
          .join('');
        const parsed = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? '{}');
        summary = typeof parsed.summary === 'string' ? parsed.summary : null;
        sentiment = ['Positive', 'Neutral', 'Negative'].includes(parsed.sentiment) ? parsed.sentiment : null;
        successful = typeof parsed.successful === 'boolean' ? parsed.successful : null;
      }
    } catch {
      /* best-effort — leave analysis null */
    }

    await prisma.chatConversation.update({
      where: { id },
      data: {
        status: 'ENDED',
        endedAt: new Date(),
        summary: summary === null ? null : encryptString(summary),
        sentiment,
        successful,
      },
    });
  }

  // ---- Staff-facing (dashboard) reads ----

  static async list(filters: {
    from?: string;
    to?: string;
    language?: string;
    successful?: boolean;
    page?: number;
    limit?: number;
  }) {
    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const limit = filters.limit && filters.limit > 0 ? filters.limit : 50;

    const where: any = {};
    if (filters.from || filters.to) {
      where.createdAt = {};
      if (filters.from) where.createdAt.gte = new Date(filters.from);
      if (filters.to) where.createdAt.lte = new Date(filters.to);
    }
    if (filters.language) where.language = filters.language;
    if (filters.successful !== undefined) where.successful = filters.successful;

    assertUnlocked();
    const rows = await prisma.chatConversation.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: { _count: { select: { messages: true } } },
    });
    return decryptRows('chatConversation', rows).map(serializeConversation);
  }

  static async detail(id: string) {
    assertUnlocked();
    const convo = await prisma.chatConversation.findUnique({
      where: { id },
      include: {
        _count: { select: { messages: true } },
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!convo) throw new HttpError(404, 'Conversation not found');
    return {
      ...serializeConversation(decryptRow('chatConversation', convo)),
      messages: decryptRows('chatMessage', convo.messages).map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        toolName: m.toolName,
        createdAt: m.createdAt.toISOString(),
      })),
    };
  }

  static async stats() {
    const now = new Date();
    const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setUTCDate(startOfWeek.getUTCDate() - startOfToday.getUTCDay());

    const [total, successful, positive, neutral, negative, today, thisWeek] = await Promise.all([
      prisma.chatConversation.count(),
      prisma.chatConversation.count({ where: { successful: true } }),
      prisma.chatConversation.count({ where: { sentiment: 'Positive' } }),
      prisma.chatConversation.count({ where: { sentiment: 'Neutral' } }),
      prisma.chatConversation.count({ where: { sentiment: 'Negative' } }),
      prisma.chatConversation.count({ where: { createdAt: { gte: startOfToday } } }),
      prisma.chatConversation.count({ where: { createdAt: { gte: startOfWeek } } }),
    ]);

    return {
      totalChats: total,
      successful,
      bySentiment: { positive, neutral, negative },
      chatsToday: today,
      chatsThisWeek: thisWeek,
    };
  }
}
