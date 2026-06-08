import { createFileRoute } from '@tanstack/react-router'
import { DentalCalendar } from '@/components/calendar/DentalCalendar'

export const Route = createFileRoute('/_auth/calendar')({
  component: () => (
    <section className="space-y-4">
      <h1 className="text-3xl font-semibold text-foreground">Calendar</h1>
      <DentalCalendar />
    </section>
  ),
})
