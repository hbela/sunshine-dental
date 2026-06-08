import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_auth/calendar')({
  component: () => (
    <section>
      <h1 className="text-3xl font-semibold mb-6 text-gray-800">Calendar</h1>
      <div className="bg-white p-6 rounded shadow border text-gray-600">
        Calendar view coming soon.
      </div>
    </section>
  ),
})
