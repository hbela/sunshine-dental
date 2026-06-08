import { createFileRoute } from '@tanstack/react-router'
import { requireRole } from '@/lib/route-guards'

export const Route = createFileRoute('/_auth/call-logs')({
  beforeLoad: () => requireRole(['ASSISTANT', 'ADMIN']),
  component: () => (
    <section>
      <h1 className="mb-6 text-3xl font-semibold text-foreground">Call Logs</h1>
      <div className="rounded-lg border bg-card p-6 text-muted-foreground">
        Call log viewer and stats coming soon.
      </div>
    </section>
  ),
})
