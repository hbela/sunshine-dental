import { createFileRoute, redirect, Outlet } from '@tanstack/react-router'
import { authClient } from '@/auth-client'
import { AppLayout } from '@/components/layout/AppLayout'

export const Route = createFileRoute('/_auth')({
  beforeLoad: async () => {
    let session = null
    try {
      session = (await authClient.getSession()).data
    } catch {
      session = null // API unreachable → treat as signed out
    }
    if (!session) throw redirect({ to: '/login' })
  },
  component: () => (
    <AppLayout>
      <Outlet />
    </AppLayout>
  ),
})
