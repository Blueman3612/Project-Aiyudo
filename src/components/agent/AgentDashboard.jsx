import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'
import { useTranslation } from 'react-i18next'
import { TicketAnalytics } from './TicketAnalytics'
import { formatDistanceToNow } from 'date-fns'

export function AgentDashboard() {
  const { t } = useTranslation()
  const { user, profile } = useAuth()
  const [recentTickets, setRecentTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchRecentTickets = useCallback(async () => {
    if (!user?.id) return

    try {
      setLoading(true)
      setError(null)

      const { data, error: fetchError } = await supabase
        .from('tickets')
        .select(`
          *,
          customer:profiles!customer_id (
            full_name,
            email
          )
        `)
        .eq('agent_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(5)

      if (fetchError) throw fetchError

      setRecentTickets(data)
    } catch (err) {
      console.error('Error fetching recent tickets:', err)
      setError(t('common.tickets.errors.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [user?.id, t])

  useEffect(() => {
    fetchRecentTickets()
  }, [fetchRecentTickets])

  const getStatusBadge = (status) => {
    const styles = {
      in_progress: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200',
      resolved: 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200',
      open: 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
    }

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}>
        {t(`common.tickets.status.${status}`)}
      </span>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {t('common.welcomeBack', { name: profile?.full_name || t('common.agent') })}
        </h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {t('common.dashboard.subtitle')}
        </p>
      </div>

      <TicketAnalytics />

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          {t('common.dashboard.recentActivity')}
        </h2>
        
        {loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="text-sm text-red-600 dark:text-red-400">{error}</div>
        ) : recentTickets.length === 0 ? (
          <p className="text-sm text-gray-600 dark:text-gray-400">{t('common.dashboard.noTickets')}</p>
        ) : (
          <div className="space-y-4">
            {recentTickets.map(ticket => (
              <Link
                key={ticket.id}
                to={`/dashboard/tickets/${ticket.id}`}
                className="block border-l-4 p-4 border-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                      {ticket.title}
                    </h3>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                      {ticket.description}
                    </p>
                  </div>
                  {getStatusBadge(ticket.status)}
                </div>
                <div className="mt-2 text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                  <span>
                    {t('common.tickets.updatedAgo', {
                      time: formatDistanceToNow(new Date(ticket.updated_at))
                    })}
                  </span>
                  <span>•</span>
                  <span>
                    {ticket.customer?.full_name || ticket.customer?.email}
                  </span>
                  {ticket.status === 'resolved' && ticket.satisfaction_rating && (
                    <>
                      <span>•</span>
                      <span className="flex items-center">
                        {t('common.tickets.rating', { rating: ticket.satisfaction_rating })}
                        <span className="text-amber-400 dark:text-amber-300 ml-1">★</span>
                      </span>
                    </>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
} 