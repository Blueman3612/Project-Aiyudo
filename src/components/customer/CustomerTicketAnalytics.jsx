import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'

export function CustomerTicketAnalytics() {
  const { user } = useAuth()
  const [stats, setStats] = useState({
    total: 0,
    open: 0,
    inProgress: 0,
    resolved: 0
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchStats = async () => {
      if (!user?.id) return

      try {
        setLoading(true)
        setError(null)

        // Fetch all tickets for this customer
        const { data, error: fetchError } = await supabase
          .from('tickets')
          .select('status')
          .eq('customer_id', user.id)

        if (fetchError) throw fetchError

        // Calculate stats
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
    }

    fetchStats()

    // Subscribe to ticket changes
    const channel = supabase.channel('customer-tickets')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tickets',
        filter: `customer_id=eq.${user.id}`
      }, () => {
        fetchStats()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id])

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
      title: 'Open Tickets',
      value: stats.open,
      className: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
    },
    {
      title: 'In Progress',
      value: stats.inProgress,
      className: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800'
    },
    {
      title: 'Resolved',
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