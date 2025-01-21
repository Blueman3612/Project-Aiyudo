import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'

function StatCard({ title, value, trend, icon }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</p>
          <p className="text-2xl font-semibold text-gray-900 dark:text-white">{value}</p>
        </div>
        <div className="text-2xl">{icon}</div>
      </div>
      {trend !== undefined && (
        <div className="mt-2">
          <span className={`text-sm ${trend >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}% from last month
          </span>
        </div>
      )}
    </div>
  )
}

export function TicketAnalytics() {
  const [metrics, setMetrics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [timeframe, setTimeframe] = useState('7d') // 7d, 30d, 90d

  useEffect(() => {
    fetchMetrics()
  }, [timeframe])

  const fetchMetrics = async () => {
    try {
      setLoading(true)
      setError(null)

      // Get the date range
      const now = new Date()
      const days = timeframe === '7d' ? 7 : timeframe === '30d' ? 30 : 90
      const startDate = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000))

      // Fetch tickets within the date range
      const { data: tickets, error: ticketsError } = await supabase
        .from('tickets')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false })

      if (ticketsError) throw ticketsError

      // Calculate metrics
      const totalTickets = tickets.length
      const resolvedTickets = tickets.filter(t => t.status === 'resolved').length
      const ratedTickets = tickets.filter(t => t.satisfaction_rating !== null).length
      const averageRating = ratedTickets > 0
        ? tickets.reduce((acc, t) => acc + (t.satisfaction_rating || 0), 0) / ratedTickets
        : 0

      // Calculate resolution time
      const resolutionTimes = tickets
        .filter(t => t.status === 'resolved')
        .map(t => new Date(t.updated_at) - new Date(t.created_at))
      
      const averageResolutionTime = resolutionTimes.length > 0
        ? resolutionTimes.reduce((acc, time) => acc + time, 0) / resolutionTimes.length
        : 0

      setMetrics({
        totalTickets,
        resolvedTickets,
        resolutionRate: totalTickets > 0 ? (resolvedTickets / totalTickets) * 100 : 0,
        averageRating: averageRating.toFixed(1),
        averageResolutionTime: Math.round(averageResolutionTime / (1000 * 60 * 60)), // Convert to hours
        ratingParticipation: totalTickets > 0 ? (ratedTickets / totalTickets) * 100 : 0
      })
    } catch (err) {
      console.error('Error fetching metrics:', err)
      setError('Failed to load analytics data')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
        <p className="mt-4 text-gray-500 dark:text-gray-400">Loading analytics...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Ticket Analytics
        </h2>
        <select
          value={timeframe}
          onChange={(e) => setTimeframe(e.target.value)}
          className="rounded-md border-gray-300 dark:border-gray-600 shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatCard
          title="Customer Satisfaction"
          value={`${metrics?.averageRating}/10`}
          icon="😊"
        />
        <StatCard
          title="Resolution Rate"
          value={`${Math.round(metrics?.resolutionRate)}%`}
          icon="✅"
        />
        <StatCard
          title="Average Resolution Time"
          value={`${metrics?.averageResolutionTime}h`}
          icon="⏱️"
        />
        <StatCard
          title="Total Tickets"
          value={metrics?.totalTickets}
          icon="🎫"
        />
        <StatCard
          title="Resolved Tickets"
          value={metrics?.resolvedTickets}
          icon="📊"
        />
        <StatCard
          title="Rating Participation"
          value={`${Math.round(metrics?.ratingParticipation)}%`}
          icon="📝"
        />
      </div>
    </div>
  )
} 