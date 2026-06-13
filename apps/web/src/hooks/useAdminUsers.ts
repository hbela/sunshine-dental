import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Role } from './useRole'

export interface AdminUser {
  id: string
  name: string
  email: string
  role: Role
  createdAt: string
}

export interface CreateUserInput {
  name: string
  email: string
  password: string
  role: 'PROVIDER' | 'ASSISTANT'
  specialty?: string
  phone?: string
  bio?: string
}

export interface CreateUserResult {
  id: string
  name: string
  email: string
  role: string
  temporaryPassword: string
  providerId?: string | null
}

/** GET /api/admin/users — list all users, optionally filtered by role. */
export function useAdminUsers(role?: Role | '') {
  return useQuery({
    queryKey: ['admin-users', role || 'all'],
    queryFn: async () =>
      (await api.get<AdminUser[]>('/api/admin/users', { params: role ? { role } : {} })).data,
  })
}

function useInvalidateUsers() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: ['admin-users'] })
}

/** POST /api/admin/users — create a provider or assistant. */
export function useCreateUser() {
  const invalidate = useInvalidateUsers()
  return useMutation({
    mutationFn: async (input: CreateUserInput) =>
      (await api.post<CreateUserResult>('/api/admin/users', input)).data,
    onSuccess: invalidate,
  })
}

/** PATCH /api/admin/users/:id/role — change a user's role. */
export function useUpdateUserRole() {
  const invalidate = useInvalidateUsers()
  return useMutation({
    mutationFn: async ({ id, role }: { id: string; role: Role }) =>
      (await api.patch(`/api/admin/users/${id}/role`, { role })).data,
    onSuccess: invalidate,
  })
}

/** DELETE /api/admin/users/:id — delete a user (cascades). */
export function useDeleteUser() {
  const invalidate = useInvalidateUsers()
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/api/admin/users/${id}`)).data,
    onSuccess: invalidate,
  })
}
