import { createFileRoute, redirect, Outlet, Link } from '@tanstack/react-router'
import { authClient } from '../auth-client'

export const Route = createFileRoute('/_auth')({
  beforeLoad: async () => {
    // Basic session guard - commented so dashboard is viewable without backend running during dev
    // const { data: session } = await authClient.getSession()
    // if (!session) throw redirect({ to: '/login' })
  },
  component: () => (
    <div className="flex h-screen w-full">
      <aside className="w-64 bg-primary text-primary-foreground h-full p-4 flex flex-col gap-2">
        <h2 className="text-xl font-bold mb-4">Sunshine Dental</h2>
        <Link to="/" className="p-2 hover:bg-slate-700 rounded">&gt; Dashboard</Link>
        <Link to="/calendar" className="p-2 hover:bg-slate-700 rounded">&gt; Calendar</Link>
        <Link to="/appointments" className="p-2 hover:bg-slate-700 rounded">&gt; Appointments</Link>
        <Link to="/patients" className="p-2 hover:bg-slate-700 rounded">&gt; Patients</Link>
      </aside>
      <main className="flex-1 w-full bg-slate-50 p-6 overflow-auto">
        <Outlet />
      </main>
    </div>
  ),
})
