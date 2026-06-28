import { createFileRoute } from '@tanstack/react-router'
import { DentalCalendar } from '@/components/calendar/DentalCalendar'

function CalendarPage() {
  return (
    <section className="-mt-2">
      <DentalCalendar />
    </section>
  )
}

export const Route = createFileRoute('/_auth/calendar')({
  component: CalendarPage,
})
