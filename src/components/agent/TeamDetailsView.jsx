import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../contexts/AuthContext'
import { HiOutlineUserGroup, HiOutlineTicket, HiOutlineChartBar, HiArrowLeft } from 'react-icons/hi'
import { supabase } from '../../lib/supabaseClient'
import { toast } from 'react-hot-toast'

export function TeamDetailsView() {
  const { t } = useTranslation()
  const { teamId } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [team, setTeam] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

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

        // Then, fetch the profiles for all team members
        const memberIds = teamData.team_members.map(member => member.user_id)
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', memberIds)

        if (profilesError) throw profilesError

        // Transform the data to match our component's expectations
        const transformedTeam = {
          ...teamData,
          memberCount: teamData.team_members.length,
          ticketCount: 0, // We'll implement this later
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

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900/20">
              <HiOutlineUserGroup className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                {t('common.teams.totalMembers')}
              </p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {team?.memberCount || 0}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-green-100 dark:bg-green-900/20">
              <HiOutlineTicket className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                {t('common.teams.activeTickets')}
              </p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {team?.ticketCount || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-purple-100 dark:bg-purple-900/20">
              <HiOutlineChartBar className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                {t('common.teams.completionRate')}
              </p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                85%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Team Members */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="p-6">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            {t('common.teams.members')}
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

      {/* Recent Activity / Tickets */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="p-6">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            {t('common.teams.recentActivity')}
          </h2>
          <div className="space-y-4">
            {/* Placeholder for recent tickets/activity */}
            <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
              <div className="animate-pulse flex space-x-4">
                <div className="flex-1 space-y-4 py-1">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                  <div className="space-y-2">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
              <div className="animate-pulse flex space-x-4">
                <div className="flex-1 space-y-4 py-1">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                  <div className="space-y-2">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
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