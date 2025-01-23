import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabaseClient'

export function PendingOrganizations() {
  const { profile } = useAuth()
  const [pendingOrgs, setPendingOrgs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    console.log('Current user profile:', profile)
    fetchPendingOrgs()
  }, [])

  const fetchPendingOrgs = async () => {
    try {
      setLoading(true)
      setError(null)

      // First, let's check if there are any organizations at all
      const { data: allOrgs, error: allOrgsError } = await supabase
        .from('pending_organizations')
        .select('*')
      
      console.log('All organizations (regardless of status):', allOrgs)

      // Then try our filtered query
      console.log('Fetching pending organizations...')
      const { data, error } = await supabase
        .from('pending_organizations')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching pending organizations:', error)
        throw error
      }
      
      console.log('Fetched pending organizations:', data)
      setPendingOrgs(data)
    } catch (err) {
      console.error('Error fetching pending organizations:', err)
      setError('Failed to load pending organizations')
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (org) => {
    try {
      setError(null)

      // First create the approved organization
      const { data: newOrg, error: createError } = await supabase
        .from('organizations')
        .insert([{
          name: org.name,
          description: org.description
        }])
        .select()
        .single()

      if (createError) throw createError

      // Then update the pending organization status
      const { error: updateError } = await supabase
        .from('pending_organizations')
        .update({ status: 'approved' })
        .eq('id', org.id)

      if (updateError) throw updateError

      // Refresh the list
      fetchPendingOrgs()

      // Send email notification (you'll need to implement this)
      // notifyApproval(org.contact_email, org.name)
    } catch (err) {
      console.error('Error approving organization:', err)
      setError('Failed to approve organization')
    }
  }

  const handleDeny = async (org) => {
    try {
      setError(null)

      const { error: updateError } = await supabase
        .from('pending_organizations')
        .update({ status: 'denied' })
        .eq('id', org.id)

      if (updateError) throw updateError

      // Refresh the list
      fetchPendingOrgs()

      // Send email notification (you'll need to implement this)
      // notifyDenial(org.contact_email, org.name)
    } catch (err) {
      console.error('Error denying organization:', err)
      setError('Failed to deny organization')
    }
  }

  if (profile?.role !== 'admin') {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">You don't have access to this page.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
        <p className="mt-4 text-gray-500 dark:text-gray-400">Loading pending organizations...</p>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Pending Organizations</h1>

      {error && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {pendingOrgs.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">No pending organizations to review.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {pendingOrgs.map((org) => (
            <div key={org.id} className="bg-gray-50 dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
              <div className="p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                      {org.name}
                    </h3>
                    <p className="mt-1 text-gray-700 dark:text-gray-400">
                      {org.description}
                    </p>
                    <div className="mt-4 space-y-2">
                      <p className="text-sm text-gray-700 dark:text-gray-400">
                        <span className="font-medium">Contact Name:</span> {org.contact_name}
                      </p>
                      <p className="text-sm text-gray-700 dark:text-gray-400">
                        <span className="font-medium">Contact Email:</span> {org.contact_email}
                      </p>
                      {org.contact_phone && (
                        <p className="text-sm text-gray-700 dark:text-gray-400">
                          <span className="font-medium">Contact Phone:</span> {org.contact_phone}
                        </p>
                      )}
                      <p className="text-sm text-gray-700 dark:text-gray-400">
                        <span className="font-medium">Submitted:</span> {new Date(org.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApprove(org)}
                      className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleDeny(org)}
                      className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    >
                      Deny
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
} 