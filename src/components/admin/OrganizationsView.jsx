import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabaseClient'
import { OrganizationFiles } from '../organizations/OrganizationFiles'

export function OrganizationsView() {
  const { profile } = useAuth()
  const [organizations, setOrganizations] = useState([])
  const [filteredOrganizations, setFilteredOrganizations] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editingOrg, setEditingOrg] = useState(null)
  const [newOrg, setNewOrg] = useState({ name: '', description: '' })
  const [selectedAgents, setSelectedAgents] = useState({})
  const [agentSearch, setAgentSearch] = useState({})
  const [showAgentResults, setShowAgentResults] = useState({})
  const [newOrgAgents, setNewOrgAgents] = useState([])
  const [newOrgAgentSearch, setNewOrgAgentSearch] = useState('')
  const [showNewOrgAgentResults, setShowNewOrgAgentResults] = useState(false)
  const [deletingOrg, setDeletingOrg] = useState(null)
  const [isAddOrgExpanded, setIsAddOrgExpanded] = useState(false)

  // Redirect if not admin
  if (profile?.role !== 'admin') {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">You don't have access to this page.</p>
      </div>
    )
  }

  useEffect(() => {
    fetchOrganizations()
    fetchAgents()
  }, [])

  // Add new effect for filtering organizations
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredOrganizations(organizations)
      return
    }

    const query = searchQuery.toLowerCase()
    const filtered = organizations.filter(org => 
      org.name.toLowerCase().includes(query) || 
      org.description?.toLowerCase().includes(query)
    )
    setFilteredOrganizations(filtered)
  }, [searchQuery, organizations])

  const fetchOrganizations = async () => {
    try {
      setLoading(true)
      const { data: orgs, error: orgsError } = await supabase
        .from('organizations')
        .select(`
          *,
          organization_agents (
            agent_id
          )
        `)
        .order('name')

      if (orgsError) throw orgsError

      // Fetch agent details separately
      const agentIds = [...new Set(orgs.flatMap(org => 
        org.organization_agents.map(oa => oa.agent_id)
      ))]

      const { data: agentProfiles, error: agentsError } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', agentIds)
        .eq('role', 'agent')

      if (agentsError) throw agentsError

      // Map profiles to organizations
      const orgsWithProfiles = orgs.map(org => ({
        ...org,
        organization_agents: org.organization_agents.map(oa => ({
          ...oa,
          profiles: agentProfiles?.find(p => p.id === oa.agent_id)
        }))
      }))

      setOrganizations(orgsWithProfiles)
      
      // Set up selected agents state
      const agentSelections = {}
      orgs.forEach(org => {
        agentSelections[org.id] = org.organization_agents.map(oa => oa.agent_id)
      })
      setSelectedAgents(agentSelections)
    } catch (err) {
      console.error('Error fetching organizations:', err)
      setError('Failed to load organizations')
    } finally {
      setLoading(false)
    }
  }

  const fetchAgents = async () => {
    try {
      const { data: agentsList, error: agentsError } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('role', 'agent')
        .order('full_name')

      if (agentsError) throw agentsError
      setAgents(agentsList)
    } catch (err) {
      console.error('Error fetching agents:', err)
      setError('Failed to load agents')
    }
  }

  const handleCreateOrg = async (e) => {
    e.preventDefault()
    try {
      const { data: org, error: createError } = await supabase
        .from('organizations')
        .insert([{
          name: newOrg.name,
          description: newOrg.description
        }])
        .select()
        .single()

      if (createError) throw createError

      // Add agent assignments
      if (newOrgAgents.length > 0) {
        const { error: agentError } = await supabase
          .from('organization_agents')
          .insert(
            newOrgAgents.map(agentId => ({
              organization_id: org.id,
              agent_id: agentId
            }))
          )
        if (agentError) throw agentError
      }

      await fetchOrganizations() // Refresh the list to include assignments
      setNewOrg({ name: '', description: '' })
      setNewOrgAgents([])
      setNewOrgAgentSearch('')
    } catch (err) {
      console.error('Error creating organization:', err)
      setError('Failed to create organization')
    }
  }

  const handleUpdateOrg = async (orgId) => {
    try {
      const { error: updateError } = await supabase
        .from('organizations')
        .update({
          name: editingOrg.name,
          description: editingOrg.description
        })
        .eq('id', orgId)

      if (updateError) throw updateError

      setOrganizations(organizations.map(org => 
        org.id === orgId ? { ...org, ...editingOrg } : org
      ))
      setEditingOrg(null)
    } catch (err) {
      console.error('Error updating organization:', err)
      setError('Failed to update organization')
    }
  }

  const handleDeleteOrg = async (orgId) => {
    try {
      const { error: deleteError } = await supabase
        .from('organizations')
        .delete()
        .eq('id', orgId)

      if (deleteError) throw deleteError

      setOrganizations(organizations.filter(org => org.id !== orgId))
      setDeletingOrg(null)
    } catch (err) {
      console.error('Error deleting organization:', err)
      setError('Failed to delete organization')
    }
  }

  const handleAgentAssignment = async (orgId, agentIds) => {
    try {
      // First, remove all existing assignments
      const { error: deleteError } = await supabase
        .from('organization_agents')
        .delete()
        .eq('organization_id', orgId)

      if (deleteError) throw deleteError

      // Then add new assignments
      if (agentIds.length > 0) {
        const { error: insertError } = await supabase
          .from('organization_agents')
          .insert(
            agentIds.map(agentId => ({
              organization_id: orgId,
              agent_id: agentId
            }))
          )

        if (insertError) throw insertError
      }

      // Update local state
      setSelectedAgents({ ...selectedAgents, [orgId]: agentIds })
      
      // Update organizations state locally
      setOrganizations(organizations.map(org => {
        if (org.id === orgId) {
          return {
            ...org,
            organization_agents: agentIds.map(agentId => ({
              agent_id: agentId,
              profiles: agents.find(a => a.id === agentId)
            }))
          }
        }
        return org
      }))
    } catch (err) {
      console.error('Error updating agent assignments:', err)
      setError('Failed to update agent assignments')
    }
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
        <p className="mt-4 text-gray-500 dark:text-gray-400">Loading organizations...</p>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Organizations</h1>
        
        {error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Add New Organization Form */}
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg overflow-hidden mb-6">
          <button 
            onClick={() => setIsAddOrgExpanded(!isAddOrgExpanded)}
            className="flex items-center justify-between w-full p-6 text-left border-b border-gray-200 dark:border-gray-700"
          >
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Add New Organization</h2>
            <svg 
              className={`w-5 h-5 text-gray-500 transition-transform ${isAddOrgExpanded ? 'transform rotate-180' : ''}`}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {isAddOrgExpanded && (
            <div className="p-6">
              <form onSubmit={handleCreateOrg} className="space-y-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    value={newOrg.name}
                    onChange={(e) => setNewOrg({ ...newOrg, name: e.target.value })}
                    className="block w-full pl-3 pr-10 py-2 text-sm bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:text-white shadow-sm"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    id="description"
                    value={newOrg.description}
                    onChange={(e) => setNewOrg({ ...newOrg, description: e.target.value })}
                    className="block w-full pl-3 pr-10 py-2 text-sm bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:text-white shadow-sm"
                  />
                </div>

                {/* Agent Assignment */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Assign Agents
                  </label>
                  {/* Selected agents */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mb-2">
                    {newOrgAgents.map(agentId => {
                      const agent = agents.find(a => a.id === agentId)
                      return (
                        <div key={agentId} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded-md">
                          <span className="text-sm text-gray-900 dark:text-white">
                            {agent?.full_name || agent?.email || 'Unknown Agent'}
                          </span>
                          <button
                            type="button"
                            onClick={() => setNewOrgAgents(newOrgAgents.filter(id => id !== agentId))}
                            className="px-2 py-1 text-xs bg-red-100 text-red-600 rounded hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50"
                          >
                            Remove
                          </button>
                        </div>
                      )
                    })}
                  </div>
                  {/* Agent search */}
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search for an agent..."
                      value={newOrgAgentSearch}
                      onChange={(e) => {
                        setNewOrgAgentSearch(e.target.value)
                        setShowNewOrgAgentResults(true)
                      }}
                      onFocus={() => setShowNewOrgAgentResults(true)}
                      className="block w-full pl-3 pr-10 py-2 text-sm bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:text-white shadow-sm"
                    />
                    {showNewOrgAgentResults && newOrgAgentSearch && (
                      <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 rounded-md shadow-lg max-h-60 overflow-auto border border-gray-200 dark:border-gray-700">
                        {agents
                          .filter(agent => 
                            !newOrgAgents.includes(agent.id) &&
                            (agent.full_name?.toLowerCase().includes(newOrgAgentSearch.toLowerCase()) ||
                             agent.email?.toLowerCase().includes(newOrgAgentSearch.toLowerCase()))
                          )
                          .map(agent => (
                            <button
                              type="button"
                              key={agent.id}
                              className="block w-full text-left px-4 py-2 text-sm text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700"
                              onClick={() => {
                                setNewOrgAgents([...newOrgAgents, agent.id])
                                setNewOrgAgentSearch('')
                                setShowNewOrgAgentResults(false)
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
                  type="submit"
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  Add Organization
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Search Bar */}
        <div className="relative mb-6">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search organizations..."
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

        {/* Organizations List */}
        <div className="space-y-6">
          {filteredOrganizations.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400">
                {searchQuery ? 'No organizations found matching your search.' : 'No organizations have been created yet.'}
              </p>
            </div>
          ) : (
            filteredOrganizations.map((org) => (
              <div key={org.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
                {/* Organization Header */}
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                  {editingOrg?.id === org.id ? (
                    <div className="space-y-4">
                      <input
                        type="text"
                        value={editingOrg.name}
                        onChange={(e) => setEditingOrg({ ...editingOrg, name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        placeholder="Organization name"
                      />
                      <textarea
                        value={editingOrg.description}
                        onChange={(e) => setEditingOrg({ ...editingOrg, description: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        placeholder="Description"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleUpdateOrg(org.id)}
                          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingOrg(null)}
                          className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                            {org.name}
                          </h3>
                          <p className="mt-1 text-gray-600 dark:text-gray-400">
                            {org.description}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setEditingOrg(org)}
                            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => setDeletingOrg(org.id)}
                            className="p-2 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-200"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Organization Files Section */}
                <div className="border-b border-gray-200 dark:border-gray-700">
                  <OrganizationFiles organizationId={org.id} />
                </div>

                {/* Assigned Agents Section */}
                <div className="p-6">
                  <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4">
                    Assigned Agents
                  </h4>
                  
                  {/* Currently assigned agents */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mb-4">
                    {org.organization_agents.map(oa => (
                      <div key={oa.agent_id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded-md">
                        <span className="text-sm text-gray-900 dark:text-white">
                          {oa.profiles?.full_name || oa.profiles?.email || 'Unknown Agent'}
                        </span>
                        <button
                          onClick={() => handleAgentAssignment(org.id, selectedAgents[org.id].filter(id => id !== oa.agent_id))}
                          className="px-2 py-1 text-xs bg-red-100 text-red-600 rounded hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Searchable agent combobox */}
                  <div className="relative max-w-md">
                    <input
                      type="text"
                      placeholder="Search for an agent..."
                      value={agentSearch[org.id] || ''}
                      onChange={(e) => {
                        setAgentSearch({ ...agentSearch, [org.id]: e.target.value })
                        setShowAgentResults({ ...showAgentResults, [org.id]: true })
                      }}
                      onFocus={() => setShowAgentResults({ ...showAgentResults, [org.id]: true })}
                      className="block w-full pl-3 pr-10 py-2 text-sm bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:text-white shadow-sm"
                    />
                    
                    {/* Agent search results dropdown */}
                    {showAgentResults[org.id] && agentSearch[org.id] && (
                      <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 rounded-md shadow-lg max-h-60 overflow-auto border border-gray-200 dark:border-gray-700">
                        {agents
                          .filter(agent => 
                            !selectedAgents[org.id]?.includes(agent.id) &&
                            (agent.full_name?.toLowerCase().includes(agentSearch[org.id].toLowerCase()) ||
                             agent.email?.toLowerCase().includes(agentSearch[org.id].toLowerCase()))
                          )
                          .map(agent => (
                            <button
                              key={agent.id}
                              className="block w-full text-left px-4 py-2 text-sm text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700"
                              onClick={() => {
                                handleAgentAssignment(org.id, [...(selectedAgents[org.id] || []), agent.id])
                                setAgentSearch({ ...agentSearch, [org.id]: '' })
                                setShowAgentResults({ ...showAgentResults, [org.id]: false })
                              }}
                            >
                              {agent.full_name || agent.email}
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
} 