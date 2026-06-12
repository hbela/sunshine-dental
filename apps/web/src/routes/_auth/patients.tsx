import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { requireRole } from '@/lib/route-guards'

function PatientsPage() {
  const { t } = useTranslation('patients')
  return (
    <section>
      <h1 className="mb-6 text-3xl font-semibold text-foreground">{t('title')}</h1>
      <div className="rounded-lg border bg-card p-6 text-muted-foreground">{t('comingSoon')}</div>
    </section>
  )
}

export const Route = createFileRoute('/_auth/patients')({
  beforeLoad: () => requireRole(['ASSISTANT', 'ADMIN']),
  component: PatientsPage,
})
