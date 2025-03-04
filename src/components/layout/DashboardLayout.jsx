import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useDarkMode } from '../../contexts/DarkModeContext'
import { Link, useLocation } from 'react-router-dom'
import { TicketCount } from './TicketCount'
import EmailTest from '../EmailTest'
import { PendingOrgCount } from '../admin/PendingOrgCount'
import { useTranslation } from 'react-i18next'
import { LanguageSwitcher } from '../common/LanguageSwitcher'

function NavItem({ to, children, icon }) {
  const location = useLocation()
  const isActive = location.pathname === to

  return (
    <Link
      to={to}
      className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
        isActive
          ? 'bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
      }`}
    >
      <span className="text-xl">{icon}</span>
      <span>{children}</span>
    </Link>
  )
}

export function DashboardLayout({ children }) {
  const { signOut, profile } = useAuth()
  const { isDarkMode, toggleDarkMode } = useDarkMode()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const { t } = useTranslation()

  const isAdmin = profile?.role === 'admin'

  const handleSignOut = async () => {
    try {
      await signOut()
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
      {/* Top Navigation */}
      <header className="fixed top-0 left-0 right-0 bg-white dark:bg-gray-900 shadow-sm dark:shadow-gray-800 z-20">
        <div className="flex justify-between h-16 px-4 w-full">
          <div className="flex items-center">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="lg:hidden p-2 rounded-md text-gray-400 dark:text-gray-500 hover:text-gray-500 dark:hover:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none"
            >
              <svg
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
            <div className="ml-4 font-light text-3xl text-gray-800 dark:text-white tracking-wide">
              <span className="text-red-600 dark:text-red-500">AI</span>YUDO
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <LanguageSwitcher />
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-lg text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-colors"
              aria-label="Toggle dark mode"
            >
              {isDarkMode ? '🌞' : '🌙'}
            </button>
          </div>
        </div>
      </header>

      <div className="flex min-h-screen pt-16">
        {/* Backdrop for mobile */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 bg-gray-600 dark:bg-gray-900 bg-opacity-50 dark:bg-opacity-80 z-20 lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={`fixed lg:sticky top-16 h-[calc(100vh-4rem)] w-64 bg-white dark:bg-gray-900 shadow-sm dark:shadow-gray-800 transition-transform duration-300 z-30 ${
            isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          }`}
        >
          <div className="h-full overflow-y-auto py-4 px-3">
            <nav className="space-y-1">
              <NavItem to="/dashboard" icon="📊">
                {t('common.nav.dashboard')}
              </NavItem>
              <NavItem to="/dashboard/tickets" icon="🎫">
                {t('common.nav.tickets')}
              </NavItem>
              <NavItem to="/dashboard/teams" icon="👥">
                {t('common.nav.teams')}
              </NavItem>
              <NavItem to="/dashboard/profile" icon="👤">
                {t('common.nav.profile')}
              </NavItem>

              {profile?.role === 'admin' && (
                <>
                  <NavItem to="/dashboard/agent-analytics" icon="📈">
                    {t('common.nav.agentAnalytics')}
                  </NavItem>
                  <NavItem to="/dashboard/organizations" icon="🏢">
                    {t('common.nav.organizations')}
                  </NavItem>
                  <NavItem to="/dashboard/pending-organizations" icon="📝">
                    <div className="flex items-center">
                      {t('common.nav.pendingOrganizations')}
                      <PendingOrgCount />
                    </div>
                  </NavItem>
                  <NavItem to="/dashboard/bot-testing" icon="🤖">
                    {t('common.nav.botTesting')}
                  </NavItem>
                </>
              )}

              <button
                onClick={handleSignOut}
                className="flex items-center w-full space-x-3 px-4 py-3 rounded-lg transition-colors text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                style={{ background: 'none' }}
              >
                <span className="text-xl">🚪</span>
                <span className="flex-1 text-left">{t('common.logout')}</span>
              </button>
            </nav>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0">
          <div className="p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
} 