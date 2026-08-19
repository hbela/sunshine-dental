import { describe, expect, it } from 'vitest';
import { AppointmentSchema } from '@repo/shared';

describe('appointment response contract', () => {
  it('does not require the retired voice callId field', () => {
    const result = AppointmentSchema.safeParse({
      id: 'appointment-1',
      patientId: 'patient-1',
      patientName: 'Test Patient',
      patientPhone: null,
      patientEmail: null,
      providerId: 'provider-1',
      providerName: 'Dr. Test Provider',
      appointmentType: 'CONSULTATION',
      date: '2026-08-20',
      startTime: '09:00',
      endTime: '09:30',
      durationMinutes: 30,
      status: 'CONFIRMED',
      isNewPatient: false,
      notes: null,
    });

    expect(result.success).toBe(true);
  });
});
