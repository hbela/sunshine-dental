import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { PatientSchema } from '@repo/shared'
import type { Appointment } from './useAppointments'
import { api } from '@/lib/api'

export type Patient = z.infer<typeof PatientSchema>
export interface PatientWithHistory extends Patient {
  appointments: Appointment[]
}

export interface PatientFilters {
  search?: string
  page?: number
  limit?: number
}

/** GET /api/patients — list with search + pagination. */
export function usePatients(filters: PatientFilters) {
  return useQuery({
    queryKey: ['patients', filters],
    queryFn: async () => (await api.get<Patient[]>('/api/patients', { params: filters })).data,
  })
}

/** GET /api/patients/:id — details + appointment history. */
export function usePatient(id: string | undefined) {
  return useQuery({
    queryKey: ['patient', id],
    enabled: !!id,
    queryFn: async () => (await api.get<PatientWithHistory>(`/api/patients/${id}`)).data,
  })
}

export interface UpdatePatientInput {
  name?: string
  phone?: string
  email?: string
  reason?: string
  is_new_patient?: boolean
  callback_requested?: boolean
  preferred_time?: string
  notes?: string
}

/** PUT /api/patients/:id — update patient info. */
export function useUpdatePatient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...input }: UpdatePatientInput & { id: string }) =>
      (await api.put<Patient>(`/api/patients/${id}`, input)).data,
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['patients'] })
      qc.invalidateQueries({ queryKey: ['patient', vars.id] })
    },
  })
}
