import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { DentalCalendar } from '@/components/calendar/DentalCalendar'

function CalendarPage() {
  const { t } = useTranslation('calendar')
  return (
    <section className="space-y-4">
      <h1 className="text-3xl font-semibold text-foreground">{t('title')}</h1>
      <DentalCalendar />
    </section>
  )
}

export const Route = createFileRoute('/_auth/calendar')({
  component: CalendarPage,
})
