import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export type CalendarEventType = 'AVAILABLE' | 'BLOCKED' | 'VACATION'
export type AppointmentStatus = 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'NO_SHOW'

/** Unified event item returned by GET /api/calendar/:providerId/events. */
export interface CalendarItem {
  id: string
  kind: 'availability' | 'appointment'
  title: string
  start: string
  end: string
  allDay: boolean
  // availability
  eventType?: CalendarEventType
  recurrence?: string | null
  /** Series base start/end (recurring events only) — for editing the whole series. */
  seriesStart?: string
  seriesEnd?: string
  // appointment
  appointmentId?: string
  status?: AppointmentStatus
  appointmentType?: string
  patientName?: string
  patientPhone?: string | null
  notes?: string | null
}

const eventsUrl = (providerId: string) => `/api/calendar/${providerId}/events`

export function useCalendarEvents(providerId: string | undefined, from: string, to: string) {
  return useQuery({
    queryKey: ['calendar-events', providerId, from, to],
    enabled: !!providerId,
    queryFn: async () =>
      (await api.get<CalendarItem[]>(eventsUrl(providerId as string), { params: { from, to } })).data,
  })
}

/** Per-provider queries for the multi-resource view. */
export function useCalendarEventsMulti(providerIds: string[], from: string, to: string) {
  return useQueries({
    queries: providerIds.map((id) => ({
      queryKey: ['calendar-events', id, from, to],
      queryFn: async () =>
        (await api.get<CalendarItem[]>(eventsUrl(id), { params: { from, to } })).data,
    })),
  })
}

// ── Mutations ───────────────────────────────────────────────────────────────

export interface BookAppointmentInput {
  provider_id: string
  patient_name: string
  phone?: string
  email?: string
  appointment_type: string
  date: string
  time: string
  notes?: string
}

export interface CreateEventInput {
  providerId: string
  title: string
  start: string
  end: string
  allDay: boolean
  type: CalendarEventType
  notes?: string
  /** RRULE string (e.g. "FREQ=WEEKLY;BYDAY=MO,WE"); null/empty clears recurrence. */
  recurrence?: string | null
}

function useInvalidateCalendar() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: ['calendar-events'] })
}

export function useBookAppointment() {
  const invalidate = useInvalidateCalendar()
  return useMutation({
    mutationFn: async (input: BookAppointmentInput) =>
      (await api.post('/api/appointments', input)).data,
    onSuccess: invalidate,
  })
}

export function useCancelAppointment() {
  const invalidate = useInvalidateCalendar()
  return useMutation({
    mutationFn: async (id: string) => (await api.put(`/api/appointments/${id}/cancel`, {})).data,
    onSuccess: invalidate,
  })
}

export function useCompleteAppointment() {
  const invalidate = useInvalidateCalendar()
  return useMutation({
    mutationFn: async (id: string) => (await api.put(`/api/appointments/${id}/complete`)).data,
    onSuccess: invalidate,
  })
}

export function useCreateEvent() {
  const invalidate = useInvalidateCalendar()
  return useMutation({
    mutationFn: async (input: CreateEventInput) =>
      (await api.post('/api/calendar/events', input)).data,
    onSuccess: invalidate,
  })
}

export function useUpdateEvent() {
  const invalidate = useInvalidateCalendar()
  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<CreateEventInput> & { id: string }) =>
      (await api.put(`/api/calendar/events/${id}`, input)).data,
    onSuccess: invalidate,
  })
}

export function useDeleteEvent() {
  const invalidate = useInvalidateCalendar()
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/api/calendar/events/${id}`)).data,
    onSuccess: invalidate,
  })
}
