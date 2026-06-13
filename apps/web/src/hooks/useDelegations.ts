import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface Delegation {
  id: string
  ownerId: string
  delegateId: string
  canView: boolean
  canEdit: boolean
  canBook: boolean
  validFrom: string | null
  validUntil: string | null
  createdAt: string
  updatedAt: string
}

export interface MyDelegations {
  owned: Delegation[]
  received: Delegation[]
}

/** GET /api/delegations/me — delegations I own (as a provider) + received. */
export function useMyDelegations() {
  return useQuery({
    queryKey: ['delegations'],
    queryFn: async () => (await api.get<MyDelegations>('/api/delegations/me')).data,
  })
}

function useInvalidateDelegations() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: ['delegations'] })
}

export interface CreateDelegationInput {
  ownerId: string
  delegateId: string
  canView?: boolean
  canEdit?: boolean
  canBook?: boolean
  validFrom?: string
  validUntil?: string
}

/** POST /api/delegations — grant a delegation (PROVIDER/ADMIN). */
export function useCreateDelegation() {
  const invalidate = useInvalidateDelegations()
  return useMutation({
    mutationFn: async (input: CreateDelegationInput) =>
      (await api.post<Delegation>('/api/delegations', input)).data,
    onSuccess: invalidate,
  })
}

export type UpdateDelegationInput = Partial<
  Pick<Delegation, 'canView' | 'canEdit' | 'canBook' | 'validFrom' | 'validUntil'>
>

/** PUT /api/delegations/:id — update permissions / validity. */
export function useUpdateDelegation() {
  const invalidate = useInvalidateDelegations()
  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateDelegationInput & { id: string }) =>
      (await api.put<Delegation>(`/api/delegations/${id}`, input)).data,
    onSuccess: invalidate,
  })
}

/** DELETE /api/delegations/:id — revoke. */
export function useDeleteDelegation() {
  const invalidate = useInvalidateDelegations()
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/api/delegations/${id}`)).data,
    onSuccess: invalidate,
  })
}
