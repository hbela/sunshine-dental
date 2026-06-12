import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { requireRole } from '@/lib/route-guards'

function CallLogsPage() {
  const { t } = useTranslation('callLogs')
  return (
    <section>
      <h1 className="mb-6 text-3xl font-semibold text-foreground">{t('title')}</h1>
      <div className="rounded-lg border bg-card p-6 text-muted-foreground">{t('comingSoon')}</div>
    </section>
  )
}

export const Route = createFileRoute('/_auth/call-logs')({
  beforeLoad: () => requireRole(['ASSISTANT', 'ADMIN']),
  component: CallLogsPage,
})
