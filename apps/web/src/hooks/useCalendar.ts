import {
  useQuery,
  useQueries,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { api } from '@/lib/api'

export type CalendarEventType = 'AVAILABLE' | 'BLOCKED' | 'VACATION'
export type AppointmentStatus =
  | 'CONFIRMED'
  | 'CANCELLED'
  | 'COMPLETED'
  | 'NO_SHOW'

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
  availabilityPatternId?: string | null
  availabilityExceptionId?: string | null
  managedByPattern?: boolean
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

export interface AvailabilityRange {
  start: string
  end: string
}

export interface AvailabilityDay {
  weekday: number
  ranges: AvailabilityRange[]
}

export interface AvailabilityException {
  id: string
  patternId: string
  date: string
  windows: AvailabilityRange[]
  createdAt: string
  updatedAt: string
}

export interface AvailabilityPattern {
  id: string
  providerId: string
  effectiveFrom: string
  effectiveUntil: string | null
  windows: AvailabilityDay[]
  exceptions: AvailabilityException[]
  createdAt: string
  updatedAt: string
}

export interface AvailabilityPatternInput {
  effectiveFrom: string
  effectiveUntil?: string | null
  windows: AvailabilityDay[]
}

const eventsUrl = (providerId: string) => `/api/calendar/${providerId}/events`

export function useCalendarEvents(
  providerId: string | undefined,
  from: string,
  to: string,
) {
  return useQuery({
    queryKey: ['calendar-events', providerId, from, to],
    enabled: !!providerId,
    queryFn: async () =>
      (
        await api.get<CalendarItem[]>(eventsUrl(providerId as string), {
          params: { from, to },
        })
      ).data,
  })
}

/** Per-provider queries for the multi-resource view. */
export function useCalendarEventsMulti(
  providerIds: string[],
  from: string,
  to: string,
) {
  return useQueries({
    queries: providerIds.map((id) => ({
      queryKey: ['calendar-events', id, from, to],
      queryFn: async () =>
        (await api.get<CalendarItem[]>(eventsUrl(id), { params: { from, to } }))
          .data,
    })),
  })
}

export function useAvailabilityPatterns(providerId: string | undefined) {
  return useQuery({
    queryKey: ['availability-patterns', providerId],
    enabled: !!providerId,
    queryFn: async () =>
      (
        await api.get<AvailabilityPattern[]>(
          `/api/calendar/${providerId}/availability-patterns`,
        )
      ).data,
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
    mutationFn: async (id: string) =>
      (await api.put(`/api/appointments/${id}/cancel`, {})).data,
    onSuccess: invalidate,
  })
}

export function useCompleteAppointment() {
  const invalidate = useInvalidateCalendar()
  return useMutation({
    mutationFn: async (id: string) =>
      (await api.put(`/api/appointments/${id}/complete`)).data,
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
    mutationFn: async ({
      id,
      ...input
    }: Partial<CreateEventInput> & { id: string }) =>
      (await api.put(`/api/calendar/events/${id}`, input)).data,
    onSuccess: invalidate,
  })
}

export function useDeleteEvent() {
  const invalidate = useInvalidateCalendar()
  return useMutation({
    mutationFn: async (id: string) =>
      (await api.delete(`/api/calendar/events/${id}`)).data,
    onSuccess: invalidate,
  })
}

function useInvalidateAvailability() {
  const qc = useQueryClient()
  return (providerId: string) => {
    void qc.invalidateQueries({
      queryKey: ['availability-patterns', providerId],
    })
    void qc.invalidateQueries({ queryKey: ['calendar-events'] })
  }
}

export function useCreateAvailabilityPattern() {
  const invalidate = useInvalidateAvailability()
  return useMutation({
    mutationFn: async ({
      providerId,
      ...input
    }: AvailabilityPatternInput & { providerId: string }) =>
      (
        await api.post<AvailabilityPattern>(
          `/api/calendar/${providerId}/availability-patterns`,
          input,
        )
      ).data,
    onSuccess: (data) => invalidate(data.providerId),
  })
}

export function useUpdateAvailabilityPattern() {
  const invalidate = useInvalidateAvailability()
  return useMutation({
    mutationFn: async (
      variables: AvailabilityPatternInput & { id: string; providerId: string },
    ) =>
      (
        await api.put<AvailabilityPattern>(
          `/api/calendar/availability-patterns/${variables.id}`,
          {
            effectiveFrom: variables.effectiveFrom,
            effectiveUntil: variables.effectiveUntil,
            windows: variables.windows,
          },
        )
      ).data,
    onSuccess: (data) => invalidate(data.providerId),
  })
}

export function useDeleteAvailabilityPattern() {
  const invalidate = useInvalidateAvailability()
  return useMutation({
    mutationFn: async ({
      id,
      providerId,
    }: {
      id: string
      providerId: string
    }) => {
      await api.delete(`/api/calendar/availability-patterns/${id}`)
      return providerId
    },
    onSuccess: invalidate,
  })
}

export function useUpsertAvailabilityException() {
  const invalidate = useInvalidateAvailability()
  return useMutation({
    mutationFn: async (variables: {
      patternId: string
      providerId: string
      date: string
      windows: AvailabilityRange[]
    }) =>
      (
        await api.put<AvailabilityException>(
          `/api/calendar/availability-patterns/${variables.patternId}/exceptions`,
          {
            date: variables.date,
            windows: variables.windows,
          },
        )
      ).data,
    onSuccess: (_data, variables) => invalidate(variables.providerId),
  })
}

export function useDeleteAvailabilityException() {
  const invalidate = useInvalidateAvailability()
  return useMutation({
    mutationFn: async ({
      patternId,
      exceptionId,
      providerId,
    }: {
      patternId: string
      exceptionId: string
      providerId: string
    }) => {
      await api.delete(
        `/api/calendar/availability-patterns/${patternId}/exceptions/${exceptionId}`,
      )
      return providerId
    },
    onSuccess: invalidate,
  })
}
