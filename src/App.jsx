import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { DarkModeProvider } from './contexts/DarkModeContext'
import { Auth } from './components/auth/Auth'
import { ProfileManager } from './components/profile/ProfileManager'
import { DashboardLayout } from './components/layout/DashboardLayout'
import { CustomerDashboardLayout } from './components/layout/CustomerDashboardLayout'
import { CustomerDashboard } from './components/customer/CustomerDashboard'
import { CustomerTicketsView } from './components/customer/CustomerTicketsView'
import { NewTicketView } from './components/customer/NewTicketView'
import { AgentTicketsView } from './components/agent/AgentTicketsView'
import { TicketDetails } from './components/tickets/TicketDetails'
import { useState, useEffect } from 'react'

function LoadingScreen() {
  const [loadingTime, setLoadingTime] = useState(0)

  useEffect(() => {
    const startTime = Date.now()
    const interval = setInterval(() => {
      setLoadingTime(Math.floor((Date.now() - startTime) / 1000))
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
        <p className="mt-4 text-gray-600 dark:text-gray-400">Loading... ({loadingTime}s)</p>
      </div>
    </div>
  )
}

function StatCard({ title, value, icon, trend }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 w-full">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</p>
          <p className="text-2xl font-semibold text-gray-900 dark:text-white">{value}</p>
        </div>
        <div className="text-2xl">{icon}</div>
      </div>
      {trend && (
        <div className="mt-2">
          <span className={`text-sm ${trend > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}% from last month
          </span>
        </div>
      )}
    </div>
  )
}

function Dashboard() {
  const { user, profile } = useAuth()

  return (
    <div className="w-full max-w-none">
      <div className="w-full">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Welcome back, {profile?.full_name || user?.email}!
        </h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Here's what's happening with your support desk today.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-6 w-full">
        <StatCard
          title="Open Tickets"
          value="12"
          icon="🎫"
          trend={5}
        />
        <StatCard
          title="Resolved Today"
          value="8"
          icon="✅"
          trend={-2}
        />
        <StatCard
          title="Average Response Time"
          value="2.5h"
          icon="⏱️"
          trend={-15}
        />
        <StatCard
          title="Customer Satisfaction"
          value="94%"
          icon="😊"
          trend={3}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6 w-full">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 w-full">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Recent Activity</h2>
          <div className="space-y-4">
            <p className="text-gray-600 dark:text-gray-400">No recent activity</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 w-full">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Your Profile</h2>
          <ProfileManager />
        </div>
      </div>
    </div>
  )
}

function TicketsView() {
  return (
    <div className="w-full max-w-none">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Support Tickets</h1>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <p className="text-gray-600 dark:text-gray-400">No tickets available yet.</p>
      </div>
    </div>
  )
}

function ProfileView() {
  return (
    <div className="w-full max-w-none">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Your Profile</h1>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <ProfileManager />
      </div>
    </div>
  )
}

function SettingsView() {
  return (
    <div className="w-full max-w-none">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Settings</h1>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <p className="text-gray-600 dark:text-gray-400">Settings options will be available soon.</p>
      </div>
    </div>
  )
}

function AuthenticatedLayout({ children }) {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return <LoadingScreen />
  }

  if (!user) {
    return <Navigate to="/auth" replace />
  }

  // Redirect based on user role
  if (profile?.role === 'customer') {
    return <Navigate to="/customer" replace />
  }

  return <DashboardLayout>{children}</DashboardLayout>
}

function CustomerLayout({ children }) {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return <LoadingScreen />
  }

  // Redirect agents to their dashboard
  if (profile?.role !== 'customer') {
    return <Navigate to="/dashboard" replace />
  }

  return <CustomerDashboardLayout>{children}</CustomerDashboardLayout>
}

function UnauthenticatedLayout({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return <LoadingScreen />
  }

  if (user) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}

function App() {
  return (
    <Router>
      <DarkModeProvider>
        <AuthProvider>
          <Routes>
            {/* Auth Route */}
            <Route
              path="/auth"
              element={
                <UnauthenticatedLayout>
                  <Auth />
                </UnauthenticatedLayout>
              }
            />

            {/* Agent Routes */}
            <Route path="/dashboard" element={<AuthenticatedLayout><Dashboard /></AuthenticatedLayout>} />
            <Route path="/dashboard/tickets" element={<AuthenticatedLayout><AgentTicketsView /></AuthenticatedLayout>} />
            <Route path="/dashboard/tickets/:ticketId" element={<AuthenticatedLayout><TicketDetails /></AuthenticatedLayout>} />
            <Route path="/dashboard/profile" element={<AuthenticatedLayout><ProfileView /></AuthenticatedLayout>} />
            <Route path="/dashboard/settings" element={<AuthenticatedLayout><SettingsView /></AuthenticatedLayout>} />

            {/* Customer Routes */}
            <Route path="/customer" element={<CustomerLayout><CustomerDashboard /></CustomerLayout>} />
            <Route path="/customer/tickets" element={<CustomerLayout><CustomerTicketsView /></CustomerLayout>} />
            <Route path="/customer/tickets/:ticketId" element={<CustomerLayout><TicketDetails /></CustomerLayout>} />
            <Route path="/customer/new-ticket" element={<CustomerLayout><NewTicketView /></CustomerLayout>} />
            <Route path="/customer/profile" element={<CustomerLayout><ProfileView /></CustomerLayout>} />

            {/* Default Route */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </AuthProvider>
      </DarkModeProvider>
    </Router>
  )
}

export default App
