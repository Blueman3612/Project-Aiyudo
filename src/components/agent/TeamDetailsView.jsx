import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../contexts/AuthContext'
import { HiOutlineUserGroup, HiOutlineTicket, HiOutlineChartBar, HiArrowLeft, HiX } from 'react-icons/hi'
import { supabase } from '../../lib/supabaseClient'
import { toast } from 'react-hot-toast'
import { formatDistanceToNow } from 'date-fns'

export function TeamDetailsView() {
  const { t } = useTranslation()
  const { teamId } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [team, setTeam] = useState(null)
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isBotEnabled, setIsBotEnabled] = useState(false)

  useEffect(() => {
    async function fetchTeamDetails() {
      try {
        setLoading(true)
        setError(null)

        // First, fetch the team and its members
        const { data: teamData, error: teamError } = await supabase
          .from('teams')
          .select('*, team_members(user_id, role)')
          .eq('id', teamId)
          .single()

        if (teamError) throw teamError
        if (!teamData) throw new Error('Team not found')

        // Set the bot enabled state
        setIsBotEnabled(teamData.is_bot_enabled || false)

        // Then, fetch the profiles for all team members
        const memberIds = teamData.team_members.map(member => member.user_id)
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', memberIds)

        if (profilesError) throw profilesError

        // Fetch team's tickets
        const { data: ticketsData, error: ticketsError } = await supabase
          .from('tickets')
          .select(`
            *,
            customer:profiles!customer_id(*),
            agent:profiles!agent_id(*)
          `)
          .eq('team_id', teamId)
          .order('updated_at', { ascending: false })

        if (ticketsError) throw ticketsError

        // Transform the data to match our component's expectations
        const transformedTeam = {
          ...teamData,
          memberCount: teamData.team_members.length,
          ticketCount: ticketsData.filter(t => t.status !== 'resolved').length,
          members: teamData.team_members.map(member => {
            const memberProfile = profilesData.find(p => p.id === member.user_id)
            return {
              id: member.user_id,
              name: memberProfile?.full_name || memberProfile?.email || 'Unknown User',
              role: member.role
            }
          })
        }

        setTeam(transformedTeam)
        setTickets(ticketsData)
      } catch (err) {
        console.error('Error fetching team details:', err)
        setError(t('common.teams.errors.fetchDetailsFailed'))
        toast.error(t('common.teams.errors.fetchDetailsFailed'))
      } finally {
        setLoading(false)
      }
    }

    if (teamId) {
      fetchTeamDetails()
    }
  }, [teamId, t])

  const handleBotToggle = async () => {
    try {
      const { error: updateError } = await supabase
        .from('teams')
        .update({ is_bot_enabled: !isBotEnabled })
        .eq('id', teamId)

      if (updateError) throw updateError

      setIsBotEnabled(!isBotEnabled)
      toast.success(t(isBotEnabled ? 'common.teams.botDisabled' : 'common.teams.botEnabled'))
    } catch (err) {
      console.error('Error updating bot status:', err)
      toast.error(t('common.teams.errors.updateFailed'))
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

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
        <p className="mt-4 text-gray-500 dark:text-gray-400">{t('common.loading')}</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500">{error}</p>
      </div>
    )
  }

  return (
    <div className="w-full max-w-none space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/dashboard/teams')}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <HiArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
              {team?.name}
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {team?.description}
            </p>
          </div>
        </div>
        
        {/* Bot Toggle */}
        {(profile?.role === 'admin' || team?.created_by === profile?.id) && (
          <div className="flex items-center space-x-3">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {t('common.teams.aiyudoBot')}
            </span>
            <button
              onClick={handleBotToggle}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                isBotEnabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
              }`}
              role="switch"
              aria-checked={isBotEnabled}
            >
            </button>
          </div>
        )}
      </div>

      {/* Team Members */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="p-6">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            {t('common.teams.membersHeader')}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {team?.members.map((member) => (
              <div
                key={member.id}
                className="flex items-center space-x-3 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
              >
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                    <span className="text-gray-600 dark:text-gray-300 text-sm">
                      {member.name.charAt(0)}
                    </span>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {member.name}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {member.role}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Team Tickets */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="p-6">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            {t('common.teams.ticketsHeader')}
          </h2>
          <div className="space-y-4">
            {tickets.length === 0 ? (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t('common.teams.noTickets')}
              </p>
            ) : (
              tickets.map(ticket => (
                <Link
                  key={ticket.id}
                  to={`/dashboard/tickets/${ticket.id}`}
                  className="block border-l-4 p-4 border-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
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
                    {getStatusBadge(ticket.status)}
                  </div>
                  <div className="mt-2 text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                    <span>
                      {t('common.tickets.updatedAgo', {
                        time: formatDistanceToNow(new Date(ticket.updated_at))
                      })}
                    </span>
                    <span>•</span>
                    <span>
                      {ticket.customer?.full_name || ticket.customer?.email}
                    </span>
                    {ticket.agent && (
                      <>
                        <span>•</span>
                        <span className="text-blue-600 dark:text-blue-400">
                          {t('common.tickets.assignedTo', { name: ticket.agent.full_name || ticket.agent.email })}
                        </span>
                      </>
                    )}
                    {ticket.status === 'resolved' && ticket.satisfaction_rating && (
                      <>
                        <span>•</span>
                        <span className="flex items-center">
                          {t('common.tickets.rating', { rating: ticket.satisfaction_rating })}
                          <span className="text-amber-400 dark:text-amber-300 ml-1">★</span>
                        </span>
                      </>
                    )}
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
} 