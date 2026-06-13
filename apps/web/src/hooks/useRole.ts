import { authClient } from '@/auth-client'

export type Role = 'PROVIDER' | 'ASSISTANT' | 'ADMIN'

/**
 * Current session role + convenience flags for role-gated UI.
 * Mirrors the inline pattern used in DentalCalendar/AppLayout so action
 * gating (e.g. hiding "Mark completed" from ASSISTANT) stays consistent.
 */
export function useRole() {
  const { data: session } = authClient.useSession()
  const user = session?.user
  const role = (user as { role?: Role } | undefined)?.role
  return {
    role,
    userId: user?.id,
    isProvider: role === 'PROVIDER',
    isAssistant: role === 'ASSISTANT',
    isAdmin: role === 'ADMIN',
    /** PROVIDER or ADMIN — may mark appointments completed, manage delegations. */
    canManageAppointments: role === 'PROVIDER' || role === 'ADMIN',
  }
}
