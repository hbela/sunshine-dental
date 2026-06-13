import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { ProviderSchema } from '@repo/shared'
import { api } from '@/lib/api'
import { useProviders } from './useProviders'
import { useRole } from './useRole'

export type Provider = z.infer<typeof ProviderSchema>

/** Resolve the signed-in PROVIDER's own provider id from the providers list. */
export function useOwnProviderId() {
  const { userId, isProvider } = useRole()
  const { data: providers } = useProviders()
  if (!isProvider || !providers) return undefined
  return providers.find((p) => p.userId === userId)?.id
}

/** GET /api/providers/:id — full provider profile (incl. bio, isActive). */
export function useProvider(id: string | undefined) {
  return useQuery({
    queryKey: ['provider', id],
    enabled: !!id,
    queryFn: async () => (await api.get<Provider>(`/api/providers/${id}`)).data,
  })
}

export interface UpdateProviderInput {
  specialty?: string
  phone?: string
  bio?: string
}

/** PUT /api/providers/me — update own provider profile (PROVIDER only). */
export function useUpdateMyProvider() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: UpdateProviderInput) =>
      (await api.put<Provider>('/api/providers/me', input)).data,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['provider', data.id] })
      qc.invalidateQueries({ queryKey: ['providers'] })
    },
  })
}
