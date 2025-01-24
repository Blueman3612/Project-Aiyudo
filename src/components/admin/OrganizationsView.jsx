import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabaseClient'
import { OrganizationFiles } from '../organizations/OrganizationFiles'
import { useTranslation } from 'react-i18next'

export function OrganizationsView() {
  const { t } = useTranslation()
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
  const [pendingFiles, setPendingFiles] = useState([])
  const [fileDescription, setFileDescription] = useState('')
  const fileInputRef = useRef(null)

  // Redirect if not admin
  if (profile?.role !== 'admin') {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">{t('common.noAccess')}</p>
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
      setError(t('common.organizations.errors.fetchFailed'))
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
      setError(t('common.organizations.errors.agentsFetchFailed'))
    }
  }

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files)
    setPendingFiles(prev => [...prev, ...files])
    setFileDescription('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const removePendingFile = (index) => {
    setPendingFiles(files => files.filter((_, i) => i !== index))
  }

  const handleCreateOrganization = async (e) => {
    e.preventDefault()
    setError(null)
    
    try {
      // First create the organization
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .insert([{ name: newOrg.name, description: newOrg.description }])
        .select()
        .single()

      if (orgError) throw orgError

      // Then upload each file and create records
      for (const file of pendingFiles) {
        const filePath = `${org.id}/${Date.now()}-${file.name}`
        
        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from('organization-files')
          .upload(filePath, file)

        if (uploadError) throw uploadError

        // Create file record
        const { error: fileRecordError } = await supabase
          .from('organization_files')
          .insert([{
            organization_id: org.id,
            file_name: file.name,
            file_type: file.type || 'application/octet-stream',
            file_size: file.size,
            storage_path: filePath,
            description: fileDescription.trim() || null
          }])

        if (fileRecordError) throw fileRecordError
      }

      // Reset form
      setNewOrg({ name: '', description: '' })
      setPendingFiles([])
      setFileDescription('')
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      fetchOrganizations()
      setIsAddOrgExpanded(false)
    } catch (err) {
      console.error('Error creating organization:', err)
      setError(err.message || t('common.organizations.errors.createFailed'))
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
      setError(t('common.organizations.errors.updateFailed'))
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
      setError(t('common.organizations.errors.deleteFailed'))
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
        <p className="mt-4 text-gray-500 dark:text-gray-400">{t('common.loading')}</p>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">{t('common.organizations.title')}</h1>
        
        {error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Add New Organization Form */}
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg overflow-hidden mb-6">
          <button 
            onClick={() => setIsAddOrgExpanded(!isAddOrgExpanded)}
            className="flex items-center justify-between w-full p-6 text-left bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 border-b border-gray-200 dark:border-gray-700"
          >
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('common.organizations.addNew')}</h2>
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
              <form onSubmit={handleCreateOrganization} className="space-y-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t('common.organizations.name')}
                  </label>
                  <input
                    type="text"
                    id="name"
                    value={newOrg.name}
                    onChange={(e) => setNewOrg({ ...newOrg, name: e.target.value })}
                    required
                    placeholder={t('common.organizations.namePlaceholder')}
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-sm bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:text-white shadow-sm"
                  />
                </div>

                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t('common.organizations.description')}
                  </label>
                  <textarea
                    id="description"
                    value={newOrg.description}
                    onChange={(e) => setNewOrg({ ...newOrg, description: e.target.value })}
                    rows={3}
                    placeholder={t('common.organizations.descriptionPlaceholder')}
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-sm bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:text-white shadow-sm"
                  />
                </div>

                {/* File Upload Section */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t('common.organizations.files.description')}
                  </label>
                  <input
                    type="text"
                    value={fileDescription}
                    onChange={(e) => setFileDescription(e.target.value)}
                    placeholder={t('common.organizations.files.descriptionPlaceholder')}
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-sm bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:text-white shadow-sm"
                  />
                  
                  <div className="mt-4">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileSelect}
                      className="hidden"
                      id="file-upload"
                    />
                    <label
                      htmlFor="file-upload"
                      className="text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 cursor-pointer"
                    >
                      {t('common.organizations.chooseFile')}
                    </label>
                    <span className="ml-2 text-sm text-gray-700 dark:text-gray-400">
                      {pendingFiles.length === 0 ? t('common.organizations.noFileChosen') : ''}
                    </span>
                  </div>

                  {/* Pending Files List */}
                  {pendingFiles.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {pendingFiles.map((file, index) => (
                        <div key={index} className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="text-sm text-gray-900 dark:text-white">
                              {file.name}
                            </div>
                            <div className="text-xs text-gray-700 dark:text-gray-400">
                              {fileDescription || t('common.organizations.noDescription')}
                            </div>
                            <div className="text-xs text-gray-700 dark:text-gray-400">
                              {t('common.organizations.uploadedOn', { date: new Date().toLocaleDateString() })} • {(file.size / (1024 * 1024)).toFixed(2)} MB
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => removePendingFile(index)}
                              className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                            >
                              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    {t('common.organizations.create')}
                  </button>
                </div>
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
            placeholder={t('common.organizations.searchPlaceholder')}
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
              <p className="text-gray-700 dark:text-gray-400">
                {searchQuery ? t('common.organizations.noSearchResults') : t('common.organizations.noOrganizations')}
              </p>
            </div>
          ) : (
            filteredOrganizations.map((org) => (
              <div key={org.id} className="bg-gray-50 dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
                {/* Organization Header */}
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                  {editingOrg?.id === org.id ? (
                    <div className="space-y-4">
                      <input
                        type="text"
                        value={editingOrg.name}
                        onChange={(e) => setEditingOrg({ ...editingOrg, name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        placeholder={t('common.organizations.namePlaceholder')}
                      />
                      <textarea
                        value={editingOrg.description}
                        onChange={(e) => setEditingOrg({ ...editingOrg, description: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        placeholder={t('common.organizations.descriptionPlaceholder')}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleUpdateOrg(org.id)}
                          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                        >
                          {t('common.save')}
                        </button>
                        <button
                          onClick={() => setEditingOrg(null)}
                          className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
                        >
                          {t('common.cancel')}
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
                          <p className="mt-1 text-gray-700 dark:text-gray-400">
                            {org.description}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setEditingOrg(org)}
                            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-md"
                            title={t('common.edit')}
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => setDeletingOrg(org)}
                            className="p-2 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-200 bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-md"
                            title={t('common.delete')}
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
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-400 mb-4">
                    {t('common.organizations.assignedAgents')}
                  </h4>
                  
                  {/* Currently assigned agents */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mb-4">
                    {org.organization_agents.map(oa => (
                      <div key={oa.agent_id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded-md">
                        <span className="text-sm text-gray-900 dark:text-white">
                          {oa.profiles?.full_name || oa.profiles?.email || t('common.organizations.unknownAgent')}
                        </span>
                        <button
                          onClick={() => handleAgentAssignment(org.id, selectedAgents[org.id].filter(id => id !== oa.agent_id))}
                          className="px-2 py-1 text-xs bg-red-100 text-red-600 rounded hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50"
                        >
                          {t('common.remove')}
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Searchable agent combobox */}
                  <div className="relative max-w-md">
                    <input
                      type="text"
                      placeholder={t('common.organizations.searchAgents')}
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

      {/* Delete Confirmation Modal */}
      {deletingOrg && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {t('common.organizations.deleteTitle')}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {t('common.organizations.deleteConfirmation', { name: deletingOrg.name })}
            </p>
            <div className="flex justify-end gap-4">
              <button
                onClick={() => setDeletingOrg(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={() => handleDeleteOrg(deletingOrg.id)}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 