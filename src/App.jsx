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
import { TicketAnalytics } from './components/agent/TicketAnalytics'
import { AgentAnalytics } from './components/admin/AgentAnalytics'
import { OrganizationsView } from './components/admin/OrganizationsView'
import { TeamsView } from './components/agent/TeamsView'
import EmailTest from './components/EmailTest'
import { PendingOrganizations } from './components/admin/PendingOrganizations'
import { useState, useEffect } from 'react'
import { supabase } from './lib/supabaseClient'
import { useTranslation } from 'react-i18next'
import { AgentDashboard } from './components/agent/AgentDashboard'
import { Toaster } from 'react-hot-toast'
import { TeamDetailsView } from './components/agent/TeamDetailsView'
import { TestManager } from './components/testing/TestManager'

function LoadingScreen() {
  const [loadingTime, setLoadingTime] = useState(0)
  const { t } = useTranslation()

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
        <p className="mt-4 text-gray-600 dark:text-gray-400">{t('common.loading')} ({loadingTime}s)</p>
      </div>
    </div>
  )
}

function StatCard({ title, value, icon, trend }) {
  const { t } = useTranslation()
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
            {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}% {t('common.analytics.fromLastMonth')}
          </span>
        </div>
      )}
    </div>
  )
}

function Dashboard() {
  const { user, profile } = useAuth()
  const { t } = useTranslation()

  return (
    <div className="w-full max-w-none space-y-6">
      <div className="w-full">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            {t('common.welcomeBack', { name: profile?.full_name || profile?.email })}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t('common.dashboard.subtitle')}
          </p>
        </div>
      </div>

      <TicketAnalytics />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 w-full">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('common.analytics.recentActivity')}</h2>
          <div className="space-y-4">
            <p className="text-gray-600 dark:text-gray-400">{t('common.analytics.noRecentActivity')}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 w-full">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('common.profile.title')}</h2>
          <ProfileManager />
        </div>
      </div>
    </div>
  )
}

function TicketsView() {
  const { t } = useTranslation()
  return (
    <div className="w-full max-w-none">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">{t('common.tickets.title')}</h1>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <p className="text-gray-600 dark:text-gray-400">{t('common.tickets.noTickets')}</p>
      </div>
    </div>
  )
}

function ProfileView() {
  const { t } = useTranslation()
  return (
    <div className="w-full max-w-none">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">{t('common.profile.title')}</h1>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <ProfileManager />
      </div>
    </div>
  )
}

function SettingsView() {
  const { t } = useTranslation()
  return (
    <div className="w-full max-w-none">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">{t('common.nav.settings')}</h1>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <p className="text-gray-600 dark:text-gray-400">{t('common.settings.comingSoon')}</p>
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

  // Redirect only customers, allow both agents and admins to use the agent dashboard
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

function AdminTestingRoute() {
  const { profile } = useAuth()
  return profile?.role === 'admin' ? <TestManager /> : <Navigate to="/dashboard" replace />
}

function App() {
  useEffect(() => {
    // Handle tab visibility changes
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Refresh auth session when tab becomes visible
        supabase.auth.getSession()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  return (
    <>
      <Toaster 
        position="bottom-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#333',
            color: '#fff',
          },
          success: {
            duration: 3000,
            theme: {
              primary: '#4aed88',
            },
          },
        }}
      />
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
              <Route path="/dashboard" element={<AuthenticatedLayout><AgentDashboard /></AuthenticatedLayout>} />
              <Route path="/dashboard/tickets" element={<AuthenticatedLayout><AgentTicketsView /></AuthenticatedLayout>} />
              <Route path="/dashboard/tickets/:ticketId" element={<AuthenticatedLayout><TicketDetails /></AuthenticatedLayout>} />
              <Route path="/dashboard/teams" element={<AuthenticatedLayout><TeamsView /></AuthenticatedLayout>} />
              <Route path="/dashboard/teams/:teamId" element={<AuthenticatedLayout><TeamDetailsView /></AuthenticatedLayout>} />
              <Route path="/dashboard/profile" element={<AuthenticatedLayout><ProfileView /></AuthenticatedLayout>} />
              <Route path="/dashboard/settings" element={<AuthenticatedLayout><SettingsView /></AuthenticatedLayout>} />
              <Route path="/dashboard/agent-analytics" element={<AuthenticatedLayout><AgentAnalytics /></AuthenticatedLayout>} />
              <Route path="/dashboard/organizations" element={<AuthenticatedLayout><OrganizationsView /></AuthenticatedLayout>} />
              <Route path="/dashboard/pending-organizations" element={<AuthenticatedLayout><PendingOrganizations /></AuthenticatedLayout>} />
              <Route path="/dashboard/email-test" element={<AuthenticatedLayout><EmailTest /></AuthenticatedLayout>} />
              <Route path="/dashboard/bot-testing" element={<AuthenticatedLayout><AdminTestingRoute /></AuthenticatedLayout>} />

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
    </>
  )
}

export default App
