import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export type EncryptionStatus = 'locked' | 'unlocked' | 'unknown'

interface HealthResponse {
  status: string
  db: string
  encryption?: 'locked' | 'unlocked'
  time: string
}

/**
 * Patient-data encryption state, polled from the public health endpoint.
 * After every API restart the keyring is locked until an ADMIN unlocks it
 * (POST /api/admin/unlock), so the layout shows a banner while locked.
 */
export function useEncryptionStatus(): EncryptionStatus {
  const { data } = useQuery({
    queryKey: ['encryption-status'],
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    retry: false,
    queryFn: async (): Promise<EncryptionStatus> => {
      try {
        const res = await api.get<HealthResponse>('/api/health')
        return res.data.encryption ?? 'unknown'
      } catch (err: unknown) {
        // health returns 503 when the DB is down but still reports encryption
        const data = (err as { response?: { data?: HealthResponse } })?.response?.data
        return data?.encryption ?? 'unknown'
      }
    },
  })
  return data ?? 'unknown'
}

/** POST /api/admin/unlock — submit the clinic master key (ADMIN only). */
export function useUnlockEncryption() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (key: string) =>
      (await api.post<{ ok: true }>('/api/admin/unlock', { key })).data,
    onSuccess: () => {
      // Everything PII-backed was 503ing while locked — refetch it all.
      qc.invalidateQueries()
    },
  })
}
