import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabaseClient'

export function TicketDetails() {
  const { ticketId } = useParams()
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const [ticket, setTicket] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [updating, setUpdating] = useState(false)
  const [comment, setComment] = useState('')

  const isAgent = profile?.role === 'agent'

  useEffect(() => {
    console.log('TicketDetails mounted with ID:', ticketId)
    console.log('Current user:', user?.id)
    console.log('User role:', profile?.role)
    
    if (!ticketId) {
      setError('Invalid ticket ID')
      setLoading(false)
      return
    }

    fetchTicket()
  }, [ticketId, user?.id, profile?.role])

  const fetchTicket = async () => {
    try {
      setLoading(true)
      setError(null)
      console.log('Attempting to fetch ticket with ID:', ticketId)

      // First get the ticket
      const { data: ticketData, error: ticketError } = await supabase
        .from('tickets')
        .select('*')
        .eq('id', ticketId)
        .single()

      console.log('Ticket query result:', { ticketData, ticketError })

      if (ticketError) {
        console.error('Ticket fetch error:', ticketError)
        throw ticketError
      }

      if (!ticketData) {
        console.log('No ticket found with ID:', ticketId)
        setError('Ticket not found')
        return
      }

      // Check if user has access to this ticket
      if (!isAgent && ticketData.customer_id !== user.id) {
        console.log('Access denied - user is not agent and not ticket owner')
        navigate(isAgent ? '/dashboard/tickets' : '/customer/tickets')
        return
      }

      // Fetch customer and agent details
      console.log('Fetching related profiles...')
      const [customerResponse, agentResponse] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, email, full_name')
          .eq('id', ticketData.customer_id)
          .single(),
        ticketData.agent_id
          ? supabase
              .from('profiles')
              .select('id, email, full_name')
              .eq('id', ticketData.agent_id)
              .single()
          : Promise.resolve({ data: null })
      ])

      console.log('Profile responses:', { customerResponse, agentResponse })

      const enrichedTicket = {
        ...ticketData,
        customer: customerResponse.data,
        agent: agentResponse.data
      }

      console.log('Final enriched ticket:', enrichedTicket)
      setTicket(enrichedTicket)
    } catch (err) {
      console.error('Error details:', err)
      setError('Failed to load ticket details. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const updateTicketStatus = async (newStatus) => {
    if (!isAgent) return

    try {
      setUpdating(true)
      setError(null)

      const updates = {
        status: newStatus,
        agent_id: user.id,
        updated_at: new Date().toISOString()
      }

      const { error: updateError } = await supabase
        .from('tickets')
        .update(updates)
        .eq('id', ticketId)

      if (updateError) throw updateError

      setTicket(prev => ({ ...prev, ...updates, agent: { id: user.id, email: profile.email, full_name: profile.full_name } }))
    } catch (err) {
      console.error('Error updating ticket:', err)
      setError('Failed to update ticket status. Please try again.')
    } finally {
      setUpdating(false)
    }
  }

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

  if (loading) {
    return (
      <div className="w-full max-w-none">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-500 dark:text-gray-400">Loading ticket details...</p>
        </div>
      </div>
    )
  }

  if (!ticket) {
    return (
      <div className="w-full max-w-none">
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">Ticket not found.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-none">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Ticket Details</h1>
          {isAgent && ticket.status !== 'resolved' && (
            <div className="flex space-x-3">
              {ticket.status === 'open' && (
                <button
                  onClick={() => updateTicketStatus('in_progress')}
                  disabled={updating}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-900 disabled:opacity-50"
                >
                  Take Ticket
                </button>
              )}
              <button
                onClick={() => updateTicketStatus('resolved')}
                disabled={updating}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 dark:focus:ring-offset-gray-900 disabled:opacity-50"
              >
                Resolve Ticket
              </button>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {ticket.title}
            </h2>
            <div className="flex space-x-2">
              {getPriorityBadge(ticket.priority)}
              {getStatusBadge(ticket.status)}
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Description</h3>
              <p className="mt-1 text-gray-900 dark:text-white whitespace-pre-wrap">
                {ticket.description}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Customer</h3>
                <p className="mt-1 text-gray-900 dark:text-white">
                  {ticket.customer?.full_name || ticket.customer?.email}
                </p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Type</h3>
                <p className="mt-1 text-gray-900 dark:text-white capitalize">
                  {ticket.type}
                </p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Created</h3>
                <p className="mt-1 text-gray-900 dark:text-white">
                  {new Date(ticket.created_at).toLocaleString()}
                </p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Last Updated</h3>
                <p className="mt-1 text-gray-900 dark:text-white">
                  {new Date(ticket.updated_at).toLocaleString()}
                </p>
              </div>

              {ticket.agent && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Assigned Agent</h3>
                  <p className="mt-1 text-gray-900 dark:text-white">
                    {ticket.agent.full_name || ticket.agent.email}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 