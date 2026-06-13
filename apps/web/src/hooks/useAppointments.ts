import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { AppointmentParams } from '@repo/shared'
import { api } from '@/lib/api'

export type Appointment = AppointmentParams

export interface AppointmentFilters {
  date?: string
  provider_id?: string
  status?: string
  patient_name?: string
  page?: number
  limit?: number
}

/** GET /api/appointments — list with filters + pagination. */
export function useAppointments(filters: AppointmentFilters) {
  return useQuery({
    queryKey: ['appointments', filters],
    queryFn: async () =>
      (await api.get<Appointment[]>('/api/appointments', { params: filters })).data,
  })
}

/** GET /api/appointments/patient/:patient_id — a patient's appointment history. */
export function usePatientAppointments(patientId: string | undefined) {
  return useQuery({
    queryKey: ['appointments', 'patient', patientId],
    enabled: !!patientId,
    queryFn: async () =>
      (await api.get<Appointment[]>(`/api/appointments/patient/${patientId}`)).data,
  })
}

function useInvalidateAppointments() {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: ['appointments'] })
    qc.invalidateQueries({ queryKey: ['calendar-events'] })
  }
}

/** PUT /api/appointments/:id/cancel — cancel by id (web app). */
export function useCancelAppointmentById() {
  const invalidate = useInvalidateAppointments()
  return useMutation({
    mutationFn: async (id: string) => (await api.put(`/api/appointments/${id}/cancel`, {})).data,
    onSuccess: invalidate,
  })
}

/** PUT /api/appointments/:id/complete — mark completed (PROVIDER/ADMIN). */
export function useCompleteAppointmentById() {
  const invalidate = useInvalidateAppointments()
  return useMutation({
    mutationFn: async (id: string) => (await api.put(`/api/appointments/${id}/complete`)).data,
    onSuccess: invalidate,
  })
}
