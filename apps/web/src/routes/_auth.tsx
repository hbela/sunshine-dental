import { createFileRoute, redirect, Outlet } from '@tanstack/react-router'
import { authClient } from '@/auth-client'
import { AppLayout } from '@/components/layout/AppLayout'

export const Route = createFileRoute('/_auth')({
  beforeLoad: async () => {
    const { data: session } = await authClient.getSession()
    if (!session) throw redirect({ to: '/login' })
  },
  component: () => (
    <AppLayout>
      <Outlet />
    </AppLayout>
  ),
})
