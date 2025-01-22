import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'
import { Navigate } from 'react-router-dom'

export function AgentAnalytics() {
  const { isAdmin } = useAuth()
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [timeframe, setTimeframe] = useState('7d')

  useEffect(() => {
    if (!isAdmin()) return
    fetchAgentAnalytics()
  }, [timeframe])

  const fetchAgentAnalytics = async () => {
    try {
      setLoading(true)
      setError(null)

      // Get the date range
      const now = new Date()
      const days = timeframe === '7d' ? 7 : timeframe === '30d' ? 30 : 90
      const startDate = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000))

      // First, get all agents
      const { data: agentProfiles, error: agentError } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('role', 'agent')

      if (agentError) throw agentError

      // For each agent, get their ticket metrics
      const agentsWithMetrics = await Promise.all(
        agentProfiles.map(async (agent) => {
          const { data: tickets, error: ticketsError } = await supabase
            .from('tickets')
            .select('*')
            .eq('agent_id', agent.id)
            .gte('created_at', startDate.toISOString())

          if (ticketsError) throw ticketsError

          const totalTickets = tickets.length
          const resolvedTickets = tickets.filter(t => t.status === 'resolved').length
          const ratedTickets = tickets.filter(t => t.satisfaction_rating !== null).length
          const averageRating = ratedTickets > 0
            ? tickets.reduce((acc, t) => acc + (t.satisfaction_rating || 0), 0) / ratedTickets
            : 0
          
          // Calculate average resolution time
          const resolvedWithTime = tickets.filter(t => t.status === 'resolved' && t.resolved_at)
          const avgResolutionTime = resolvedWithTime.length > 0
            ? resolvedWithTime.reduce((acc, t) => {
                const resolvedTime = new Date(t.resolved_at) - new Date(t.created_at)
                return acc + resolvedTime
              }, 0) / resolvedWithTime.length
            : 0

          return {
            ...agent,
            metrics: {
              totalTickets,
              resolvedTickets,
              resolutionRate: totalTickets > 0 ? (resolvedTickets / totalTickets) * 100 : 0,
              averageRating: averageRating.toFixed(1),
              ratingParticipation: totalTickets > 0 ? (ratedTickets / totalTickets) * 100 : 0,
              averageResolutionTime: avgResolutionTime
            }
          }
        })
      )

      // Sort by total tickets handled
      setAgents(agentsWithMetrics.sort((a, b) => b.metrics.totalTickets - a.metrics.totalTickets))
    } catch (err) {
      console.error('Error fetching agent analytics:', err)
      setError('Failed to load agent analytics')
    } finally {
      setLoading(false)
    }
  }

  if (!isAdmin()) {
    return <Navigate to="/dashboard" replace />
  }

  const formatResolutionTime = (ms) => {
    if (ms === 0) return 'N/A'
    const hours = Math.floor(ms / (1000 * 60 * 60))
    return `${hours}h`
  }

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Agent Analytics</h1>
        <select
          value={timeframe}
          onChange={(e) => setTimeframe(e.target.value)}
          className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
        >
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-500 dark:text-gray-400">Loading analytics...</p>
        </div>
      ) : error ? (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-red-600 dark:text-red-400">{error}</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <div 
              key={agent.id} 
              className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6"
            >
              <div className="mb-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">{agent.full_name}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{agent.email}</p>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Total Tickets</p>
                    <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                      {agent.metrics.totalTickets}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Resolution Rate</p>
                    <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                      {Math.round(agent.metrics.resolutionRate)}%
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Avg Rating</p>
                    <p className="text-2xl font-semibold text-gray-900 dark:text-white flex items-center">
                      {agent.metrics.averageRating}
                      <span className="text-amber-400 ml-1">★</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Avg Resolution</p>
                    <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                      {formatResolutionTime(agent.metrics.averageResolutionTime)}
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Resolved</p>
                      <p className="text-lg font-medium text-gray-900 dark:text-white">
                        {agent.metrics.resolvedTickets}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Rating Rate</p>
                      <p className="text-lg font-medium text-gray-900 dark:text-white">
                        {Math.round(agent.metrics.ratingParticipation)}%
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
} 