import { z } from 'zod';

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
  // Open on purpose: the valid set is per-clinic (`ClinicConfig.services`), and
  // this schema is also the *response* schema on every appointment route — a
  // closed enum here would reject a clinic's own service on the way out.
  appointmentType: z.string(),
  date: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  durationMinutes: z.number(),
  status: AppointmentStatusSchema,
  isNewPatient: z.boolean(),
  notes: z.string().nullable(),
});

export type AppointmentParams = z.infer<typeof AppointmentSchema>;
