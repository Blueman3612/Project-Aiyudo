import { searchDocuments } from './pdfProcessing.js'

const TEST_CASES = [
  {
    query: "What are the requirements for pizza dough fermentation?",
    expectedAnswer: "The pizza dough must undergo a minimum 24-hour fermentation process.",
    category: "Product Standards",
    complexity: "simple"
  },
  {
    query: "What cheese is mandatory for the Detroit-style pizza at Pizza Squared?",
    expectedAnswer: "Wisconsin brick cheese blend is mandatory for the Detroit-style pizza.",
    category: "Product Standards",
    complexity: "simple"
  },
  {
    query: "How does Pizza Squared handle late delivery orders?",
    expectedAnswer: "For late delivery orders, Pizza Squared apologizes sincerely, offers an immediate status update, provides complimentary breadsticks, offers a 20% discount for delays over 15 minutes, and a free meal for delays over 30 minutes.",
    category: "Customer Service",
    complexity: "complex"
  }
]

/**
 * Calculates string similarity using Levenshtein distance
 */
function calculateStringSimilarity(str1, str2) {
  const longer = str1.length > str2.length ? str1 : str2
  const shorter = str1.length > str2.length ? str2 : str1
  const longerLength = longer.length
  if (longerLength === 0) return 1.0

  const costs = Array.from({ length: shorter.length + 1 }, (_, i) => i)
  for (let i = 0; i < longer.length; i++) {
    let lastValue = i + 1
    for (let j = 0; j < shorter.length; j++) {
      if (i === 0) costs[j] = j + 1
      else {
        if (j > 0) {
          let newValue = costs[j - 1]
          if (longer[i - 1] !== shorter[j - 1])
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1
          costs[j - 1] = lastValue
          lastValue = newValue
        }
      }
    }
    if (i > 0) costs[shorter.length - 1] = lastValue
  }
  return (longerLength - costs[shorter.length - 1]) / longerLength
}

/**
 * Evaluates response quality metrics
 */
function evaluateResponse(response, expectedAnswer) {
  const content = response.content.toLowerCase()
  const expected = expectedAnswer.toLowerCase()

  // Calculate various metrics
  const stringSimilarity = calculateStringSimilarity(content, expected)
  const lengthRatio = Math.min(content.length, expected.length) / Math.max(content.length, expected.length)
  const keywordMatch = expected.split(' ').filter(word => content.includes(word.toLowerCase())).length / expected.split(' ').length

  return {
    stringSimilarity,
    lengthRatio,
    keywordMatch,
    overallScore: (stringSimilarity * 0.4 + lengthRatio * 0.3 + keywordMatch * 0.3)
  }
}

/**
 * Runs test cases and returns detailed metrics
 */
export async function runSearchTests(organizationId) {
  const results = []
  
  for (const testCase of TEST_CASES) {
    const response = await searchDocuments(testCase.query, organizationId)
    const metrics = evaluateResponse(response[0], testCase.expectedAnswer)
    
    results.push({
      query: testCase.query,
      category: testCase.category,
      complexity: testCase.complexity,
      expectedAnswer: testCase.expectedAnswer,
      actualResponse: response[0].content,
      metrics,
      passed: metrics.overallScore > 0.7
    })
  }

  // Calculate aggregate metrics
  const aggregateResults = {
    totalTests: results.length,
    passedTests: results.filter(r => r.passed).length,
    averageScore: results.reduce((sum, r) => sum + r.metrics.overallScore, 0) / results.length,
    categoryBreakdown: {},
    complexityBreakdown: {},
    detailedResults: results
  }

  return aggregateResults
}

/**
 * Suggests parameter adjustments based on test results
 */
export function suggestOptimizations(testResults) {
  const suggestions = []
  
  if (testResults.averageScore < 0.5) {
    suggestions.push("Consider lowering similarity threshold")
  }
  
  const verboseResponses = testResults.detailedResults.filter(r => 
    r.metrics.lengthRatio < 0.5 && r.actualResponse.length > r.expectedAnswer.length
  )
  if (verboseResponses.length > 0) {
    suggestions.push("Responses are too verbose. Consider stricter sentence filtering")
  }

  const lowKeywordMatch = testResults.detailedResults.filter(r => r.metrics.keywordMatch < 0.6)
  if (lowKeywordMatch.length > 0) {
    suggestions.push("Poor keyword matching. Consider adjusting relevance scoring")
  }

  return suggestions
} 