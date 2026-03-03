import { z } from 'zod';

export const AppointmentTypeSchema = z.enum([
  'CLEANING',
  'NEW_PATIENT_EXAM',
  'DEEP_CLEANING',
  'FILLING',
  'CROWN_PREP',
  'CONSULTATION',
  'EMERGENCY',
]);

export const AppointmentDurations: Record<string, number> = {
  CLEANING: 30,
  NEW_PATIENT_EXAM: 60,
  DEEP_CLEANING: 60,
  FILLING: 45,
  CROWN_PREP: 90,
  CONSULTATION: 30,
  EMERGENCY: 30,
};

export const AppointmentStatusSchema = z.enum([
  'CONFIRMED',
  'CANCELLED',
  'COMPLETED',
  'NO_SHOW',
]);

export const AppointmentSchema = z.object({
  id: z.string(),
  patientId: z.string().nullable(),
  patientName: z.string(),
  patientPhone: z.string().nullable(),
  patientEmail: z.string().nullable(),
  providerId: z.string(),
  providerName: z.string(),
  appointmentType: AppointmentTypeSchema,
  date: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  durationMinutes: z.number(),
  status: AppointmentStatusSchema,
  isNewPatient: z.boolean(),
  notes: z.string().nullable(),
  callId: z.string().nullable(),
});

export type AppointmentParams = z.infer<typeof AppointmentSchema>;
