import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Role } from './useRole'

export interface DirectoryUser {
  id: string
  name: string
  role: Role
}

/** GET /api/users — lightweight directory (id + name + role) for pickers. */
export function useUsersDirectory(role?: Role) {
  return useQuery({
    queryKey: ['users-directory', role ?? 'all'],
    queryFn: async () =>
      (await api.get<DirectoryUser[]>('/api/users', { params: role ? { role } : {} })).data,
    staleTime: 5 * 60 * 1000,
  })
}
