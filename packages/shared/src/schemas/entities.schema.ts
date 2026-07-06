import { z } from 'zod';

export const ProviderSchema = z.object({
  id: z.string(),
  userId: z.string(),
  specialty: z.string().nullable(),
  phone: z.string().nullable(),
  bio: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const PatientSchema = z.object({
  id: z.string(),
  name: z.string(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  reason: z.string().nullable(),
  isNewPatient: z.boolean(),
  callbackRequested: z.boolean(),
  preferredTime: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const CallLogSchema = z.object({
  id: z.string(),
  callId: z.string(),
  agentId: z.string().nullable(),
  patientId: z.string().nullable(),
  fromNumber: z.string().nullable(),
  toNumber: z.string().nullable(),
  direction: z.string(),
  durationSeconds: z.number(),
  status: z.string().nullable(),
  disconnectionReason: z.string().nullable(),
  transcript: z.string().nullable(),
  summary: z.string().nullable(),
  sentiment: z.string().nullable(),
  successful: z.boolean().nullable(),
  startTime: z.string().nullable(),
  endTime: z.string().nullable(),
  createdAt: z.string(),
});

export const ChatMessageSchema = z.object({
  id: z.string(),
  role: z.enum(['USER', 'ASSISTANT', 'TOOL']),
  content: z.string(),
  toolName: z.string().nullable(),
  createdAt: z.string(),
});

/** List row for the staff Chat Logs view (no `token`, no messages). */
export const ChatConversationSchema = z.object({
  id: z.string(),
  patientId: z.string().nullable(),
  appointmentId: z.string().nullable(),
  language: z.string(),
  status: z.enum(['ACTIVE', 'ENDED']),
  summary: z.string().nullable(),
  sentiment: z.string().nullable(),
  successful: z.boolean().nullable(),
  messageCount: z.number(),
  startedAt: z.string(),
  endedAt: z.string().nullable(),
  createdAt: z.string(),
});

/** Detail payload: a conversation plus its full transcript. */
export const ChatConversationDetailSchema = ChatConversationSchema.extend({
  messages: z.array(ChatMessageSchema),
});

export const CalendarEventTypeSchema = z.enum([
  'AVAILABLE',
  'BLOCKED',
  'VACATION',
]);

export const CalendarEventSchema = z.object({
  id: z.string(),
  providerId: z.string(),
  title: z.string(),
  start: z.string(),
  end: z.string(),
  allDay: z.boolean(),
  type: CalendarEventTypeSchema,
  recurrence: z.string().nullable(),
  notes: z.string().nullable(),
  createdBy: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
