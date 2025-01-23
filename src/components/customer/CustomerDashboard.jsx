import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { CustomerTicketAnalytics } from './CustomerTicketAnalytics'
import { supabase } from '../../lib/supabaseClient'
import { formatDistanceToNow } from 'date-fns'
import { useRealtimeSubscription } from '../../hooks/useRealtimeSubscription'

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
          agent:profiles!agent_id (
            full_name
          ),
          satisfaction_rating,
          rated_at
        `)
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5)

      if (fetchError) throw fetchError

      setRecentTickets(data)
    } catch (err) {
      console.error('Error fetching recent tickets:', err)
      setError('Failed to load recent tickets')
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    fetchRecentTickets()
  }, [fetchRecentTickets])

  const handleTicketChange = useCallback(async (newTicket) => {
    // Only process if it's for the current user
    if (newTicket.customer_id !== user?.id) return

    // Fetch the complete ticket data including agent info
    const { data: updatedTicket, error } = await supabase
      .from('tickets')
      .select(`
        *,
        agent:profiles!agent_id (
          full_name
        ),
        satisfaction_rating,
        rated_at
      `)
      .eq('id', newTicket.id)
      .single()

    if (error) {
      console.error('Error fetching updated ticket:', error)
      return
    }

    setRecentTickets(prevTickets => {
      const ticketIndex = prevTickets.findIndex(t => t.id === updatedTicket.id)
      if (ticketIndex === -1) {
        // New ticket - add it to the beginning and maintain limit of 5
        return [updatedTicket, ...prevTickets].slice(0, 5)
      } else {
        // Update existing ticket
        const updatedTickets = [...prevTickets]
        updatedTickets[ticketIndex] = updatedTicket
        return updatedTickets
      }
    })
  }, [user?.id])

  const handleTicketDelete = useCallback((oldTicket) => {
    if (oldTicket.customer_id !== user?.id) return
    setRecentTickets(prevTickets => prevTickets.filter(t => t.id !== oldTicket.id))
  }, [user?.id])

  // Set up real-time subscription using our hook
  useRealtimeSubscription({
    table: 'tickets',
    filter: `customer_id=eq.${user?.id}`,
    onInsert: handleTicketChange,
    onUpdate: handleTicketChange,
    onDelete: handleTicketDelete
  }, [handleTicketChange, handleTicketDelete, user?.id])

  const getStatusStyles = (status) => {
    switch (status) {
      case 'open':
        return 'border-blue-400 bg-blue-50 dark:bg-blue-900/20'
      case 'in_progress':
        return 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20'
      case 'resolved':
        return 'border-green-400 bg-green-50 dark:bg-green-900/20'
      default:
        return 'border-gray-400 bg-gray-50 dark:bg-gray-900/20'
    }
  }

  const getStatusBadgeStyles = (status) => {
    switch (status) {
      case 'open':
        return 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
      case 'in_progress':
        return 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
      case 'resolved':
        return 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
      default:
        return 'bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200'
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Welcome back, {profile?.full_name || 'Customer'}!
        </h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Here's what's happening with your support tickets.
        </p>
      </div>

      <CustomerTicketAnalytics />

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Recent Tickets</h2>
        
        {loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="text-sm text-red-600 dark:text-red-400">{error}</div>
        ) : recentTickets.length === 0 ? (
          <p className="text-sm text-gray-600 dark:text-gray-400">No tickets found.</p>
        ) : (
          <div className="space-y-4">
            {recentTickets.map((ticket) => (
              <Link
                key={ticket.id}
                to={`/customer/tickets/${ticket.id}`}
                className={`block border-l-4 p-4 ${getStatusStyles(ticket.status)} hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors`}
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
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeStyles(ticket.status)}`}>
                    {ticket.status.replace('_', ' ').charAt(0).toUpperCase() + ticket.status.slice(1)}
                  </span>
                </div>
                <div className="mt-2 text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                  <span>Opened {formatDistanceToNow(new Date(ticket.created_at))} ago</span>
                  {ticket.agent && (
                    <>
                      <span>•</span>
                      <span>Assigned to {ticket.agent.full_name}</span>
                    </>
                  )}
                  {ticket.status === 'resolved' && (
                    <>
                      <span>•</span>
                      {ticket.satisfaction_rating ? (
                        <span className="flex items-center">
                          Rating: <span className="text-amber-400 dark:text-amber-300 ml-1">{ticket.satisfaction_rating}/10 ★</span>
                        </span>
                      ) : (
                        <span className="text-blue-600 dark:text-blue-400">Click to rate this ticket</span>
                      )}
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