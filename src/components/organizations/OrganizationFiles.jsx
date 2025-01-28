import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabaseClient'
import { useTranslation } from 'react-i18next'
import { processPDFDocument } from '../../lib/pdfProcessing'

export function OrganizationFiles({ organizationId }) {
  const { t } = useTranslation()
  const { profile } = useAuth()
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const [description, setDescription] = useState('')
  const [isExpanded, setIsExpanded] = useState(false)
  const [deletingFile, setDeletingFile] = useState(null)
  const fileInputRef = useRef(null)

  const isAdmin = profile?.role === 'admin'

  useEffect(() => {
    fetchFiles()
  }, [organizationId])

  const fetchFiles = async () => {
    try {
      setLoading(true)
      setError(null)

      const { data, error } = await supabase
        .from('organization_files')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setFiles(data)
    } catch (error) {
      console.error('Error fetching files:', error)
      setError('Failed to load files')
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      setUploading(true)
      setError(null)

      // Generate a unique file path
      const filePath = `organizations/${organizationId}/${Date.now()}-${file.name}`
      
      // Upload file to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('organization-files')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      // If it's a PDF, process it for embeddings
      if (file.type === 'application/pdf') {
        console.log('Processing PDF in OrganizationFiles:', {
          fileName: file.name,
          organizationId,
          filePath
        })
        const { success, error: pdfError } = await processPDFDocument(file, organizationId, filePath)
        if (pdfError) {
          console.error('Error processing PDF:', pdfError)
          // Don't throw the error - we still want to keep the file even if embedding fails
          setError('Failed to process PDF for embeddings')
        }
      } else {
        // Create file record in the database
        const { error: dbError } = await supabase
          .from('organization_files')
          .insert({
            organization_id: organizationId,
            file_name: file.name,
            file_type: file.type || 'application/octet-stream',
            file_size: file.size,
            storage_path: filePath,
            description: description.trim() || null,
            has_embeddings: false
          })

        if (dbError) throw dbError
      }

      // Reset form
      setDescription('')
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }

      // Refresh files list
      fetchFiles()
    } catch (error) {
      console.error('Error uploading file:', error)
      setError('Failed to upload file')
    } finally {
      setUploading(false)
    }
  }

  const downloadFile = async (path, fileName) => {
    try {
      const { data, error } = await supabase.storage
        .from('organization-files')
        .download(path)

      if (error) throw error

      // Create download link
      const url = URL.createObjectURL(data)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error downloading file:', error)
      setError('Failed to download file')
    }
  }

  const deleteFile = async (fileId, storagePath) => {
    try {
      setError(null)

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('organization-files')
        .remove([storagePath])

      if (storageError) throw storageError

      // Delete from database
      const { error: dbError } = await supabase
        .from('organization_files')
        .delete()
        .eq('id', fileId)

      if (dbError) throw dbError

      // Refresh files list
      fetchFiles()
      setDeletingFile(null)
    } catch (error) {
      console.error('Error deleting file:', error)
      setError('Failed to delete file')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4 text-gray-500 dark:text-gray-400">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mr-3"></div>
        {t('common.organizations.files.loading')}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center justify-between w-full p-6 text-left bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 border-b border-gray-200 dark:border-gray-700"
        >
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('common.organizations.files.title')}</h3>
          <svg 
            className={`w-5 h-5 text-gray-500 transition-transform ${isExpanded ? 'transform rotate-180' : ''}`}
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {isExpanded && (
        <>
          {isAdmin && (
            <div className="px-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('common.organizations.files.description')}
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="block w-full pl-3 pr-10 py-2 text-sm bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:text-white shadow-sm"
                  placeholder={t('common.organizations.files.descriptionPlaceholder')}
                />
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3">
                  <div className="relative inline-block">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      disabled={uploading}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                      aria-label={t('common.organizations.chooseFile')}
                    />
                    <div className="py-2 px-4 text-sm font-medium bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg disabled:opacity-50 cursor-pointer">
                      {t('common.organizations.chooseFile')}
                    </div>
                  </div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {fileInputRef.current?.files?.[0]?.name || t('common.organizations.noFileChosen')}
                  </span>
                </div>
                {uploading && (
                  <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                    <svg className="animate-spin h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    {t('common.organizations.files.uploading')}
                  </div>
                )}
              </div>
            </div>
          )}

          {error && (
            <div className="px-6">
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400">{t(`common.organizations.files.errors.${error}`)}</p>
              </div>
            </div>
          )}

          <div className="px-6">
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {files.length === 0 ? (
                <p className="py-4 text-sm text-gray-500 dark:text-gray-400">
                  {t('common.organizations.files.noFiles')}
                </p>
              ) : (
                files.map((file) => (
                  <div key={file.id} className="py-4 flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {file.file_name}
                      </h4>
                      {file.description && (
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                          {file.description}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {t('common.organizations.files.uploadedOn', {
                          date: new Date(file.created_at).toLocaleDateString()
                        })}
                        {' • '}
                        {(file.file_size / 1024 / 1024).toFixed(2)} {t('common.organizations.files.megabytes')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => downloadFile(file.storage_path, file.file_name)}
                        className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-md"
                        title="Download"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                      </button>
                      {isAdmin && (
                        <button
                          onClick={() => setDeletingFile(file)}
                          className="p-2 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-200 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30 rounded-md"
                          title={t('common.delete')}
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {/* Delete Confirmation Modal */}
      {deletingFile && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {t('common.organizations.files.deleteTitle')}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {t('common.organizations.files.deleteConfirmation', { name: deletingFile.file_name })}
            </p>
            <div className="flex justify-end gap-4">
              <button
                onClick={() => setDeletingFile(null)}
                className="px-4 py-2 text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={() => deleteFile(deletingFile.id, deletingFile.storage_path)}
                className="px-4 py-2 text-white bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 rounded-lg"
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