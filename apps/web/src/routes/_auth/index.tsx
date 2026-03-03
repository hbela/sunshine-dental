import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_auth/')({
  component: () => (
    <div>
      <h1 className="text-3xl font-semibold mb-6 text-gray-800">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Mock Stats Cards */}
        {['Appointments Today', 'Pending Callbacks', 'Calls This Week', 'Sentiment Score'].map(stat => (
          <div key={stat} className="bg-white p-6 rounded shadow border">
             <h3 className="text-sm font-medium text-gray-500">{stat}</h3>
             <p className="text-2xl font-bold mt-2 text-gray-900">-</p>
          </div>
        ))}
      </div>
    </div>
  ),
})
