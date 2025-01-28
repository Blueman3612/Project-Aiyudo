import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useTranslation } from 'react-i18next'
import { toast } from 'react-hot-toast'
import { fetchTeams, createTeam, joinTeamByInviteCode, deleteTeam, updateTeam, generateTeamInvite, removeTeamMember } from '../../lib/teamQueries'
import { HiOutlineUserGroup, HiOutlineClipboardCopy, HiOutlinePencil, HiOutlineTrash, HiPlus, HiUserAdd, HiX } from 'react-icons/hi'
import { ConfirmationModal } from '../common/ConfirmationModal'
import { Tooltip } from '../common/Tooltip'
import { useNavigate } from 'react-router-dom'

export function TeamsView() {
  const { t } = useTranslation()
  const { profile } = useAuth()
  const [teams, setTeams] = useState([])
  const [filteredTeams, setFilteredTeams] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isAddTeamExpanded, setIsAddTeamExpanded] = useState(false)
  const [isJoinTeamExpanded, setIsJoinTeamExpanded] = useState(false)
  const [newTeam, setNewTeam] = useState({ name: '', description: '' })
  const [editingTeam, setEditingTeam] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState({ isOpen: false, team: null })
  const navigate = useNavigate()

  const isAdmin = profile?.role === 'admin'

  useEffect(() => {
    loadTeams()
  }, [])

  // Filter teams based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredTeams(teams)
      return
    }

    const filtered = teams.filter(
      team =>
        team.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        team.description?.toLowerCase().includes(searchQuery.toLowerCase())
    )
    setFilteredTeams(filtered)
  }, [searchQuery, teams])

  const loadTeams = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await fetchTeams()
      setTeams(data)
      setFilteredTeams(data)
    } catch (err) {
      setError(t('common.teams.errors.fetchFailed'))
      console.error('Error loading teams:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateTeam = async (e) => {
    e.preventDefault()
    if (!newTeam.name.trim()) return

    try {
      setIsSubmitting(true)
      setError(null)
      await createTeam(newTeam)
      await loadTeams()
      setNewTeam({ name: '', description: '' })
      setIsAddTeamExpanded(false)
    } catch (err) {
      setError(t('common.teams.errors.createFailed'))
      console.error('Error creating team:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleJoinTeam = async () => {
    try {
      const clipboardText = await navigator.clipboard.readText()
      if (!clipboardText.trim()) {
        toast.error(t('common.teams.errors.noInviteCode'))
        return
      }

      setIsSubmitting(true)
      setError(null)
      await joinTeamByInviteCode(clipboardText)
      await loadTeams()
      toast.success(t('common.teams.joinSuccess'))
    } catch (err) {
      toast.error(err.message || t('common.teams.errors.joinFailed'))
      console.error('Error joining team:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUpdateTeam = async (team) => {
    try {
      setIsSubmitting(true)
      setError(null)
      await updateTeam(team)
      await loadTeams()
      setEditingTeam(null)
    } catch (err) {
      setError(t('common.teams.errors.updateFailed'))
      console.error('Error updating team:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteTeam = async (team) => {
    try {
      setIsSubmitting(true)
      setError(null)
      await deleteTeam(team.id)
      await loadTeams()
      setDeleteConfirmation({ isOpen: false, team: null })
    } catch (err) {
      setError(t('common.teams.errors.deleteFailed'))
      console.error('Error deleting team:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCopyInvite = async (teamId) => {
    try {
      const code = await generateTeamInvite(teamId)
      await navigator.clipboard.writeText(code)
      toast.success(t('common.teams.inviteCodeCopied'), {
        icon: '📋',
        duration: 2000
      })
    } catch (err) {
      toast.error(t('common.teams.errors.generateInviteFailed'))
      console.error('Error generating invite code:', err)
    }
  }

  const handleRemoveMember = async (teamId, memberId, memberName) => {
    try {
      setIsSubmitting(true)
      await removeTeamMember(teamId, memberId)
      await loadTeams()
      toast.success(t('common.teams.memberRemoved', { name: memberName }))
    } catch (err) {
      toast.error(t('common.teams.errors.removeMemberFailed'))
      console.error('Error removing team member:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCardClick = (teamId, e) => {
    // Prevent navigation if clicking on buttons or if editing
    if (e.target.closest('button') || editingTeam?.id === teamId) {
      return
    }
    navigate(`/dashboard/teams/${teamId}`)
  }

  return (
    <div className="w-full max-w-none space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            {t('common.teams.title')}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t('common.teams.subtitle')}
          </p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={handleJoinTeam}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-900"
            disabled={isSubmitting}
          >
            <HiUserAdd className="w-5 h-5 mr-2" />
            {isSubmitting ? t('common.saving') : t('common.teams.join')}
          </button>
          <button
            onClick={() => setIsAddTeamExpanded(!isAddTeamExpanded)}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-900"
            disabled={isSubmitting}
          >
            <HiPlus className="w-5 h-5 mr-2" />
            {t('common.teams.create')}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/50 text-red-600 dark:text-red-400 p-4 rounded-lg">
          {error}
        </div>
      )}

      {/* Create Team Form */}
      {isAddTeamExpanded && (
        <form onSubmit={handleCreateTeam} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            {t('common.teams.createNew')}
          </h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="teamName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('common.teams.name')}
              </label>
              <input
                type="text"
                id="teamName"
                value={newTeam.name}
                onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })}
                placeholder={t('common.teams.namePlaceholder')}
                className="block w-full pl-3 pr-3 py-2 text-sm bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-white shadow-sm"
                disabled={isSubmitting}
                required
              />
            </div>
            <div>
              <label htmlFor="teamDescription" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('common.teams.description')}
              </label>
              <textarea
                id="teamDescription"
                value={newTeam.description}
                onChange={(e) => setNewTeam({ ...newTeam, description: e.target.value })}
                placeholder={t('common.teams.descriptionPlaceholder')}
                rows={3}
                className="block w-full pl-3 pr-3 py-2 text-sm bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-white shadow-sm"
                disabled={isSubmitting}
              />
            </div>
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setIsAddTeamExpanded(false)}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
                disabled={isSubmitting}
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
                disabled={isSubmitting}
              >
                {isSubmitting ? t('common.saving') : t('common.create')}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Search Bar */}
      <div className="relative mb-6">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t('common.teams.search')}
          className="block w-full pl-10 pr-3 py-2 text-sm bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:text-white shadow-sm"
        />
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <svg 
            className="h-5 w-5 text-gray-400" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" 
            />
          </svg>
        </div>
      </div>

      {/* Teams List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {loading ? (
            <div className="p-6 text-center text-gray-500 dark:text-gray-400">
              {t('common.loading')}
            </div>
          ) : error ? (
            <div className="p-6 text-center text-red-500">
              {error}
            </div>
          ) : filteredTeams.length === 0 ? (
            <div className="p-6 text-center text-gray-500 dark:text-gray-400">
              {searchQuery ? t('common.teams.noSearchResults') : t('common.teams.noTeams')}
            </div>
          ) : (
            filteredTeams.map((team) => (
              <div
                key={team.id}
                onClick={(e) => handleCardClick(team.id, e)}
                className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
              >
                {editingTeam?.id === team.id ? (
                  <div className="space-y-4">
                    <input
                      type="text"
                      value={editingTeam.name}
                      onChange={(e) => setEditingTeam({ ...editingTeam, name: e.target.value })}
                      className="block w-full pl-3 pr-3 py-2 text-sm bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-white shadow-sm"
                      placeholder={t('common.teams.namePlaceholder')}
                    />
                    <textarea
                      value={editingTeam.description || ''}
                      onChange={(e) => setEditingTeam({ ...editingTeam, description: e.target.value })}
                      rows={3}
                      className="block w-full pl-3 pr-3 py-2 text-sm bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-white shadow-sm"
                      placeholder={t('common.teams.descriptionPlaceholder')}
                    />
                    <div className="flex justify-end space-x-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditingTeam(null)
                        }}
                        className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 dark:focus:ring-gray-400"
                      >
                        {t('common.cancel')}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleUpdateTeam(editingTeam)
                        }}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 border border-transparent rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                      >
                        {t('common.save')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white truncate">
                          {team.name}
                        </h3>
                      </div>
                      {(isAdmin || team.created_by === profile?.id) && (
                        <div className="flex items-center space-x-2 ml-4">
                          <Tooltip content={t('common.teams.generateInvite')}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleCopyInvite(team.id)
                              }}
                              className="inline-flex items-center px-3 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-md transition-colors"
                            >
                              <HiOutlineClipboardCopy className="w-5 h-5" />
                            </button>
                          </Tooltip>
                          <Tooltip content={t('common.edit')}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setEditingTeam(team)
                              }}
                              className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                            >
                              <HiOutlinePencil className="w-5 h-5" />
                            </button>
                          </Tooltip>
                          <Tooltip content={t('common.delete')}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setDeleteConfirmation({ isOpen: true, team })
                              }}
                              className="inline-flex items-center px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-md transition-colors"
                            >
                              <HiOutlineTrash className="w-5 h-5" />
                            </button>
                          </Tooltip>
                        </div>
                      )}
                    </div>
                    <div className="mt-2 flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
                      <span className="flex items-center">
                        <HiOutlineUserGroup className="w-5 h-5 mr-1" />
                        {t('common.teams.memberCount', { count: team.memberCount })}
                      </span>
                    </div>
                    
                    {/* Members List */}
                    <div className="mt-4 space-y-2">
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {t('common.teams.membersList')}
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {team.members.map((member) => (
                          <div
                            key={member.id}
                            className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-md p-2"
                          >
                            <div className="flex items-center space-x-2 min-w-0">
                              <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0"></span>
                              <span className="font-medium truncate">{member.name}</span>
                              <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
                                ({member.role})
                              </span>
                            </div>
                            {(isAdmin || team.created_by === profile?.id) && member.id !== team.created_by && (
                              <Tooltip content={t('common.teams.removeMember')}>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleRemoveMember(team.id, member.id, member.name)
                                  }}
                                  disabled={isSubmitting}
                                  className="ml-2 p-1 text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 rounded-md hover:bg-gray-50/50 dark:hover:bg-gray-700/50 transition-colors"
                                >
                                  <HiX className="w-4 h-4" />
                                </button>
                              </Tooltip>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <ConfirmationModal
        isOpen={deleteConfirmation.isOpen}
        onClose={() => setDeleteConfirmation({ isOpen: false, team: null })}
        onConfirm={() => handleDeleteTeam(deleteConfirmation.team)}
        title={t('common.teams.deleteTitle')}
        message={t('common.teams.deleteConfirmation', { name: deleteConfirmation.team?.name })}
      />
    </div>
  )
} 