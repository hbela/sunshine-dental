import type { ReactNode } from 'react'
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
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
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { ThemeToggle } from '@/components/ThemeToggle'
import { useEnum } from '@/i18n/useEnum'
import { cn } from '@/lib/utils'

type Role = 'PROVIDER' | 'ASSISTANT' | 'ADMIN'
const ALL: Role[] = ['PROVIDER', 'ASSISTANT', 'ADMIN']

type NavKey =
  | 'dashboard'
  | 'calendar'
  | 'appointments'
  | 'patients'
  | 'callLogs'
  | 'users'
  | 'settings'

interface NavItem {
  to: string
  labelKey: NavKey
  icon: typeof LayoutDashboard
  roles: Role[]
}

const NAV: NavItem[] = [
  { to: '/', labelKey: 'dashboard', icon: LayoutDashboard, roles: ALL },
  { to: '/calendar', labelKey: 'calendar', icon: Calendar, roles: ALL },
  { to: '/appointments', labelKey: 'appointments', icon: ClipboardList, roles: ALL },
  { to: '/patients', labelKey: 'patients', icon: Users, roles: ['ASSISTANT', 'ADMIN'] },
  { to: '/call-logs', labelKey: 'callLogs', icon: Phone, roles: ['ASSISTANT', 'ADMIN'] },
  { to: '/admin/users', labelKey: 'users', icon: Shield, roles: ['ADMIN'] },
  { to: '/settings', labelKey: 'settings', icon: Settings, roles: ALL },
]

export function AppLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { tEnum } = useEnum()
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
      <aside className="flex w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
        <div className="flex h-16 items-center border-b border-sidebar-border px-6">
          <span className="text-lg font-bold">{t('appName')}</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
          {items.map(({ to, labelKey, icon: Icon }) => {
            const active = to === '/' ? pathname === '/' : pathname.startsWith(to)
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                )}
              >
                <Icon className="size-4" />
                {t(`nav:${labelKey}`)}
              </Link>
            )
          })}
        </nav>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 items-center justify-between border-b bg-card px-6">
          <div />
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <LanguageSwitcher />
            {user && (
              <div className="text-right leading-tight">
                <div className="text-sm font-medium text-foreground">{user.name}</div>
                <div className="text-xs text-muted-foreground">
                  {role ? tEnum('role', role) : user.email}
                </div>
              </div>
            )}
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="size-4" />
              {t('logout')}
            </Button>
          </div>
        </header>
        <main className="flex-1 overflow-auto bg-background p-6">{children}</main>
      </div>
    </div>
  )
}
