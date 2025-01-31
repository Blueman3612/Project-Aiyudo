import { Client } from 'langsmith'
import { generateTestQueries } from './queryGeneration'
import { searchDocuments, evaluateResponse } from '../pdfProcessing'
import { supabase } from '../supabaseClient'
import { nanoid } from 'nanoid'

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
 * Runs a test suite against all PDFs in an organization
 * @param {string} organizationId - The organization ID to test
 * @returns {Promise<Object>} Test results
 */
export async function runTestSuite(organizationId) {
  try {
    // Get all PDF files for this organization
    const { data: files, error: filesError } = await supabase
      .from('organization_files')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('file_type', 'application/pdf')

    if (filesError) throw filesError
    if (!files.length) throw new Error('No PDF files found for this organization')

    // Create a LangSmith run for tracking
    const run = await createLangSmithRun({
      name: `Organization ${organizationId} Test Suite`,
      inputs: { organizationId }
    })

    // Generate and run tests for each file
    const allResults = []
    for (const file of files) {
      const queries = await generateTestQueries(organizationId, file.file_name)
      
      for (const query of queries) {
        // Search for answer in all organization documents
        const searchResults = await searchDocuments(query.query, organizationId)
        const botResponse = searchResults?.[0]?.content || 'No answer found'
        const expectedAnswer = searchResults?.[0]?.expectedAnswer || null
        
        // Evaluate the response
        const score = expectedAnswer ? evaluateResponse(botResponse, expectedAnswer) : 0
        
        allResults.push({
          ...query,
          botResponse,
          expectedAnswer,
          score,
          sourceFile: file.file_name
        })
      }
    }

    // Calculate summary statistics
    const totalTests = allResults.length
    const averageScore = allResults.reduce((sum, r) => sum + r.score, 0) / totalTests

    // Update LangSmith run with results
    if (run) {
      await updateLangSmithRun(run.id, {
        outputs: { results: allResults, summary: { totalTests, averageScore } },
        error: null
      })
    }

    return {
      results: allResults,
      summary: {
        totalTests,
        averageScore
      }
    }
  } catch (error) {
    console.error('Error running test suite:', error)
    throw error
  }
}

/**
 * Generates and runs a single test
 * @param {string} organizationId - The organization ID to test
 * @returns {Promise<Object>} Test result
 */
export async function runSingleTest(organizationId) {
  try {
    // Get all PDF files for this organization - add caching
    const cacheKey = `org_files_${organizationId}`
    let files = sessionStorage.getItem(cacheKey)
    
    if (!files) {
      const { data, error: filesError } = await supabase
        .from('organization_files')
        .select('id, file_name')  // Select only needed fields
        .eq('organization_id', organizationId)
        .eq('file_type', 'application/pdf')
        .eq('has_embeddings', true)  // Only get processed files

      if (filesError) throw filesError
      if (!data?.length) throw new Error('No PDF files found for this organization')
      
      files = data
      sessionStorage.setItem(cacheKey, JSON.stringify(data))
      setTimeout(() => sessionStorage.removeItem(cacheKey), 30 * 60 * 1000) // Cache for 30 minutes
    } else {
      files = JSON.parse(files)
    }

    // Randomly select a file
    const file = files[Math.floor(Math.random() * files.length)]
    const testId = nanoid()

    // First generate the test query
    const queries = await generateTestQueries(organizationId, file.file_name, 1)
    const query = queries[0]

    // Then search for documents with the generated query
    const searchResults = await searchDocuments(query.query, organizationId)
    const botResponse = searchResults?.[0]?.content || 'No answer found'
    const expectedAnswer = searchResults?.[0]?.expectedAnswer || null

    return {
      id: testId,
      ...query,
      botResponse,
      expectedAnswer,
      sourceFile: file.file_name
    }
  } catch (error) {
    console.error('Error running test:', error)
    throw error
  }
}

/**
 * Submits a grade for a test
 * @param {Object} gradeData - The grade data
 * @returns {Promise<void>}
 */
export async function submitGrade(gradeData) {
  try {
    // Validate required fields
    if (!gradeData.testId || typeof gradeData.grade !== 'number') {
      throw new Error('Missing required fields or invalid grade type for submission')
    }

    // Store the grade in Supabase
    const { error } = await supabase
      .from('test_grades')
      .insert({
        test_id: gradeData.testId,
        organization_id: gradeData.organizationId,
        query: gradeData.query,
        expected_answer: gradeData.expectedAnswer || null,
        bot_response: gradeData.botResponse,
        grade: parseFloat(gradeData.grade),
        graded_by: gradeData.gradedBy || null,
        graded_at: new Date().toISOString()
      })

    if (error) {
      console.error('Supabase error:', error)
      throw new Error(`Failed to submit grade: ${error.message}`)
    }

  } catch (error) {
    console.error('Error submitting grade:', error)
    throw error
  }
}