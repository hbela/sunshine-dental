import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

function AppointmentsPage() {
  const { t } = useTranslation('appointments')
  return (
    <section>
      <h1 className="text-3xl font-semibold mb-6 text-gray-800">{t('title')}</h1>
      <div className="bg-white p-6 rounded shadow border text-gray-600">{t('comingSoon')}</div>
    </section>
  )
}

export const Route = createFileRoute('/_auth/appointments')({
  component: AppointmentsPage,
})
