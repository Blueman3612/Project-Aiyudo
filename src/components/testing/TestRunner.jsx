import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { runOptimizationTests } from '../../lib/testRunner.js'

export default function TestRunner() {
  const { profile } = useAuth()
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [selectedCategory, setSelectedCategory] = useState('all')

  async function runTests() {
    setLoading(true)
    setError(null)
    try {
      const testResults = await runOptimizationTests(profile?.organization_id)
      setResults(testResults)
      setSelectedCategory('all')
    } catch (err) {
      setError(err.message)
      console.error('Test error:', err)
    } finally {
      setLoading(false)
    }
  }

  // Filter results based on selected category
  const filteredResults = results?.detailedResults.filter(result => 
    selectedCategory === 'all' || result.category === selectedCategory
  ) || []

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Search Response Testing</h1>
        <button
          onClick={runTests}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Running Tests...' : 'Run Tests'}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-100 text-red-700 rounded">
          Error: {error}
        </div>
      )}

      {results && (
        <div className="space-y-6">
          {/* Overall Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-gray-100 rounded">
              <h3 className="font-semibold">Total Tests</h3>
              <p className="text-2xl">{results.totalTests}</p>
            </div>
            <div className="p-4 bg-gray-100 rounded">
              <h3 className="font-semibold">Passed Tests</h3>
              <p className="text-2xl">{results.passedTests}</p>
            </div>
            <div className="p-4 bg-gray-100 rounded">
              <h3 className="font-semibold">Average Score</h3>
              <p className="text-2xl">{(results.averageScore * 100).toFixed(1)}%</p>
            </div>
          </div>

          {/* Complexity Breakdown */}
          <div className="bg-white p-4 rounded shadow-sm">
            <h2 className="text-lg font-semibold mb-3">Complexity Breakdown</h2>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <h4 className="text-sm text-gray-600">Simple</h4>
                <p className="text-xl">{results.complexityBreakdown.simple}</p>
              </div>
              <div>
                <h4 className="text-sm text-gray-600">Medium</h4>
                <p className="text-xl">{results.complexityBreakdown.medium}</p>
              </div>
              <div>
                <h4 className="text-sm text-gray-600">Complex</h4>
                <p className="text-xl">{results.complexityBreakdown.complex}</p>
              </div>
            </div>
          </div>

          {/* Category Results */}
          <div className="bg-white p-4 rounded shadow-sm">
            <h2 className="text-lg font-semibold mb-3">Category Performance</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(results.categoryResults).map(([category, stats]) => (
                <div key={category} className="p-3 bg-gray-50 rounded">
                  <h3 className="font-medium">{category}</h3>
                  <div className="text-sm">
                    <p>Tests: {stats.total}</p>
                    <p>Passed: {stats.passed}</p>
                    <p>Score: {(stats.avgScore * 100).toFixed(1)}%</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Category Filter */}
          <div className="flex items-center space-x-4">
            <label className="text-sm font-medium">Filter by Category:</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="border rounded px-2 py-1"
            >
              <option value="all">All Categories</option>
              {Object.keys(results.categoryResults).map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>

          {/* Detailed Results */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Detailed Results ({filteredResults.length} tests)</h2>
            {filteredResults.map((result, index) => (
              <div key={index} className="p-4 bg-white border rounded shadow-sm">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-semibold">Query: {result.query}</h3>
                    <p className="text-sm text-gray-600">
                      Category: {result.category} | Complexity: {result.complexity}
                    </p>
                  </div>
                  <span className={`px-2 py-1 rounded text-sm ${
                    result.passed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {result.passed ? 'PASSED' : 'FAILED'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-2">
                  <div>
                    <p className="text-sm text-gray-600">Expected Answer:</p>
                    <p className="mt-1">{result.expectedAnswer}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Actual Response:</p>
                    <p className="mt-1">{result.actualResponse}</p>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2 text-sm">
                  <div>
                    <span className="text-gray-600">Similarity:</span>
                    <span className="ml-1">{result.metrics.stringSimilarity.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Length Ratio:</span>
                    <span className="ml-1">{result.metrics.lengthRatio.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Keyword Match:</span>
                    <span className="ml-1">{result.metrics.keywordMatch.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Overall Score:</span>
                    <span className="ml-1">{result.metrics.overallScore.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
} 