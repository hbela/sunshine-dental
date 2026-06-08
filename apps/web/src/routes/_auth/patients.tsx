import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_auth/patients')({
  component: () => (
    <section>
      <h1 className="text-3xl font-semibold mb-6 text-gray-800">Patients</h1>
      <div className="bg-white p-6 rounded shadow border text-gray-600">
        Patient records coming soon.
      </div>
    </section>
  ),
})
