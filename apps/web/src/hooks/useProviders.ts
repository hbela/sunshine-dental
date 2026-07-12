import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface ProviderListItem {
  id: string
  userId: string
  name: string
  title: string | null
  givenName: string
  familyName: string
  specialty: string | null
  phone: string | null
}

export function useProviders() {
  return useQuery({
    queryKey: ['providers'],
    queryFn: async () => (await api.get<ProviderListItem[]>('/api/providers')).data,
    staleTime: 5 * 60 * 1000,
  })
}
