import type { ReactNode } from 'react'
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import {
  LayoutDashboard,
  Calendar,
  ClipboardList,
  Users,
  Phone,
  Settings,
  Shield,
  LogOut,
} from 'lucide-react'
import { authClient } from '@/auth-client'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Role = 'PROVIDER' | 'ASSISTANT' | 'ADMIN'
const ALL: Role[] = ['PROVIDER', 'ASSISTANT', 'ADMIN']

interface NavItem {
  to: string
  label: string
  icon: typeof LayoutDashboard
  roles: Role[]
}

const NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ALL },
  { to: '/calendar', label: 'Calendar', icon: Calendar, roles: ALL },
  { to: '/appointments', label: 'Appointments', icon: ClipboardList, roles: ALL },
  { to: '/patients', label: 'Patients', icon: Users, roles: ['ASSISTANT', 'ADMIN'] },
  { to: '/call-logs', label: 'Call Logs', icon: Phone, roles: ['ASSISTANT', 'ADMIN'] },
  { to: '/admin/users', label: 'Users', icon: Shield, roles: ['ADMIN'] },
  { to: '/settings', label: 'Settings', icon: Settings, roles: ALL },
]

export function AppLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const { data: session } = authClient.useSession()
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  const user = session?.user
  const role = (user as { role?: Role } | undefined)?.role
  const items = role ? NAV.filter((item) => item.roles.includes(role)) : NAV

  const handleLogout = async () => {
    await authClient.signOut()
    navigate({ to: '/login' })
  }

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <aside className="flex w-64 flex-col border-r bg-card">
        <div className="flex h-16 items-center border-b px-6">
          <span className="text-lg font-bold text-foreground">Sunshine Dental</span>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {items.map(({ to, label, icon: Icon }) => {
            const active = to === '/' ? pathname === '/' : pathname.startsWith(to)
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )}
              >
                <Icon className="size-4" />
                {label}
              </Link>
            )
          })}
        </nav>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 items-center justify-between border-b bg-card px-6">
          <div />
          <div className="flex items-center gap-4">
            {user && (
              <div className="text-right leading-tight">
                <div className="text-sm font-medium text-foreground">{user.name}</div>
                <div className="text-xs text-muted-foreground">
                  {role ?? user.email}
                </div>
              </div>
            )}
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="size-4" />
              Logout
            </Button>
          </div>
        </header>
        <main className="flex-1 overflow-auto bg-slate-50 p-6">{children}</main>
      </div>
    </div>
  )
}
