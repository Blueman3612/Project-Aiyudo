import { useState, useEffect, useCallback } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'

export function AgentTicketsView() {
  const { user, profile } = useAuth()
  const location = useLocation()
  const [activeTab, setActiveTab] = useState('open')
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchTickets = useCallback(async () => {
    try {
      console.log('Fetching tickets with status:', activeTab)
      setLoading(true)
      setError(null)

      // Query tickets with UUID id
      let query = supabase
        .from('tickets')
        .select('*')
        .order('created_at', { ascending: false })

      if (activeTab === 'open') {
        query = query.eq('status', 'open')
      } else if (activeTab === 'in_progress') {
        query = query.eq('status', 'in_progress')
      } else if (activeTab === 'resolved') {
        query = query.eq('status', 'resolved')
      }

      const { data, error: fetchError } = await query

      if (fetchError) {
        console.error('Supabase error:', fetchError)
        throw fetchError
      }

      console.log('Fetched tickets:', data)
      
      // If we get tickets, then try to fetch related data
      if (data && data.length > 0) {
        const customerIds = [...new Set(data.map(t => t.customer_id))]
        const agentIds = [...new Set(data.map(t => t.agent_id).filter(Boolean))]
        
        // Fetch customers and agents in parallel
        const [customersResponse, agentsResponse] = await Promise.all([
          supabase
            .from('profiles')
            .select('id, email, full_name')
            .in('id', customerIds),
          supabase
            .from('profiles')
            .select('id, email, full_name')
            .in('id', agentIds)
        ])
        
        // Map customers and agents to tickets
        const enrichedTickets = data.map(ticket => ({
          ...ticket,
          customer: customersResponse.data?.find(c => c.id === ticket.customer_id),
          agent: agentsResponse.data?.find(a => a.id === ticket.agent_id)
        }))
        
        setTickets(enrichedTickets)
      } else {
        setTickets([])
      }
    } catch (err) {
      console.error('Error details:', err)
      setError('Failed to load tickets. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [activeTab])

  // Set up real-time subscription
  useEffect(() => {
    if (profile?.role !== 'agent') return

    console.log('Setting up real-time subscription')
    
    // Initial fetch
    fetchTickets()

    // Subscribe to changes
    const subscription = supabase
      .channel('tickets-channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tickets',
          filter: `status=eq.${activeTab}`
        },
        (payload) => {
          console.log('Received real-time update:', payload)
          fetchTickets()
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status)
      })

    return () => {
      console.log('Cleaning up subscription')
      subscription.unsubscribe()
    }
  }, [fetchTickets, profile?.role, activeTab])

  const getStatusBadge = (status) => {
    const styles = {
      in_progress: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200',
      resolved: 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200',
      open: 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
    }

    const labels = {
      in_progress: 'In Progress',
      resolved: 'Resolved',
      open: 'Open'
    }

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}>
        {labels[status]}
      </span>
    )
  }

  const getPriorityBadge = (priority) => {
    const styles = {
      high: 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200',
      medium: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200',
      low: 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
    }

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[priority]}`}>
        {priority.charAt(0).toUpperCase() + priority.slice(1)}
      </span>
    )
  }

  return (
    <div className="w-full max-w-none" key={activeTab}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Support Tickets</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Manage and respond to customer support tickets.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('open')}
              className={`py-4 px-6 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'open'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/50'
                  : 'border-transparent text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              Open
            </button>
            <button
              onClick={() => setActiveTab('in_progress')}
              className={`py-4 px-6 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'in_progress'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/50'
                  : 'border-transparent text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              In Progress
            </button>
            <button
              onClick={() => setActiveTab('resolved')}
              className={`py-4 px-6 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'resolved'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/50'
                  : 'border-transparent text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              Resolved
            </button>
          </nav>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Loading tickets...</p>
            </div>
          ) : tickets.length === 0 ? (
            <p className="text-center py-4 text-gray-500 dark:text-gray-400">
              No {activeTab} tickets found.
            </p>
          ) : (
            <div className="space-y-4">
              {tickets.map(ticket => (
                <Link
                  key={ticket.id}
                  to={`/dashboard/tickets/${ticket.id}`}
                  className="block border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                      {ticket.title}
                    </h3>
                    <div className="flex space-x-2">
                      {getPriorityBadge(ticket.priority)}
                      {getStatusBadge(ticket.status)}
                    </div>
                  </div>
                  <p className="text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
                    {ticket.description}
                  </p>
                  <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400">
                    <span>From: {ticket.customer?.full_name || ticket.customer?.email}</span>
                    <span>Created: {new Date(ticket.created_at).toLocaleString()}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 