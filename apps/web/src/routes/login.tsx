import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/login')({
  component: () => (
    <div className="flex h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md p-8 bg-white rounded shadow text-center">
        <h1 className="text-2xl font-bold mb-6">Sunshine Dental Clinic</h1>
        <p className="mb-4">Please log in to manage your appointments.</p>
        <button className="bg-primary text-primary-foreground px-4 py-2 rounded">
          Login Placeholder
        </button>
      </div>
    </div>
  ),
})
