import { redirect } from '@tanstack/react-router'
import { authClient } from '@/auth-client'

/**
 * beforeLoad guard: require an authenticated session whose role is allowed.
 * Redirects to /login when unauthenticated, or to / when the role is not permitted.
 */
export async function requireRole(roles: string[]) {
  const { data: session } = await authClient.getSession()
  if (!session) throw redirect({ to: '/login' })
  const role = (session.user as { role?: string }).role
  if (!role || !roles.includes(role)) throw redirect({ to: '/' })
}
