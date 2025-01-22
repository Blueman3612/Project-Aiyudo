import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabaseClient'
import { TicketComments } from './TicketComments'
import { TicketRating } from './TicketRating'

export function TicketDetails() {
  const { ticketId } = useParams()
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const [ticket, setTicket] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [updating, setUpdating] = useState(false)
  const [comment, setComment] = useState('')
  const [agents, setAgents] = useState([])
  const [selectedAgent, setSelectedAgent] = useState('')

  const isAgent = profile?.role === 'agent'
  const isAdmin = profile?.role === 'admin'
  const isAgentOrAdmin = isAgent || isAdmin
  const isCustomer = profile?.role === 'customer'

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

  useEffect(() => {
    if (isAdmin) {
      fetchAgents()
    }
  }, [isAdmin])

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
      if (!isAgentOrAdmin && ticketData.customer_id !== user.id) {
        console.log('Access denied - user is not agent/admin and not ticket owner')
        navigate(isAgentOrAdmin ? '/dashboard/tickets' : '/customer/tickets')
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

  const fetchAgents = async () => {
    try {
      const { data: agentProfiles, error: agentError } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('role', 'agent')

      if (agentError) throw agentError
      setAgents(agentProfiles)
    } catch (err) {
      console.error('Error fetching agents:', err)
    }
  }

  const updateTicketStatus = async () => {
    if (!isAgent) return

    try {
      setUpdating(true)
      setError(null)

      const { error: updateError } = await supabase
        .from('tickets')
        .update({
          agent_id: user.id,
          status: 'resolved'
        })
        .eq('id', ticketId)

      if (updateError) throw updateError

      setTicket(prev => ({
        ...prev,
        status: 'resolved',
        agent_id: user.id,
        agent: { id: user.id, email: profile.email, full_name: profile.full_name }
      }))
    } catch (err) {
      console.error('Error updating ticket:', err)
      setError('Failed to update ticket status. Please try again.')
    } finally {
      setUpdating(false)
    }
  }

  const assignTicket = async () => {
    if (!isAgentOrAdmin) return

    try {
      setUpdating(true)
      setError(null)

      const { error: updateError } = await supabase
        .from('tickets')
        .update({
          agent_id: user.id,
          status: 'in_progress'
        })
        .eq('id', ticketId)

      if (updateError) throw updateError

      setTicket(prev => ({
        ...prev,
        status: 'in_progress',
        agent_id: user.id,
        agent: { id: user.id, email: profile.email, full_name: profile.full_name }
      }))
    } catch (err) {
      console.error('Error assigning ticket:', err)
      setError('Failed to assign ticket. Please try again.')
    } finally {
      setUpdating(false)
    }
  }

  const unassignTicket = async () => {
    if (!isAdmin) return

    try {
      setUpdating(true)
      setError(null)

      const { error: updateError } = await supabase
        .from('tickets')
        .update({
          agent_id: null,
          status: 'open'
        })
        .eq('id', ticketId)

      if (updateError) throw updateError

      setTicket(prev => ({
        ...prev,
        status: 'open',
        agent_id: null,
        agent: null
      }))
    } catch (err) {
      console.error('Error unassigning ticket:', err)
      setError('Failed to unassign ticket. Please try again.')
    } finally {
      setUpdating(false)
    }
  }

  const assignToAgent = async (agentId) => {
    if (!isAdmin) return

    try {
      setUpdating(true)
      setError(null)

      const { error: updateError } = await supabase
        .from('tickets')
        .update({
          agent_id: agentId,
          status: agentId ? 'in_progress' : 'open'
        })
        .eq('id', ticketId)

      if (updateError) throw updateError

      // Find the assigned agent from our list
      const assignedAgent = agents.find(a => a.id === agentId)

      setTicket(prev => ({
        ...prev,
        status: agentId ? 'in_progress' : 'open',
        agent_id: agentId,
        agent: agentId ? assignedAgent : null
      }))

      setSelectedAgent('')
    } catch (err) {
      console.error('Error assigning ticket:', err)
      setError('Failed to assign ticket. Please try again.')
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
    <div className="min-w-0 w-full overflow-hidden">
      <div className="min-w-0 w-full">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white truncate">
            Ticket Details
          </h1>
          <div className="flex gap-2">
            {isAdmin ? (
              <div className="flex items-center gap-2">
                {!ticket?.agent_id && (
                  <button
                    onClick={assignTicket}
                    disabled={updating}
                    className="shrink-0 px-4 py-2 rounded-lg text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-colors"
                  >
                    {updating ? 'Assigning...' : 'Assign to Me'}
                  </button>
                )}
                <select
                  value={selectedAgent}
                  onChange={(e) => setSelectedAgent(e.target.value)}
                  className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 px-3 py-2 text-sm"
                >
                  <option value="">Select Agent</option>
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.full_name || agent.email}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => assignToAgent(selectedAgent)}
                  disabled={updating || !selectedAgent}
                  className="shrink-0 px-4 py-2 rounded-lg text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-colors"
                >
                  {updating ? 'Assigning...' : 'Assign'}
                </button>
                {ticket?.agent_id && (
                  <button
                    onClick={() => assignToAgent(null)}
                    disabled={updating}
                    className="shrink-0 px-4 py-2 rounded-lg text-white bg-gray-600 hover:bg-gray-700 dark:bg-gray-500 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-gray-500 dark:focus:ring-gray-400 focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-colors"
                  >
                    {updating ? 'Unassigning...' : 'Unassign'}
                  </button>
                )}
              </div>
            ) : isAgent && (
              <div className="flex gap-2">
                {/* Existing agent buttons */}
                {!ticket?.agent_id ? (
                  <button
                    onClick={assignTicket}
                    disabled={updating}
                    className="shrink-0 px-4 py-2 rounded-lg text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-colors"
                  >
                    {updating ? 'Assigning...' : 'Assign to Me'}
                  </button>
                ) : ticket.agent_id === user.id && ticket.status !== 'resolved' && (
                  <button
                    onClick={updateTicketStatus}
                    disabled={updating}
                    className="shrink-0 px-4 py-2 rounded-lg text-white bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-green-500 dark:focus:ring-green-400 focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-colors"
                  >
                    {updating ? 'Resolving...' : 'Resolve Ticket'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg shadow-sm min-w-0">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4 gap-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white truncate">
                {ticket.title}
              </h2>
              <div className="flex gap-2 shrink-0">
                {getPriorityBadge(ticket.priority)}
                {getStatusBadge(ticket.status)}
              </div>
            </div>

            <div className="space-y-4 min-w-0">
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Description</h3>
                <p className="mt-1 text-gray-900 dark:text-white whitespace-pre-wrap break-words">
                  {ticket.description}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 min-w-0">
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

        {isCustomer && ticket.status === 'resolved' && (
          <div className="mt-6">
            <TicketRating
              ticketId={ticket.id}
              initialRating={ticket.satisfaction_rating}
              onRatingSubmit={(rating) => {
                setTicket(prev => ({
                  ...prev,
                  satisfaction_rating: rating,
                  rated_at: new Date().toISOString()
                }))
              }}
            />
          </div>
        )}

        <div className="mt-8">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Comments</h2>
          <TicketComments ticketId={ticketId} isAdmin={isAdmin} />
        </div>
      </div>
    </div>
  )
} 