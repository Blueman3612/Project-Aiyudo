import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabaseClient'
import { TicketComments } from './TicketComments'
import { TicketRating } from './TicketRating'
import { useTranslation } from 'react-i18next'
import { sendTicketResolutionEmail } from '../../lib/sendgrid'
import { toast } from 'react-hot-toast'
import { AgentSearchBar } from '../common/AgentSearchBar'
import { assignTicketToTeam, assignTicketToAgent } from '../../lib/ticketQueries'

export function TicketDetails() {
  const { t } = useTranslation()
  const { ticketId } = useParams()
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const isAgent = profile?.role === 'agent'
  const isCustomer = profile?.role === 'customer'
  const [ticket, setTicket] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [updating, setUpdating] = useState(false)
  const [comment, setComment] = useState('')
  const [agents, setAgents] = useState([])
  const [agentSearch, setAgentSearch] = useState('')
  const [showAgentDropdown, setShowAgentDropdown] = useState(false)
  const [isCurrentTeamCreator, setIsCurrentTeamCreator] = useState(false)

  useEffect(() => {
    if (!ticketId) {
      setError(t('common.tickets.errors.invalidId'))
      setLoading(false)
      return
    }

    fetchTicket()
  }, [ticketId, user?.id, profile?.role, t])

  useEffect(() => {
    const shouldFetchAgents = isAdmin || (isAgent && ticket?.team_id && ticket.teams?.created_by === user.id)
    if (shouldFetchAgents) {
      fetchAgents()
    }
  }, [isAdmin, isAgent, ticket?.team_id, ticket?.teams?.created_by, user?.id])

  // Check if current user is team creator whenever ticket changes
  useEffect(() => {
    if (ticket?.team_id && isAgent) {
      const checkTeamCreator = async () => {
        const isCreator = await isTeamCreator(ticket.team_id)
        setIsCurrentTeamCreator(isCreator)
      }
      checkTeamCreator()
    } else {
      setIsCurrentTeamCreator(false)
    }
  }, [ticket?.team_id, isAgent])

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
        setError(t('common.tickets.notFound'))
        return
      }

      // Get team details in a separate query if there's a team_id
      let teamData = null
      if (ticketData.team_id) {
        const { data: team, error: teamError } = await supabase
          .from('teams')
          .select('id, name, created_by')
          .eq('id', ticketData.team_id)
          .single()
        
        if (teamError) {
          console.error('Team fetch error:', teamError)
        } else {
          teamData = team
        }
      }

      // Check if user has access to this ticket
      if (!isAdmin) {
        // For agents, check if they are assigned or part of the assigned team
        if (isAgent) {
          const isAssigned = ticketData.agent_id === user.id
          const { data: teamMember } = await supabase
            .from('team_members')
            .select('*')
            .eq('team_id', ticketData.team_id)
            .eq('user_id', user.id)
            .single()

          if (!isAssigned && !teamMember) {
            console.log('Access denied - agent is not assigned and not in team')
            navigate('/dashboard/tickets')
            return
          }
        } else if (ticketData.customer_id !== user.id) {
          // For customers, check if they own the ticket
          console.log('Access denied - user is not ticket owner')
          navigate('/customer/tickets')
          return
        }
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
        teams: teamData, // Use the team data from separate query
        customer: customerResponse.data,
        agent: agentResponse.data
      }

      console.log('Final enriched ticket:', enrichedTicket)
      setTicket(enrichedTicket)

      // Check if current user is team creator
      if (ticketData.team_id && isAgent) {
        const isCreator = teamData?.created_by === user.id
        setIsCurrentTeamCreator(isCreator)
      }
    } catch (err) {
      console.error('Error details:', err)
      setError(t('common.tickets.errors.loadFailed'))
    } finally {
      setLoading(false)
    }
  }

  const fetchAgents = async () => {
    try {
      // For team creators, only fetch agents that are members of their team
      if (isAgent && !isAdmin && ticket?.team_id) {
        const { data: teamMembers, error: teamError } = await supabase
          .from('team_members')
          .select('user_id')
          .eq('team_id', ticket.team_id)

        if (teamError) throw teamError

        const memberIds = teamMembers.map(tm => tm.user_id)
        
        const { data: agentProfiles, error: agentError } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', memberIds)
          .eq('role', 'agent')

        if (agentError) throw agentError
        setAgents(agentProfiles)
      } else if (isAdmin) {
        // Admins can see all agents
        const { data: agentProfiles, error: agentError } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .eq('role', 'agent')

        if (agentError) throw agentError
        setAgents(agentProfiles)
      }
    } catch (err) {
      console.error('Error fetching agents:', err)
      toast.error(t('common.tickets.errors.loadAgentsFailed'))
    }
  }

  const updateTicketStatus = async () => {
    try {
      setUpdating(true)
      setError(null)

      // Check if user is assigned to the ticket or is a member of the assigned team
      if (!isAdmin && isAgent) {
        const isAssigned = ticket.agent_id === user.id
        const { data: teamMember } = await supabase
          .from('team_members')
          .select('*')
          .eq('team_id', ticket.team_id)
          .eq('user_id', user.id)
          .single()

        if (!isAssigned && !teamMember) {
          toast.error(t('common.tickets.errors.noPermission'))
          return
        }
      }

      const { error: updateError } = await supabase
        .from('tickets')
        .update({
          agent_id: user.id,
          status: 'resolved',
          updated_at: new Date().toISOString()
        })
        .eq('id', ticketId)

      if (updateError) throw updateError

      const updatedTicket = {
        ...ticket,
        status: 'resolved',
        agent_id: user.id,
        agent: { id: user.id, email: profile.email, full_name: profile.full_name },
        updated_at: new Date().toISOString()
      }

      setTicket(updatedTicket)

      // Send resolution email
      await sendTicketResolutionEmail(
        updatedTicket,
        ticket.customer,
        { id: user.id, email: profile.email, full_name: profile.full_name }
      )
    } catch (err) {
      setError(t('common.tickets.errors.updateFailed'))
    } finally {
      setUpdating(false)
    }
  }

  // Function to check if user is team creator
  const isTeamCreator = async (teamId) => {
    if (!teamId) return false
    
    const { data: team } = await supabase
      .from('teams')
      .select('created_by')
      .eq('id', teamId)
      .single()
      
    return team?.created_by === user.id
  }

  // Function to check if user is team member
  const isTeamMember = async (teamId) => {
    if (!teamId) return false
    
    const { data: member } = await supabase
      .from('team_members')
      .select('*')
      .eq('team_id', teamId)
      .eq('user_id', user.id)
      .single()
      
    return !!member
  }

  const assignToResult = async (result) => {
    try {
      setUpdating(true)
      setError(null)

      // For non-admin agents, check team creator status
      if (!isAdmin && isAgent) {
        if (!ticket?.team_id || ticket.teams?.created_by !== user.id) {
          toast.error(t('common.tickets.errors.noPermission'))
          return
        }
      }

      if (!result) {
        // Unassign case
        if (!isAdmin && (!isAgent || ticket?.teams?.created_by !== user.id)) {
          toast.error(t('common.tickets.errors.noPermission'))
          return
        }
        
        await assignTicketToTeam(ticketId, null)
        toast.success(t('common.tickets.unassigned'))
        setTicket(prev => ({
          ...prev,
          status: 'open',
          team_id: null,
          team: null,
          agent_id: null,
          agent: null,
          updated_at: new Date().toISOString()
        }))
      } else if (result.type === 'team') {
        // Only admins can assign to teams
        if (!isAdmin) {
          toast.error(t('common.tickets.errors.noPermission'))
          return
        }
        
        await assignTicketToTeam(ticketId, result.id)
        toast.success(t('common.tickets.assignedToTeam', { team: result.name }))
        setTicket(prev => ({
          ...prev,
          status: 'in_progress',
          team_id: result.id,
          team: result,
          agent_id: null,
          agent: null,
          updated_at: new Date().toISOString()
        }))
      } else {
        // For agent assignment, check permissions
        if (!isAdmin && (!isAgent || !ticket?.team_id || ticket.teams?.created_by !== user.id)) {
          toast.error(t('common.tickets.errors.noPermission'))
          return
        }
        
        await assignTicketToAgent(ticketId, result.id)
        toast.success(t('common.tickets.assignedToAgent', { agent: result.full_name }))
        setTicket(prev => ({
          ...prev,
          status: 'in_progress',
          agent_id: result.id,
          agent: result,
          team_id: null,
          team: null,
          updated_at: new Date().toISOString()
        }))
      }
    } catch (err) {
      setError(t('common.tickets.errors.assignFailed'))
      toast.error(t('common.tickets.errors.assignFailed'))
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

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}>
        {t(`common.tickets.status.${status}`)}
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
        {t(`common.tickets.priority_options.${priority}`)}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="w-full max-w-none">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-500 dark:text-gray-400">{t('common.tickets.loading')}</p>
        </div>
      </div>
    )
  }

  if (!ticket) {
    return (
      <div className="w-full max-w-none">
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">{t('common.tickets.notFound')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-w-0 w-full overflow-hidden">
      <div className="min-w-0 w-full">
        {isCustomer && ticket.status === 'resolved' && (
          <div className="mb-6">
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

        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white truncate">
            {t('common.tickets.details')}
          </h1>
          <div className="flex items-center gap-2">
            {/* Admin Buttons */}
            {isAdmin && (
              <>
                {/* Search bar first */}
                <AgentSearchBar
                  value={agentSearch}
                  onChange={setAgentSearch}
                  onSelect={(result) => {
                    assignToResult(result)
                    setAgentSearch('')
                    setShowAgentDropdown(false)
                  }}
                  agents={agents}
                  selectedAgents={[]}
                  disabled={updating}
                  showDropdown={showAgentDropdown}
                  setShowDropdown={setShowAgentDropdown}
                  isTicketAssignment={true}
                  width="w-full"
                  containerClassName="max-w-md"
                />
                
                {/* Unassign button second */}
                {(ticket.agent_id || ticket.team_id) && (
                  <button
                    onClick={() => assignToResult(null)}
                    disabled={updating}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-all shadow-sm border border-gray-300 dark:border-gray-600"
                  >
                    {updating ? (
                      <>
                        <svg className="animate-spin -ml-1 h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span>{t('common.tickets.unassigning')}</span>
                      </>
                    ) : (
                      <>
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        <span>{t('common.tickets.unassign')}</span>
                      </>
                    )}
                  </button>
                )}

                {/* Resolve button last */}
                {ticket.status !== 'resolved' && (
                  <button
                    onClick={updateTicketStatus}
                    disabled={updating}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-all shadow-sm"
                  >
                    {updating ? (
                      <>
                        <svg className="animate-spin -ml-1 h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span>{t('common.tickets.resolving')}</span>
                      </>
                    ) : (
                      <>
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>{t('common.tickets.resolve')}</span>
                      </>
                    )}
                  </button>
                )}
              </>
            )}

            {/* Agent Buttons */}
            {isAgent && !isAdmin && (
              <>
                {/* Team Creator Assignment Actions First */}
                {ticket?.team_id && 
                  ticket.teams?.created_by === user.id && 
                  ticket.status !== 'resolved' && (
                  <>
                    <AgentSearchBar
                      value={agentSearch}
                      onChange={setAgentSearch}
                      onSelect={(result) => {
                        assignToResult(result)
                        setAgentSearch('')
                        setShowAgentDropdown(false)
                      }}
                      agents={agents}
                      selectedAgents={[]}
                      disabled={updating}
                      showDropdown={showAgentDropdown}
                      setShowDropdown={setShowAgentDropdown}
                      isTicketAssignment={true}
                      width="w-full"
                      containerClassName="max-w-md"
                    />
                    {ticket.agent_id && (
                      <button
                        onClick={() => assignToResult(null)}
                        disabled={updating}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-all shadow-sm border border-gray-300 dark:border-gray-600"
                      >
                        {updating ? (
                          <>
                            <svg className="animate-spin -ml-1 h-4 w-4" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            <span>{t('common.tickets.unassigning')}</span>
                          </>
                        ) : (
                          <>
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            <span>{t('common.tickets.unassign')}</span>
                          </>
                        )}
                      </button>
                    )}
                  </>
                )}

                {/* Resolve Button Last */}
                {((ticket.agent_id === user.id || ticket.team_id) && ticket.status !== 'resolved') && (
                  <button
                    onClick={updateTicketStatus}
                    disabled={updating}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-all shadow-sm"
                  >
                    {updating ? (
                      <>
                        <svg className="animate-spin -ml-1 h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span>{t('common.tickets.resolving')}</span>
                      </>
                    ) : (
                      <>
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>{t('common.tickets.resolve')}</span>
                      </>
                    )}
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-2">
          <div className="flex-1 min-w-[400px] bg-gray-50 dark:bg-gray-800 rounded-lg shadow-sm">
            <TicketComments ticketId={ticketId} isAdmin={isAdmin} />
          </div>

          <div className="w-full lg:w-[400px] shrink-0">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg shadow-sm">
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
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('common.tickets.description')}</h3>
                    <p className="mt-1 text-gray-900 dark:text-white whitespace-pre-wrap break-words">
                      {ticket.description}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-4 min-w-0">
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('common.customer')}</h3>
                      <p className="mt-1 text-gray-900 dark:text-white">
                        {ticket.customer?.full_name || ticket.customer?.email}
                      </p>
                    </div>

                    <div>
                      <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('common.tickets.type')}</h3>
                      <p className="mt-1 text-gray-900 dark:text-white capitalize">
                        {t(`common.tickets.types.${ticket.type}`)}
                      </p>
                    </div>

                    <div>
                      <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('common.tickets.created')}</h3>
                      <p className="mt-1 text-gray-900 dark:text-white">
                        {new Date(ticket.created_at).toLocaleString()}
                      </p>
                    </div>

                    <div>
                      <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('common.tickets.lastUpdated')}</h3>
                      <p className="mt-1 text-gray-900 dark:text-white">
                        {new Date(ticket.updated_at).toLocaleString()}
                      </p>
                    </div>

                    {ticket.agent && (
                      <div>
                        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('common.tickets.assignedAgent')}</h3>
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
        </div>
      </div>
    </div>
  )
} 