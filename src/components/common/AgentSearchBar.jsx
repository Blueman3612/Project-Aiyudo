import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { HiOutlineUser, HiOutlineUserGroup } from 'react-icons/hi'
import { fetchTeams } from '../../lib/teamQueries'
import { toast } from 'react-hot-toast'

export function AgentSearchBar({
  value,
  onChange,
  onSelect,
  agents,
  selectedAgents = [],
  disabled = false,
  placeholder,
  width = 'w-64',
  showDropdown = true,
  setShowDropdown,
  containerClassName = '',
  isTicketAssignment = false
}) {
  const { t } = useTranslation()
  const [filteredResults, setFilteredResults] = useState([])
  const [teams, setTeams] = useState([])

  // Load teams if we're in ticket assignment mode
  useEffect(() => {
    if (isTicketAssignment) {
      const loadTeams = async () => {
        try {
          const teamsData = await fetchTeams()
          setTeams(teamsData || [])
        } catch (err) {
          console.error('Error loading teams:', err)
          toast.error(t('common.errors.loadTeamsFailed'))
        }
      }
      loadTeams()
    }
  }, [isTicketAssignment])

  // Filter both agents and teams based on search value
  useEffect(() => {
    if (!value) {
      setFilteredResults([])
      return
    }

    const searchTerm = value.toLowerCase()
    let filtered = []

    // Add filtered agents
    if (agents) {
      filtered = agents
        .filter(agent => 
          !selectedAgents.includes(agent.id) &&
          (agent.full_name?.toLowerCase().includes(searchTerm) ||
           agent.email?.toLowerCase().includes(searchTerm))
        )
        .map(agent => ({ ...agent, type: 'agent' }))
    }

    // Add filtered teams if in ticket assignment mode
    if (isTicketAssignment && teams.length > 0) {
      const filteredTeams = teams
        .filter(team => 
          team.name?.toLowerCase().includes(searchTerm) ||
          team.description?.toLowerCase().includes(searchTerm)
        )
        .map(team => ({ ...team, type: 'team' }))
      filtered = [...filtered, ...filteredTeams]
    }

    setFilteredResults(filtered)
  }, [value, agents, teams, selectedAgents, isTicketAssignment])

  return (
    <div className={`relative ${containerClassName}`}>
      <div className="relative">
        <input
          type="text"
          className={`h-9 pl-3 pr-8 text-sm border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-400 dark:focus:border-blue-400 disabled:opacity-50 disabled:cursor-not-allowed ${width}`}
          placeholder={placeholder || (isTicketAssignment ? t('common.searchAgentOrTeam') : t('common.searchAgent'))}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setShowDropdown?.(true)}
          onBlur={() => {
            // Delay hiding dropdown to allow for click events
            setTimeout(() => setShowDropdown?.(false), 200)
          }}
          disabled={disabled}
        />
        {isTicketAssignment ? (
          <HiOutlineUserGroup className="absolute right-2.5 top-2.5 h-4 w-4 text-gray-400" />
        ) : (
          <HiOutlineUser className="absolute right-2.5 top-2.5 h-4 w-4 text-gray-400" />
        )}
      </div>

      {showDropdown && filteredResults.length > 0 && (
        <div 
          className="absolute z-10 mt-1 w-full bg-gray-50 dark:bg-gray-800 shadow-lg rounded-lg py-1 text-sm"
          onMouseDown={(e) => e.preventDefault()} // Prevent blur from closing dropdown before click
        >
          {filteredResults.map(result => (
            <button
              key={`${result.type}-${result.id}`}
              className="w-full px-3 py-2 text-left bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700/50 text-gray-900 dark:text-white flex items-center space-x-2"
              onClick={() => {
                onSelect(result)
                onChange('')
                setShowDropdown?.(false)
              }}
            >
              {result.type === 'agent' ? (
                <HiOutlineUser className="h-4 w-4 text-gray-400" />
              ) : (
                <HiOutlineUserGroup className="h-4 w-4 text-gray-400" />
              )}
              <div>
                <div className="font-medium">
                  {result.type === 'agent' ? result.full_name : result.name}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {result.type === 'agent' ? result.email : result.description}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
} 