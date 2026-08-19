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
  availabilityPatternId: z.string().nullable().optional(),
  availabilityExceptionId: z.string().nullable().optional(),
  createdBy: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const AvailabilityRangeSchema = z.object({
  start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
});

export const AvailabilityDaySchema = z.object({
  weekday: z.number().int().min(1).max(7),
  ranges: z.array(AvailabilityRangeSchema),
});

export const AvailabilityPatternInputSchema = z.object({
  effectiveFrom: z.string().date(),
  effectiveUntil: z.string().date().nullable().optional(),
  windows: z.array(AvailabilityDaySchema),
});

export const AvailabilityExceptionInputSchema = z.object({
  date: z.string().date(),
  windows: z.array(AvailabilityRangeSchema),
});

export const AvailabilityExceptionSchema =
  AvailabilityExceptionInputSchema.extend({
    id: z.string(),
    patternId: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
  });

export const AvailabilityPatternSchema = AvailabilityPatternInputSchema.extend({
  id: z.string(),
  providerId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  exceptions: z.array(AvailabilityExceptionSchema),
});

export type AvailabilityRange = z.infer<typeof AvailabilityRangeSchema>;
export type AvailabilityDay = z.infer<typeof AvailabilityDaySchema>;
export type AvailabilityPatternInput = z.infer<
  typeof AvailabilityPatternInputSchema
>;
export type AvailabilityExceptionInput = z.infer<
  typeof AvailabilityExceptionInputSchema
>;
