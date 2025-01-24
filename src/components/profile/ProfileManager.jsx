import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabaseClient'
import { useTranslation } from 'react-i18next'

export function ProfileManager() {
  const { t } = useTranslation()
  const { user, profile } = useAuth()
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState({
    full_name: profile?.full_name || '',
    organization: profile?.organization || '',
    prefix: profile?.prefix || ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      const { error } = await supabase
        .from('profiles')
        .update(formData)
        .eq('id', user.id)

      if (error) throw error

      setSuccess(true)
      setIsEditing(false)
      window.location.reload()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded">
          {error}
        </div>
      )}

      {success && (
        <div className="p-3 bg-green-50 border border-green-200 text-green-700 rounded">
          {t('common.profile.updateSuccess')}
        </div>
      )}

      {isEditing ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('common.profile.fullName')}
            </label>
            <input
              type="text"
              name="full_name"
              value={formData.full_name}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-blue-500 focus:border-blue-500 dark:focus:border-blue-500"
              placeholder={t('common.profile.enterFullName')}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('common.profile.organization')}
            </label>
            <input
              type="text"
              name="organization"
              value={formData.organization}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-blue-500 focus:border-blue-500 dark:focus:border-blue-500"
              placeholder={t('common.profile.enterOrganization')}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('common.profile.prefix')}
            </label>
            <select
              name="prefix"
              value={formData.prefix}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-blue-500 focus:border-blue-500 dark:focus:border-blue-500"
            >
              <option value="">{t('common.profile.selectPrefix')}</option>
              <option value="Mr.">{t('common.profile.prefixes.mr')}</option>
              <option value="Ms.">{t('common.profile.prefixes.ms')}</option>
              <option value="Mrs.">{t('common.profile.prefixes.mrs')}</option>
            </select>
          </div>

          <div className="flex space-x-3">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-900 disabled:opacity-50"
            >
              {loading ? t('common.saving') : t('common.profile.saveChanges')}
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="inline-flex justify-center items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-900"
            >
              {t('common.cancel')}
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">{t('common.profile.email')}</label>
            <div className="mt-1 text-gray-900 dark:text-gray-200">{profile?.email}</div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">{t('common.profile.fullName')}</label>
            <div className="mt-1 text-gray-900 dark:text-gray-200">{profile?.full_name || t('common.notSet')}</div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">{t('common.profile.organization')}</label>
            <div className="mt-1 text-gray-900 dark:text-gray-200">{profile?.organization || t('common.notSet')}</div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">{t('common.profile.prefix')}</label>
            <div className="mt-1 text-gray-900 dark:text-gray-200">{profile?.prefix || t('common.notSet')}</div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">{t('common.profile.role')}</label>
            <div className="mt-1 text-gray-900 dark:text-gray-200">{profile?.role}</div>
          </div>
          <div>
            <button
              onClick={() => setIsEditing(true)}
              className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-900"
            >
              {t('common.profile.editProfile')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
} 