import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabaseClient'
import { useTranslation } from 'react-i18next'

export function NewTicketView() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [organizations, setOrganizations] = useState([])
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'support',
    priority: 'medium',
    organization_id: null
  })

  useEffect(() => {
    // Fetch all available organizations
    const fetchOrganizations = async () => {
      try {
        const { data: orgs, error: orgsError } = await supabase
          .from('organizations')
          .select('id, name')
          .order('name')

        if (orgsError) throw orgsError
        setOrganizations(orgs || [])
        
        // Set the first organization as default if available
        if (orgs?.length > 0) {
          setFormData(prev => ({ ...prev, organization_id: orgs[0].id }))
        }
      } catch (err) {
        console.error('Error fetching organizations:', err)
        setError(t('common.organizations.errors.fetchFailed'))
      }
    }

    fetchOrganizations()
  }, [user.id])

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      setLoading(true)
      setError(null)

      if (!formData.title.trim()) {
        throw new Error(t('common.tickets.errors.titleRequired'))
      }

      if (!formData.description.trim()) {
        throw new Error(t('common.tickets.errors.descriptionRequired'))
      }

      if (!formData.organization_id) {
        throw new Error(t('common.organizations.errors.required'))
      }

      const ticket = {
        ...formData,
        customer_id: user.id,
        status: 'open',
        organization_id: formData.organization_id
      }

      console.log('Creating ticket:', ticket)

      const { data, error: insertError } = await supabase
        .from('tickets')
        .insert([ticket])
        .select()
        .single()

      if (insertError) throw insertError

      navigate('/customer/tickets', {
        state: { success: t('common.tickets.createSuccess') }
      })
    } catch (err) {
      console.error('Error creating ticket:', err)
      setError(err.message || t('common.tickets.errors.createFailed'))
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value === '' ? null : value
    }))
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
          {t('common.tickets.createNew')}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
          {t('common.tickets.createDescription')}
        </p>

        <form onSubmit={handleSubmit} className="space-y-6 bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('common.tickets.title')}
            </label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              className="block w-full pl-3 pr-10 py-2 text-sm bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:text-white shadow-sm"
              required
            />
          </div>

          <div>
            <label htmlFor="organization_id" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('common.organizations.title')} <span className="text-red-500">*</span>
            </label>
            <select
              id="organization_id"
              name="organization_id"
              value={formData.organization_id || ''}
              onChange={handleChange}
              className="block w-full pl-3 pr-10 py-2 text-sm bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:text-white shadow-sm"
              required
            >
              <option value="">{t('common.organizations.selectOrganization')}</option>
              {organizations.map(org => (
                <option key={org.id} value={org.id}>{org.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="type" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('common.tickets.type')}
            </label>
            <select
              id="type"
              name="type"
              value={formData.type}
              onChange={handleChange}
              className="block w-full pl-3 pr-10 py-2 text-sm bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:text-white shadow-sm"
            >
              <option value="bug">{t('common.tickets.types.bug')}</option>
              <option value="feature">{t('common.tickets.types.feature')}</option>
              <option value="support">{t('common.tickets.types.support')}</option>
            </select>
          </div>

          <div>
            <label htmlFor="priority" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('common.tickets.priority')}
            </label>
            <select
              id="priority"
              name="priority"
              value={formData.priority}
              onChange={handleChange}
              className="block w-full pl-3 pr-10 py-2 text-sm bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:text-white shadow-sm"
            >
              <option value="low">{t('common.tickets.priority_options.low')}</option>
              <option value="medium">{t('common.tickets.priority_options.medium')}</option>
              <option value="high">{t('common.tickets.priority_options.high')}</option>
            </select>
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('common.tickets.description')}
            </label>
            <textarea
              id="description"
              name="description"
              rows={6}
              value={formData.description}
              onChange={handleChange}
              className="block w-full pl-3 pr-10 py-2 text-sm bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:text-white shadow-sm"
              required
            />
          </div>

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => navigate('/customer/tickets')}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? t('common.tickets.creating') : t('common.tickets.create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
} 