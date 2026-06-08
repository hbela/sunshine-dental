import { createFileRoute } from '@tanstack/react-router'
import { requireRole } from '@/lib/route-guards'

export const Route = createFileRoute('/_auth/admin/users')({
  beforeLoad: () => requireRole(['ADMIN']),
  component: () => (
    <section>
      <h1 className="mb-6 text-3xl font-semibold text-foreground">User Management</h1>
      <div className="rounded-lg border bg-card p-6 text-muted-foreground">
        Admin user management coming soon.
      </div>
    </section>
  ),
})
