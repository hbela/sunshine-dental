import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { ChatConversationSchema, ChatConversationDetailSchema } from '@repo/shared'
import { api } from '@/lib/api'

export type ChatConversation = z.infer<typeof ChatConversationSchema>
export type ChatConversationDetail = z.infer<typeof ChatConversationDetailSchema>

export interface ChatStats {
  totalChats: number
  successful: number
  bySentiment: { positive: number; neutral: number; negative: number }
  chatsToday: number
  chatsThisWeek: number
}

export interface ChatLogFilters {
  from?: string
  to?: string
  language?: string
  successful?: 'true' | 'false'
  page?: number
  limit?: number
}

/** GET /api/chat/conversations — list with filters + pagination (ASSISTANT/ADMIN). */
export function useChatLogs(filters: ChatLogFilters) {
  return useQuery({
    queryKey: ['chat-logs', filters],
    queryFn: async () =>
      (await api.get<ChatConversation[]>('/api/chat/conversations', { params: filters })).data,
  })
}

/** GET /api/chat/stats — aggregated stats (ASSISTANT/ADMIN). */
export function useChatStats(enabled = true) {
  return useQuery({
    queryKey: ['chat-logs', 'stats'],
    enabled,
    queryFn: async () => (await api.get<ChatStats>('/api/chat/stats')).data,
  })
}

/** GET /api/chat/conversations/:id — a conversation with its transcript. */
export function useChatLog(id: string | undefined) {
  return useQuery({
    queryKey: ['chat-log', id],
    enabled: !!id,
    queryFn: async () =>
      (await api.get<ChatConversationDetail>(`/api/chat/conversations/${id}`)).data,
  })
}
