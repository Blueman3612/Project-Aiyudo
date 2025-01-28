import { Client } from 'langsmith'
import { generateTestQueries, evaluateResponse } from './queryGeneration'
import { searchDocuments } from '../pdfProcessing'

// Initialize LangSmith client with better error handling
let langsmith
try {
  const apiKey = import.meta.env.VITE_LANGSMITH_API_KEY
  if (!apiKey) {
    throw new Error('VITE_LANGSMITH_API_KEY is not set in environment variables')
  }
  langsmith = new Client({
    apiKey,
    projectName: "aiyudo-qa-testing"
  })
} catch (error) {
  console.error('Failed to initialize LangSmith client:', error)
}

/**
 * Creates a LangSmith run with proper error handling
 */
async function createLangSmithRun(config) {
  if (!langsmith) {
    console.warn('LangSmith client not initialized, skipping run tracking')
    return null
  }

  try {
    const run = await langsmith.createRun({
      ...config,
      start_time: new Date().toISOString()
    })
    return run
  } catch (error) {
    console.error('Failed to create LangSmith run:', error)
    return null
  }
}

/**
 * Updates a LangSmith run with proper error handling
 */
async function updateLangSmithRun(runId, data) {
  if (!langsmith || !runId) return

  try {
    await langsmith.updateRun(runId, {
      ...data,
      end_time: new Date().toISOString()
    })
  } catch (error) {
    console.error('Failed to update LangSmith run:', error)
  }
}

/**
 * Runs a test suite for the Q&A system
 * @param {string} organizationId - The organization ID that owns the document
 * @param {string} fileName - The name of the PDF file to test
 * @returns {Promise<{results: Array, summary: Object}>}
 */
export async function runTestSuite(organizationId, fileName) {
  try {
    // Start a new test run in LangSmith
    const run = await createLangSmithRun({
      name: `QA Test Suite - ${fileName}`,
      inputs: { organizationId, fileName },
      run_type: "chain"
    })

    // Generate test queries
    const testQueries = await generateTestQueries(organizationId, fileName)
    
    const results = []
    let totalScore = 0

    // Run each test query
    for (const test of testQueries) {
      try {
        // Log the test case in LangSmith
        const testRun = await createLangSmithRun({
          name: `Test Case - ${test.category}`,
          inputs: { query: test.query },
          run_type: "chain",
          parent_run_id: run?.id
        })

        // Get bot's response
        const documents = await searchDocuments(test.query, organizationId)
        const botResponse = documents.length > 0 
          ? documents[0].content 
          : "I couldn't find a relevant answer in the document."

        // Evaluate the response
        const evaluation = await evaluateResponse(
          test.query,
          botResponse,
          test.expectedAnswer
        )

        // Update test run with results
        await updateLangSmithRun(testRun?.id, {
          outputs: {
            botResponse,
            expectedAnswer: test.expectedAnswer,
            evaluation
          },
          scores: {
            accuracy: evaluation.score
          }
        })

        results.push({
          query: test.query,
          category: test.category,
          complexity: test.complexity,
          botResponse,
          expectedAnswer: test.expectedAnswer,
          score: evaluation.score,
          feedback: evaluation.feedback
        })

        totalScore += evaluation.score
      } catch (testError) {
        console.error('Error running test case:', testError)
        // Continue with next test even if one fails
      }
    }

    // Calculate summary statistics
    const summary = {
      totalTests: results.length,
      averageScore: results.length > 0 ? totalScore / results.length : 0,
      categoryBreakdown: results.reduce((acc, result) => {
        if (!acc[result.category]) {
          acc[result.category] = {
            count: 0,
            totalScore: 0
          }
        }
        acc[result.category].count++
        acc[result.category].totalScore += result.score
        return acc
      }, {}),
      complexityBreakdown: results.reduce((acc, result) => {
        if (!acc[result.complexity]) {
          acc[result.complexity] = {
            count: 0,
            totalScore: 0
          }
        }
        acc[result.complexity].count++
        acc[result.complexity].totalScore += result.score
        return acc
      }, {})
    }

    // Calculate averages for breakdowns
    Object.values(summary.categoryBreakdown).forEach(cat => {
      cat.averageScore = cat.totalScore / cat.count
    })
    Object.values(summary.complexityBreakdown).forEach(comp => {
      comp.averageScore = comp.totalScore / comp.count
    })

    // Update the main run with summary
    await updateLangSmithRun(run?.id, {
      outputs: { summary },
      scores: {
        overallAccuracy: summary.averageScore
      }
    })

    return { results, summary }
  } catch (error) {
    console.error('Error running test suite:', error)
    throw error
  }
} 