import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabaseClient'
import { runTestSuite } from '../../lib/testing/testRunner'
import { useTranslation } from 'react-i18next'

export function TestManager() {
  const { t } = useTranslation()
  const { profile } = useAuth()
  const [organizations, setOrganizations] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(null)
  const [documents, setDocuments] = useState([])
  const [selectedDoc, setSelectedDoc] = useState(null)
  const [isRunning, setIsRunning] = useState(false)
  const [results, setResults] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchOrganizations()
  }, [])

  useEffect(() => {
    if (selectedOrg) {
      fetchDocuments(selectedOrg)
    }
  }, [selectedOrg])

  const fetchOrganizations = async () => {
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .order('name')

      if (error) throw error
      setOrganizations(data)
    } catch (err) {
      console.error('Error fetching organizations:', err)
      setError('Failed to load organizations')
    }
  }

  const fetchDocuments = async (orgId) => {
    try {
      const { data, error } = await supabase
        .from('organization_files')
        .select('*')
        .eq('organization_id', orgId)
        .eq('file_type', 'application/pdf')
        .order('created_at', { ascending: false })

      if (error) throw error
      setDocuments(data)
    } catch (err) {
      console.error('Error fetching documents:', err)
      setError('Failed to load documents')
    }
  }

  const handleRunTests = async () => {
    if (!selectedOrg || !selectedDoc) return

    try {
      setIsRunning(true)
      setError(null)
      setResults(null)

      const results = await runTestSuite(selectedOrg, selectedDoc.file_name)
      setResults(results)
    } catch (err) {
      console.error('Error running tests:', err)
      setError('Failed to run test suite')
    } finally {
      setIsRunning(false)
    }
  }

  const formatScore = (score) => `${(score * 100).toFixed(1)}%`

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        {t('testing.title', 'Q&A Testing')}
      </h2>

      {error && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      <div className="space-y-6">
        {/* Organization Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('testing.selectOrganization', 'Select Organization')}
          </label>
          <select
            value={selectedOrg || ''}
            onChange={(e) => setSelectedOrg(e.target.value)}
            className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md dark:bg-gray-700 dark:text-white"
          >
            <option value="">{t('testing.selectOrganization', 'Select Organization')}</option>
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>{org.name}</option>
            ))}
          </select>
        </div>

        {/* Document Selection */}
        {selectedOrg && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('testing.selectDocument', 'Select Document')}
            </label>
            <select
              value={selectedDoc?.id || ''}
              onChange={(e) => setSelectedDoc(documents.find(d => d.id === e.target.value))}
              className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md dark:bg-gray-700 dark:text-white"
            >
              <option value="">{t('testing.selectDocument', 'Select Document')}</option>
              {documents.map((doc) => (
                <option key={doc.id} value={doc.id}>{doc.file_name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Run Tests Button */}
        <div>
          <button
            onClick={handleRunTests}
            disabled={!selectedOrg || !selectedDoc || isRunning}
            className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRunning ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                {t('testing.running', 'Running Tests...')}
              </>
            ) : (
              t('testing.runTests', 'Run Tests')
            )}
          </button>
        </div>

        {/* Results */}
        {results && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                {t('testing.summary', 'Test Summary')}
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {t('testing.totalTests', 'Total Tests')}
                  </p>
                  <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                    {results.summary.totalTests}
                  </p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {t('testing.averageScore', 'Average Score')}
                  </p>
                  <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                    {formatScore(results.summary.averageScore)}
                  </p>
                </div>
              </div>

              {/* Category Breakdown */}
              <div className="mb-6">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('testing.categoryBreakdown', 'Category Breakdown')}
                </h4>
                <div className="space-y-2">
                  {Object.entries(results.summary.categoryBreakdown).map(([category, data]) => (
                    <div key={category} className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">{category}</span>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {formatScore(data.averageScore)} ({data.count} tests)
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Complexity Breakdown */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('testing.complexityBreakdown', 'Complexity Breakdown')}
                </h4>
                <div className="space-y-2">
                  {Object.entries(results.summary.complexityBreakdown).map(([complexity, data]) => (
                    <div key={complexity} className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">{complexity}</span>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {formatScore(data.averageScore)} ({data.count} tests)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Detailed Results */}
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                {t('testing.detailedResults', 'Detailed Results')}
              </h3>
              
              <div className="space-y-6">
                {results.results.map((result, index) => (
                  <div key={index} className="border-b border-gray-200 dark:border-gray-700 pb-4 last:border-0">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {result.category}
                        </span>
                        <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                          ({result.complexity})
                        </span>
                      </div>
                      <span className={`text-sm font-medium ${
                        result.score >= 0.8 ? 'text-green-600 dark:text-green-400' :
                        result.score >= 0.6 ? 'text-yellow-600 dark:text-yellow-400' :
                        'text-red-600 dark:text-red-400'
                      }`}>
                        {formatScore(result.score)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-900 dark:text-white mb-2">
                      Q: {result.query}
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                          {t('testing.expectedAnswer', 'Expected Answer')}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          {result.expectedAnswer}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                          {t('testing.botResponse', 'Bot Response')}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          {result.botResponse}
                        </p>
                      </div>
                    </div>
                    {result.feedback && (
                      <div className="mt-2">
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                          {t('testing.feedback', 'Feedback')}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          {result.feedback}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* LangSmith Link */}
            <div className="text-center">
              <a
                href="https://smith.langchain.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-sm text-blue-600 dark:text-blue-400 hover:text-blue-500"
              >
                {t('testing.viewInLangSmith', 'View Detailed Results in LangSmith')}
                <svg className="ml-1 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  )
} 