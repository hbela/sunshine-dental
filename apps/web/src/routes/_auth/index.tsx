import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { useRole } from '@/hooks/useRole'
import { useProviders } from '@/hooks/useProviders'
import { useAppointments } from '@/hooks/useAppointments'
import { usePatients } from '@/hooks/usePatients'
import { useCallLogStats } from '@/hooks/useCallLogs'

const today = () => format(new Date(), 'yyyy-MM-dd')

function StatCard({ label, value }: { label: string; value: number | string | null | undefined }) {
  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm">
      <h3 className="text-sm font-medium text-muted-foreground">{label}</h3>
      <p className="mt-2 text-2xl font-bold text-foreground">{value ?? '—'}</p>
    </div>
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
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      <StatCard label={t('stats.appointmentsToday')} value={total} />
      <StatCard label={t('stats.confirmedToday')} value={confirmed} />
      <StatCard label={t('stats.completedToday')} value={completed} />
    </div>
  )
}

/** ASSISTANT/ADMIN view — clinic-wide stats incl. call analytics. */
function StaffDashboard() {
  const { t } = useTranslation('dashboard')
  const { data: appts } = useAppointments({ date: today() })
  const { data: patients } = usePatients({ limit: 100 })
  const { data: stats } = useCallLogStats()

  const appointmentsToday = appts?.length
  const pendingCallbacks = patients?.filter((p) => p.callbackRequested).length

  let sentimentScore: string | undefined
  if (stats) {
    const { positive, neutral, negative } = stats.bySentiment
    const n = positive + neutral + negative
    sentimentScore = n > 0 ? `${Math.round((positive / n) * 100)}%` : '—'
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      <StatCard label={t('stats.appointmentsToday')} value={appointmentsToday} />
      <StatCard label={t('stats.pendingCallbacks')} value={pendingCallbacks} />
      <StatCard label={t('stats.callsThisWeek')} value={stats?.callsThisWeek} />
      <StatCard label={t('stats.sentimentScore')} value={sentimentScore} />
    </div>
  )
}

function DashboardPage() {
  const { t } = useTranslation('dashboard')
  const { t: tc } = useTranslation('common')
  const { role, isProvider } = useRole()

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold text-foreground">{t('title')}</h1>
      {!role ? (
        <p className="text-muted-foreground">{tc('loading')}</p>
      ) : isProvider ? (
        <ProviderDashboard />
      ) : (
        <StaffDashboard />
      )}
    </div>
  )
}

export const Route = createFileRoute('/_auth/')({
  component: DashboardPage,
})
