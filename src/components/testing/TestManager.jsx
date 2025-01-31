import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabaseClient'
import { runSingleTest, submitGrade } from '../../lib/testing/testRunner'
import { searchDocuments } from '../../lib/pdfProcessing'
import { useTranslation } from 'react-i18next'
import { nanoid } from 'nanoid'

export function TestManager() {
  const { t } = useTranslation()
  const { profile } = useAuth()
  const [organizations, setOrganizations] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(null)
  const [isRunning, setIsRunning] = useState(false)
  const [currentTest, setCurrentTest] = useState(null)
  const [error, setError] = useState(null)
  const [generationTime, setGenerationTime] = useState(null)
  const [stats, setStats] = useState({
    totalGraded: 0,
    averageScore: 0
  })
  const [manualQuestion, setManualQuestion] = useState('')
  const [isAskingQuestion, setIsAskingQuestion] = useState(false)

  useEffect(() => {
    fetchOrganizations()
    fetchStats()
  }, [])

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

  const fetchStats = async () => {
    try {
      const { data, error } = await supabase
        .from('test_grades')
        .select('grade')
        .eq('graded_by', profile.id)

      if (error) throw error

      if (data && data.length > 0) {
        const avgGrade = data.reduce((sum, item) => sum + item.grade, 0) / data.length
        setStats({
          totalGraded: data.length,
          averageScore: avgGrade
        })
      }
    } catch (err) {
      console.error('Error fetching stats:', err)
    }
  }

  const handleGenerateTest = async () => {
    if (!selectedOrg) return

    try {
      setIsRunning(true)
      setError(null)
      const startTime = performance.now()

      const result = await runSingleTest(selectedOrg)
      
      const endTime = performance.now()
      setGenerationTime((endTime - startTime) / 1000) // Convert to seconds
      setCurrentTest(result)
    } catch (err) {
      console.error('Error generating test:', err)
      setError('Failed to generate test')
    } finally {
      setIsRunning(false)
    }
  }

  const handleGrade = async (grade) => {
    if (!currentTest) return

    try {
      await submitGrade({
        testId: currentTest.id,
        organizationId: selectedOrg,
        query: currentTest.query,
        expectedAnswer: currentTest.expectedAnswer,
        botResponse: currentTest.botResponse,
        score: currentTest.score,
        grade,
        gradedBy: profile.id
      })

      // Update stats
      setStats(prev => ({
        totalGraded: prev.totalGraded + 1,
        averageScore: (prev.averageScore * prev.totalGraded + grade) / (prev.totalGraded + 1)
      }))

      // Clear current test and generate a new one
      setCurrentTest(null)
      handleGenerateTest()
    } catch (err) {
      console.error('Error submitting grade:', err)
      setError('Failed to submit grade')
    }
  }

  const handleManualQuestion = async (e) => {
    e.preventDefault()
    if (!selectedOrg || !manualQuestion.trim() || isAskingQuestion) return

    try {
      setIsAskingQuestion(true)
      setError(null)
      const startTime = performance.now()

      // Search for documents with the user's question
      const searchResults = await searchDocuments(manualQuestion, selectedOrg)
      const botResponse = searchResults?.[0]?.content || 'No answer found'

      const endTime = performance.now()
      setGenerationTime((endTime - startTime) / 1000)

      // Create a test object similar to generated tests
      setCurrentTest({
        id: nanoid(),
        query: manualQuestion,
        botResponse,
        expectedAnswer: null,
        isManual: true
      })

      setManualQuestion('') // Clear the input
    } catch (err) {
      console.error('Error processing manual question:', err)
      setError('Failed to process question')
    } finally {
      setIsAskingQuestion(false)
    }
  }

  const formatScore = (score) => `${(score * 100).toFixed(1)}%`

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        Bot Response Testing
      </h2>

      {/* Stats Display */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Tests Graded</p>
          <p className="text-2xl font-semibold text-gray-900 dark:text-white">{stats.totalGraded}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Average Score</p>
          <p className="text-2xl font-semibold text-gray-900 dark:text-white">{formatScore(stats.averageScore)}</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      <div className="space-y-6">
        {/* Organization Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Select Organization to Test
          </label>
          <select
            value={selectedOrg || ''}
            onChange={(e) => setSelectedOrg(e.target.value)}
            className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md dark:bg-gray-700 dark:text-white"
          >
            <option value="">Select an organization</option>
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>{org.name}</option>
            ))}
          </select>
        </div>

        {/* Manual Question Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Ask a Custom Question
          </label>
          <form onSubmit={handleManualQuestion} className="flex gap-2">
            <input
              type="text"
              value={manualQuestion}
              onChange={(e) => setManualQuestion(e.target.value)}
              placeholder="Type your question here..."
              disabled={!selectedOrg || isAskingQuestion}
              className="flex-1 pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md dark:bg-gray-700 dark:text-white"
            />
            <button
              type="submit"
              disabled={!selectedOrg || !manualQuestion.trim() || isAskingQuestion}
              className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isAskingQuestion ? 'Getting Answer...' : 'Ask Question'}
            </button>
          </form>
        </div>

        {/* Generate Test Button */}
        <div>
          <button
            onClick={handleGenerateTest}
            disabled={!selectedOrg || isRunning}
            className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRunning ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Generating Test...
              </>
            ) : (
              currentTest ? 'Generate Next Test' : 'Generate Test'
            )}
          </button>
          {generationTime && (
            <span className="ml-3 text-sm text-gray-500">
              Generated in {generationTime.toFixed(1)}s
            </span>
          )}
        </div>

        {/* Current Test */}
        {currentTest && (
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Question:</p>
                <p className="text-sm text-gray-900 dark:text-white">{currentTest.query}</p>
              </div>
              
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Bot's Response:</p>
                <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">
                  {currentTest.botResponse}
                </p>
              </div>

              <div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleGrade(1.0)}
                    className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                  >
                    Perfect
                  </button>
                  <button
                    onClick={() => handleGrade(0.8)}
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                  >
                    Good
                  </button>
                  <button
                    onClick={() => handleGrade(0.5)}
                    className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
                  >
                    Fair
                  </button>
                  <button
                    onClick={() => handleGrade(0.2)}
                    className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600"
                  >
                    Poor
                  </button>
                  <button
                    onClick={() => handleGrade(0)}
                    className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                  >
                    Incorrect
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
} 