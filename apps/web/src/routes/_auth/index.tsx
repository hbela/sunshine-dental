import { createFileRoute, Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { Clock, Phone, ArrowRight, CalendarDays } from 'lucide-react'
import { authClient } from '@/auth-client'
import { useRole } from '@/hooks/useRole'
import { useProviders } from '@/hooks/useProviders'
import { useAppointments, type Appointment } from '@/hooks/useAppointments'
import { usePatients } from '@/hooks/usePatients'
import { useCallLogStats, useCallLogs, type CallLog } from '@/hooks/useCallLogs'
import { useEnum } from '@/i18n/useEnum'
import { useFormat } from '@/i18n/useFormat'
import { givenNameOf } from '@/lib/name'
import { Badge } from '@/components/ui/badge'

const today = () => format(new Date(), 'yyyy-MM-dd')

function greetingKey() {
  const h = new Date().getHours()
  return h < 12 ? 'greeting.morning' : h < 18 ? 'greeting.afternoon' : 'greeting.evening'
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline'
function statusVariant(status: string): BadgeVariant {
  switch (status) {
    case 'CONFIRMED':
      return 'default'
    case 'COMPLETED':
      return 'secondary'
    case 'CANCELLED':
    case 'NO_SHOW':
      return 'destructive'
    default:
      return 'outline'
  }
}
function sentimentVariant(s: string | null): BadgeVariant {
  switch (s) {
    case 'Positive':
      return 'default'
    case 'Negative':
      return 'destructive'
    default:
      return 'secondary'
  }
}

/** Greeting block — left-aligned headline with a right-offset sub-label (asymmetry). */
function GreetingHeader({ subtitle }: { subtitle: string }) {
  const { t } = useTranslation('dashboard')
  const { data: session } = authClient.useSession()
  const name = givenNameOf(session?.user ?? {})
  return (
    <header className="flex flex-wrap items-end justify-between gap-2">
      <h1 className="font-display text-4xl font-bold tracking-tight text-primary">
        {t(greetingKey())}
        {name ? `, ${name}` : ''}
      </h1>
      <p className="pb-1 text-sm text-muted-foreground">
        {format(new Date(), 'EEEE, d MMMM')} · {subtitle}
      </p>
    </header>
  )
}

/** Wellness progress ring — sage gradient fill on a soft track. */
function ProgressRing({ value, size = 76, stroke = 10 }: { value: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(100, value))
  const dash = (pct / 100) * c
  return (
    <span className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <defs>
          <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#55624d" />
            <stop offset="100%" stopColor="#98a68e" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--muted)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#ringGrad)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
        />
      </svg>
      <span className="absolute font-display text-sm font-bold text-primary">{Math.round(pct)}%</span>
    </span>
  )
}

function StatCard({
  label,
  value,
  ring,
}: {
  label: string
  value: number | string | null | undefined
  ring?: number
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
      <div>
        <h3 className="text-sm font-medium text-muted-foreground">{label}</h3>
        {ring === undefined && (
          <p className="mt-2 font-display text-3xl font-bold text-primary">{value ?? '—'}</p>
        )}
      </div>
      {ring !== undefined && <ProgressRing value={ring} />}
    </div>
  )
}

/** Section card with a header (title + optional "view all" link) and no divider lines. */
function PanelCard({
  title,
  to,
  viewAll,
  icon: Icon,
  children,
}: {
  title: string
  to?: string
  viewAll?: string
  icon: typeof Clock
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-foreground">
          <Icon className="size-4 text-primary" strokeWidth={1.75} />
          {title}
        </h2>
        {to && viewAll && (
          <Link
            to={to}
            className="inline-flex items-center gap-1 text-sm font-medium text-primary transition-colors hover:text-primary/80"
          >
            {viewAll}
            <ArrowRight className="size-3.5" />
          </Link>
        )}
      </div>
      {children}
    </section>
  )
}

function ScheduleList({ appointments }: { appointments: Appointment[] }) {
  const { t } = useTranslation('dashboard')
  const { tEnum } = useEnum()
  if (appointments.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">{t('schedule.empty')}</p>
  }
  const rows = [...appointments].sort((a, b) => a.startTime.localeCompare(b.startTime))
  return (
    <ul className="space-y-2">
      {rows.map((a) => (
        <li
          key={a.id}
          className="flex items-center gap-4 rounded-xl bg-muted/40 px-4 py-3 transition-colors hover:bg-muted/70"
        >
          <div className="flex w-20 shrink-0 items-center gap-1.5 text-sm font-medium text-foreground">
            <Clock className="size-3.5 text-muted-foreground" strokeWidth={1.75} />
            {a.startTime}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-foreground">{a.patientName}</p>
            <p className="truncate text-xs text-muted-foreground">
              {a.providerName} · {tEnum('appointmentType', a.appointmentType)}
            </p>
          </div>
          <Badge variant={statusVariant(a.status)}>{tEnum('appointmentStatus', a.status)}</Badge>
        </li>
      ))}
    </ul>
  )
}

function RecentCallsList({ calls }: { calls: CallLog[] }) {
  const { t } = useTranslation('dashboard')
  const { t: tcl } = useTranslation('callLogs')
  const { formatDateTime } = useFormat()
  if (calls.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">{t('recentCalls.empty')}</p>
  }
  return (
    <ul className="space-y-2">
      {calls.map((c) => (
        <li key={c.id} className="flex items-center gap-3 rounded-xl bg-muted/40 px-4 py-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-fixed text-primary">
            <Phone className="size-4" strokeWidth={1.75} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{c.fromNumber ?? '—'}</p>
            <p className="truncate text-xs text-muted-foreground">
              {formatDateTime(new Date(c.createdAt))} · {formatDuration(c.durationSeconds)}
            </p>
          </div>
          {c.sentiment && (
            <Badge variant={sentimentVariant(c.sentiment)}>
              {tcl(`sentiment.${c.sentiment}`, { defaultValue: c.sentiment })}
            </Badge>
          )}
        </li>
      ))}
    </ul>
  )
}

/** PROVIDER view — own schedule at a glance (no call-log access). */
function ProviderDashboard() {
  const { t } = useTranslation('dashboard')
  const { userId } = useRole()
  const { data: providers } = useProviders()
  const own = providers?.find((p) => p.userId === userId)
  const { data: appts } = useAppointments({ date: today(), provider_id: own?.id })

  const total = appts?.length
  const confirmed = appts?.filter((a) => a.status === 'CONFIRMED').length
  const completed = appts?.filter((a) => a.status === 'COMPLETED').length

  return (
    <div className="space-y-8">
      <GreetingHeader subtitle={t('providerOverview')} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label={t('stats.appointmentsToday')} value={total} />
        <StatCard label={t('stats.confirmedToday')} value={confirmed} />
        <StatCard label={t('stats.completedToday')} value={completed} />
      </div>
      <PanelCard title={t('schedule.title')} to="/calendar" viewAll={t('schedule.viewAll')} icon={CalendarDays}>
        <ScheduleList appointments={appts ?? []} />
      </PanelCard>
    </div>
  )
}

/** ASSISTANT/ADMIN view — clinic-wide stats incl. call analytics. */
function StaffDashboard() {
  const { t } = useTranslation('dashboard')
  const { data: appts } = useAppointments({ date: today() })
  const { data: patients } = usePatients({ limit: 100 })
  const { data: stats } = useCallLogStats()
  const { data: recentCalls } = useCallLogs({ limit: 5 })

  const appointmentsToday = appts?.length
  const pendingCallbacks = patients?.filter((p) => p.callbackRequested).length

  let sentiment: number | undefined
  if (stats) {
    const { positive, neutral, negative } = stats.bySentiment
    const n = positive + neutral + negative
    sentiment = n > 0 ? Math.round((positive / n) * 100) : 0
  }

  return (
    <div className="space-y-8">
      <GreetingHeader subtitle={t('overview')} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t('stats.appointmentsToday')} value={appointmentsToday} />
        <StatCard label={t('stats.pendingCallbacks')} value={pendingCallbacks} />
        <StatCard label={t('stats.callsThisWeek')} value={stats?.callsThisWeek} />
        <StatCard label={t('stats.sentimentScore')} value={`${sentiment ?? 0}%`} ring={sentiment} />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <PanelCard
            title={t('schedule.title')}
            to="/appointments"
            viewAll={t('schedule.viewAll')}
            icon={CalendarDays}
          >
            <ScheduleList appointments={appts ?? []} />
          </PanelCard>
        </div>
        <PanelCard title={t('recentCalls.title')} to="/call-logs" viewAll={t('recentCalls.viewAll')} icon={Phone}>
          <RecentCallsList calls={recentCalls ?? []} />
        </PanelCard>
      </div>
    </div>
  )
}

function DashboardPage() {
  const { t: tc } = useTranslation('common')
  const { role, isProvider } = useRole()

  if (!role) return <p className="text-muted-foreground">{tc('loading')}</p>
  return isProvider ? <ProviderDashboard /> : <StaffDashboard />
}

export const Route = createFileRoute('/_auth/')({
  component: DashboardPage,
})
