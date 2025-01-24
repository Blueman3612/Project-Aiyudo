import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'
import { useRealtimeSubscription } from '../../hooks/useRealtimeSubscription'
import { useTranslation } from 'react-i18next'

export function CustomerTicketAnalytics() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [stats, setStats] = useState({
    total: 0,
    open: 0,
    inProgress: 0,
    resolved: 0
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchStats = useCallback(async () => {
    if (!user?.id) return

    try {
      setLoading(true)
      setError(null)

      const { data, error: fetchError } = await supabase
        .from('tickets')
        .select('status')
        .eq('customer_id', user.id)

      if (fetchError) throw fetchError

      const stats = data.reduce((acc, ticket) => {
        acc.total++
        switch (ticket.status) {
          case 'open':
            acc.open++
            break
          case 'in_progress':
            acc.inProgress++
            break
          case 'resolved':
            acc.resolved++
            break
        }
        return acc
      }, { total: 0, open: 0, inProgress: 0, resolved: 0 })

      setStats(stats)
    } catch (err) {
      console.error('Error fetching ticket stats:', err)
      setError('Failed to load ticket statistics')
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  const updateStats = useCallback((ticket, isDelete = false) => {
    if (ticket.customer_id !== user?.id) return

    setStats(prevStats => {
      const newStats = { ...prevStats }

      if (isDelete) {
        newStats.total--
        switch (ticket.status) {
          case 'open':
            newStats.open--
            break
          case 'in_progress':
            newStats.inProgress--
            break
          case 'resolved':
            newStats.resolved--
            break
        }
      } else {
        // For updates, we need to handle status changes
        const oldStatus = ticket.old?.status
        if (oldStatus) {
          switch (oldStatus) {
            case 'open':
              newStats.open--
              break
            case 'in_progress':
              newStats.inProgress--
              break
            case 'resolved':
              newStats.resolved--
              break
          }
        } else {
          // New ticket
          newStats.total++
        }

        switch (ticket.status) {
          case 'open':
            newStats.open++
            break
          case 'in_progress':
            newStats.inProgress++
            break
          case 'resolved':
            newStats.resolved++
            break
        }
      }

      return newStats
    })
  }, [user?.id])

  // Set up real-time subscription using our hook
  useRealtimeSubscription({
    table: 'tickets',
    filter: `customer_id=eq.${user?.id}`,
    onInsert: updateStats,
    onUpdate: (newTicket, oldTicket) => updateStats({ ...newTicket, old: oldTicket }),
    onDelete: (ticket) => updateStats(ticket, true)
  }, [updateStats, user?.id])

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      </div>
    )
  }

  const cards = [
    {
      title: t('common.tickets.status.open'),
      value: stats.open,
      className: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
    },
    {
      title: t('common.tickets.status.in_progress'),
      value: stats.inProgress,
      className: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800'
    },
    {
      title: t('common.tickets.status.resolved'),
      value: stats.resolved,
      className: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
    }
  ]

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {cards.map((card) => (
        <div
          key={card.title}
          className={`p-6 rounded-lg border ${card.className}`}
        >
          <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
            {card.title}
          </h3>
          <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">
            {card.value}
          </p>
        </div>
      ))}
    </div>
  )
} 