import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

const STAT_KEYS = [
  'appointmentsToday',
  'pendingCallbacks',
  'callsThisWeek',
  'sentimentScore',
] as const

function DashboardPage() {
  const { t } = useTranslation('dashboard')
  return (
    <div>
      <h1 className="text-3xl font-semibold mb-6 text-gray-800">{t('title')}</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Mock Stats Cards */}
        {STAT_KEYS.map((key) => (
          <div key={key} className="bg-white p-6 rounded shadow border">
            <h3 className="text-sm font-medium text-gray-500">{t(`stats.${key}`)}</h3>
            <p className="text-2xl font-bold mt-2 text-gray-900">-</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export const Route = createFileRoute('/_auth/')({
  component: DashboardPage,
})
