import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'
import { useRealtimeSubscription } from '../../hooks/useRealtimeSubscription'
import { useTranslation } from 'react-i18next'
import { sendTicketResolutionEmail } from '../../lib/sendgrid'

export function AgentTicketsView() {
  const { t } = useTranslation()
  const { user, profile, isAdmin } = useAuth()
  const location = useLocation()
  const [activeTab, setActiveTab] = useState('active')
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedTickets, setSelectedTickets] = useState(new Set())
  const [updating, setUpdating] = useState(false)
  const [agents, setAgents] = useState([])
  const [agentSearch, setAgentSearch] = useState('')
  const [showAgentDropdown, setShowAgentDropdown] = useState(false)

  const filteredAgents = useMemo(() => {
    if (!agentSearch) return agents
    const searchLower = agentSearch.toLowerCase()
    return agents.filter(agent => 
      (agent.full_name?.toLowerCase().includes(searchLower) || 
       agent.email.toLowerCase().includes(searchLower))
    )
  }, [agents, agentSearch])

  const fetchTickets = useCallback(async () => {
    if (!user?.id || !profile?.role) return
    
    try {
      console.log('Fetching tickets with status:', activeTab)
      setLoading(true)
      setError(null)

      let query = supabase
        .from('tickets')
        .select('*, customer:profiles!customer_id(*), agent:profiles!agent_id(*)')
        .order('created_at', { ascending: false })

      if (activeTab === 'active') {
        query = query.in('status', ['open', 'in_progress'])
      } else if (activeTab === 'resolved') {
        query = query.eq('status', 'resolved')
      }

      if (!isAdmin()) {
        query = query.eq('agent_id', user.id)
      }

      const { data, error: fetchError } = await query

      if (fetchError) {
        console.error('Supabase error:', fetchError)
        throw fetchError
      }

      setTickets(data || [])
    } catch (err) {
      console.error('Error details:', err)
      setError(t('common.tickets.errors.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [activeTab, user?.id, profile?.role, isAdmin, t])

  // Handle tab changes and initial load
  useEffect(() => {
    // Allow both agents and admins to view tickets
    if (!user?.id || (profile?.role !== 'agent' && profile?.role !== 'admin')) return
    fetchTickets()
  }, [fetchTickets, user?.id, profile?.role, activeTab])

  // Handle ticket updates
  const handleTicketUpdate = useCallback((payload) => {
    if (document.visibilityState === 'visible' && 
        (!payload.new?.status || payload.new.status === activeTab)) {
      fetchTickets()
    }
  }, [activeTab, fetchTickets])

  // Set up real-time subscription using our hook
  useRealtimeSubscription({
    table: 'tickets',
    filter: !isAdmin() ? `agent_id=eq.${user?.id}` : undefined,
    onInsert: handleTicketUpdate,
    onUpdate: handleTicketUpdate,
    onDelete: handleTicketUpdate,
    enabled: !!user?.id && (profile?.role === 'agent' || profile?.role === 'admin')
  }, [handleTicketUpdate, user?.id, profile?.role, isAdmin])

  // Add this after the other useEffect hooks
  useEffect(() => {
    if (!isAdmin()) return

    const fetchAgents = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('role', ['agent', 'admin'])
        .order('full_name')

      if (!error) {
        setAgents(data)
      }
    }

    fetchAgents()
  }, [isAdmin])

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

  const handleSelectAll = () => {
    if (selectedTickets.size === tickets.length) {
      setSelectedTickets(new Set())
    } else {
      setSelectedTickets(new Set(tickets.map(ticket => ticket.id)))
    }
  }

  const handleSelectTicket = (ticketId) => {
    setSelectedTickets(prev => {
      const newSet = new Set(prev)
      if (newSet.has(ticketId)) {
        newSet.delete(ticketId)
      } else {
        newSet.add(ticketId)
      }
      return newSet
    })
  }

  const resolveSelectedTickets = async () => {
    if (selectedTickets.size === 0) return

    try {
      setUpdating(true)
      setError(null)

      // Update all selected tickets to resolved status
      const { error: updateError } = await supabase
        .from('tickets')
        .update({
          status: 'resolved'
        })
        .in('id', Array.from(selectedTickets))

      if (updateError) throw updateError

      // Send resolution emails for each ticket
      const selectedTicketDetails = tickets.filter(ticket => selectedTickets.has(ticket.id))
      await Promise.all(selectedTicketDetails.map(ticket => 
        sendTicketResolutionEmail(
          ticket,
          ticket.customer,
          { id: user.id, email: profile.email, full_name: profile.full_name }
        )
      ))

      // Clear selection and refresh tickets
      setSelectedTickets(new Set())
      await fetchTickets()
    } catch (err) {
      console.error('Error resolving tickets:', err)
      setError(t('common.tickets.errors.updateFailed'))
    } finally {
      setUpdating(false)
    }
  }

  const assignSelectedTickets = async (agentId) => {
    if (selectedTickets.size === 0) return

    try {
      setUpdating(true)
      setError(null)

      const { error: updateError } = await supabase
        .from('tickets')
        .update({
          agent_id: agentId || null,
          status: agentId ? 'in_progress' : 'open'
        })
        .in('id', Array.from(selectedTickets))

      if (updateError) throw updateError

      setSelectedTickets(new Set())
      await fetchTickets()
    } catch (err) {
      console.error('Error assigning tickets:', err)
      setError(t('common.tickets.errors.updateFailed'))
    } finally {
      setUpdating(false)
    }
  }

  return (
    <div className="w-full max-w-none" key={activeTab} data-component="AgentTicketsView">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('common.tickets.title')}</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {t('common.tickets.manageDescription')}
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
              onClick={() => setActiveTab('active')}
              className={`py-4 px-6 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'active'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/50'
                  : 'border-transparent text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              {t('common.tickets.status.active')}
            </button>
            <button
              onClick={() => setActiveTab('resolved')}
              className={`py-4 px-6 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'resolved'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/50'
                  : 'border-transparent text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              {t('common.tickets.status.resolved')}
            </button>
          </nav>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{t('common.tickets.loading')}</p>
            </div>
          ) : tickets.length === 0 ? (
            <p className="text-center py-4 text-gray-500 dark:text-gray-400">
              {t('common.tickets.noTicketsStatus', { status: t(`common.tickets.status.${activeTab}`) })}
            </p>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4 h-10">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-700 dark:ring-offset-gray-800 transition-colors cursor-pointer"
                      checked={selectedTickets.size === tickets.length}
                      onChange={handleSelectAll}
                    />
                    <span className="ml-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                      {selectedTickets.size === 0 
                        ? t('common.selectAll')
                        : t('common.selected', { count: selectedTickets.size })}
                    </span>
                  </label>
                  <div className="h-full flex items-center gap-2">
                    {selectedTickets.size > 0 && activeTab !== 'resolved' && (
                      <>
                        {isAdmin() && (
                          <>
                            <div className="relative">
                              <div className="relative">
                                <input
                                  type="text"
                                  className="h-9 pl-3 pr-8 text-sm border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-400 dark:focus:border-blue-400 disabled:opacity-50 disabled:cursor-not-allowed w-64"
                                  placeholder={t('common.searchAgent')}
                                  value={agentSearch}
                                  onChange={(e) => setAgentSearch(e.target.value)}
                                  onFocus={() => setShowAgentDropdown(true)}
                                  onBlur={() => {
                                    setTimeout(() => setShowAgentDropdown(false), 200)
                                  }}
                                  disabled={updating}
                                />
                                {showAgentDropdown && agentSearch && filteredAgents.length > 0 && (
                                  <div 
                                    className="absolute z-10 mt-1 w-full bg-gray-50 dark:bg-gray-800 shadow-lg rounded-lg py-1 text-sm"
                                    onMouseDown={(e) => e.preventDefault()}
                                  >
                                    {filteredAgents
                                      .filter(agent => agent.id !== user.id)
                                      .map(agent => (
                                        <button
                                          key={agent.id}
                                          className="w-full px-3 py-2 text-left bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white"
                                          onClick={() => {
                                            assignSelectedTickets(agent.id)
                                            setAgentSearch('')
                                            setShowAgentDropdown(false)
                                          }}
                                        >
                                          {agent.full_name || agent.email}
                                        </button>
                                      ))}
                                  </div>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() => assignSelectedTickets(user.id)}
                              disabled={updating}
                              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-all shadow-sm"
                            >
                              {updating ? (
                                <>
                                  <svg className="animate-spin -ml-1 h-4 w-4" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                  </svg>
                                  <span>{t('common.tickets.assigning')}</span>
                                </>
                              ) : (
                                <>
                                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                  </svg>
                                  <span>{t('common.tickets.assignToMe')}</span>
                                </>
                              )}
                            </button>
                            <button
                              onClick={() => assignSelectedTickets('')}
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
                          </>
                        )}
                        <button
                          onClick={resolveSelectedTickets}
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
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-0.5">
              {tickets.map(ticket => (
                  <div
                    key={ticket.id}
                    className="flex items-center border border-gray-200 dark:border-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group"
                  >
                    <div className="px-3 py-2">
                      <input
                        type="checkbox"
                        className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-700 dark:ring-offset-gray-800 transition-colors cursor-pointer group-hover:border-blue-500 dark:group-hover:border-blue-400"
                        checked={selectedTickets.has(ticket.id)}
                        onChange={() => handleSelectTicket(ticket.id)}
                      />
                    </div>
                <Link
                  to={`/dashboard/tickets/${ticket.id}`}
                      className="flex-1 px-2 py-2"
                      onClick={(e) => {
                        if (e.target.tagName === 'INPUT') {
                          e.preventDefault();
                        }
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {ticket.title}
                    </h3>
                            <div className="flex gap-1 flex-shrink-0">
                      {getPriorityBadge(ticket.priority)}
                      {getStatusBadge(ticket.status)}
                    </div>
                  </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-1">
                    {ticket.description}
                  </p>
                        </div>
                        <div className="flex items-center gap-4 flex-shrink-0 text-xs text-gray-500 dark:text-gray-400">
                      {ticket.status === 'resolved' && ticket.satisfaction_rating && (
                            <span className="flex items-center whitespace-nowrap">
                          {t('common.tickets.rating', { rating: ticket.satisfaction_rating })} <span className="text-amber-400 ml-1">★</span>
                        </span>
                      )}
                          <div className="flex flex-col items-end gap-0.5">
                            <div className="flex items-center gap-2">
                              <span className="whitespace-nowrap">
                                {ticket.customer?.full_name || ticket.customer?.email}
                              </span>
                              {ticket.status === 'in_progress' && ticket.agent && (
                                <>
                                  <span className="text-gray-400 dark:text-gray-500">•</span>
                                  <span className="text-blue-600 dark:text-blue-400 whitespace-nowrap">
                                    {t('common.tickets.assignedTo', { name: ticket.agent.full_name || ticket.agent.email })}
                                  </span>
                                </>
                              )}
                            </div>
                            <span className="whitespace-nowrap">{new Date(ticket.created_at).toLocaleString()}</span>
                          </div>
                    </div>
                  </div>
                </Link>
                  </div>
              ))}
            </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
} 