import { useAuth } from '../../contexts/AuthContext'

function StatCard({ title, value, icon }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 w-full">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</p>
          <p className="text-2xl font-semibold text-gray-900 dark:text-white">{value}</p>
        </div>
        <div className="text-2xl">{icon}</div>
      </div>
    </div>
  )
}

export function CustomerDashboard() {
  const { user, profile } = useAuth()

  return (
    <div className="w-full max-w-none">
      <div className="w-full">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Welcome, {profile?.full_name || user?.email}!
        </h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Need help? Create a new support ticket or check the status of your existing tickets.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6 w-full">
        <StatCard
          title="Active Tickets"
          value="2"
          icon="🎫"
        />
        <StatCard
          title="Resolved Tickets"
          value="5"
          icon="✅"
        />
        <StatCard
          title="Average Response Time"
          value="4h"
          icon="⏱️"
        />
      </div>

      <div className="mt-6 w-full">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Recent Tickets</h2>
          <div className="space-y-4">
            <div className="border-l-4 border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Login Issues</h3>
                  <p className="mt-1 text-sm text-yellow-700 dark:text-yellow-300">Cannot access my account after password reset</p>
                </div>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200">
                  In Progress
                </span>
              </div>
              <p className="mt-2 text-sm text-yellow-600 dark:text-yellow-400">Opened 2 hours ago</p>
            </div>

            <div className="border-l-4 border-green-400 bg-green-50 dark:bg-green-900/20 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-green-800 dark:text-green-200">Feature Request</h3>
                  <p className="mt-1 text-sm text-green-700 dark:text-green-300">Dark mode support for mobile app</p>
                </div>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
                  Resolved
                </span>
              </div>
              <p className="mt-2 text-sm text-green-600 dark:text-green-400">Resolved 1 day ago</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 