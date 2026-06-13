import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { CallLogSchema } from '@repo/shared'
import { api } from '@/lib/api'

export type CallLog = z.infer<typeof CallLogSchema>

export interface CallLogStats {
  totalCalls: number
  successful: number
  bySentiment: { positive: number; neutral: number; negative: number }
  avgDurationSeconds: number
  callsToday: number
  callsThisWeek: number
}

export interface CallLogFilters {
  from?: string
  to?: string
  sentiment?: string
  successful?: 'true' | 'false'
  page?: number
  limit?: number
}

/** GET /api/call-logs — list with filters + pagination (ASSISTANT/ADMIN). */
export function useCallLogs(filters: CallLogFilters) {
  return useQuery({
    queryKey: ['call-logs', filters],
    queryFn: async () => (await api.get<CallLog[]>('/api/call-logs', { params: filters })).data,
  })
}

/** GET /api/call-logs/stats — aggregated stats (ASSISTANT/ADMIN). */
export function useCallLogStats(enabled = true) {
  return useQuery({
    queryKey: ['call-logs', 'stats'],
    enabled,
    queryFn: async () => (await api.get<CallLogStats>('/api/call-logs/stats')).data,
  })
}

/** GET /api/call-logs/:call_id — single call log + transcript. */
export function useCallLog(callId: string | undefined) {
  return useQuery({
    queryKey: ['call-log', callId],
    enabled: !!callId,
    queryFn: async () => (await api.get<CallLog>(`/api/call-logs/${callId}`)).data,
  })
}
