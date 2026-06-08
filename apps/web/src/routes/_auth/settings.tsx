import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_auth/settings')({
  component: () => (
    <section>
      <h1 className="mb-6 text-3xl font-semibold text-foreground">Settings</h1>
      <div className="rounded-lg border bg-card p-6 text-muted-foreground">
        Profile and password settings coming soon.
      </div>
    </section>
  ),
})
