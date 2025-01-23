import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabaseClient'

export function OrganizationsView() {
  const { profile } = useAuth()
  const [organizations, setOrganizations] = useState([])
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
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Add New Organization</h2>
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

        {/* Organizations list */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {organizations.map((org) => (
              <li key={org.id} className="p-6">
                {editingOrg?.id === org.id ? (
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="edit-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Name
                      </label>
                      <input
                        type="text"
                        id="edit-name"
                        value={editingOrg.name}
                        onChange={(e) => setEditingOrg({ ...editingOrg, name: e.target.value })}
                        className="block w-full pl-3 pr-10 py-2 text-sm bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:text-white shadow-sm"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="edit-description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Description
                      </label>
                      <input
                        type="text"
                        id="edit-description"
                        value={editingOrg.description}
                        onChange={(e) => setEditingOrg({ ...editingOrg, description: e.target.value })}
                        className="block w-full pl-3 pr-10 py-2 text-sm bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:text-white shadow-sm"
                      />
                    </div>
                    <div className="flex justify-end space-x-3">
                      <button
                        onClick={() => setEditingOrg(null)}
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleUpdateOrg(org.id)}
                        className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white">{org.name}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{org.description}</p>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => setEditingOrg(org)}
                          className="px-3 py-1 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setDeletingOrg(org)}
                          className="px-3 py-1 bg-red-100 text-red-600 rounded-md hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    {/* Delete confirmation dialog */}
                    {deletingOrg?.id === org.id && (
                      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
                          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Delete Organization</h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                            Are you sure you want to delete "{org.name}"? This action cannot be undone.
                          </p>
                          <div className="flex justify-end space-x-3">
                            <button
                              onClick={() => setDeletingOrg(null)}
                              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleDeleteOrg(org.id)}
                              className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="mt-6">
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
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
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
} 