import { runSearchTests, suggestOptimizations } from './testUtils.js'
import { getStaticTestCases } from './testing/queryGeneration.js'

export async function runOptimizationTests(organizationId) {
  console.log('Running search optimization tests...')
  
  // Use static test cases
  const testCases = getStaticTestCases()
  const results = await runSearchTests(organizationId, testCases)
  
  // Calculate category-wise performance
  const categoryResults = {}
  results.detailedResults.forEach(result => {
    if (!categoryResults[result.category]) {
      categoryResults[result.category] = {
        total: 0,
        passed: 0,
        avgScore: 0
      }
    }
    categoryResults[result.category].total++
    if (result.passed) categoryResults[result.category].passed++
    categoryResults[result.category].avgScore += result.metrics.overallScore
  })

  // Calculate averages for each category
  Object.keys(categoryResults).forEach(category => {
    categoryResults[category].avgScore /= categoryResults[category].total
  })

  // Add category results to the output
  const enrichedResults = {
    ...results,
    categoryResults,
    complexityBreakdown: {
      simple: results.detailedResults.filter(r => r.complexity === 'simple').length,
      medium: results.detailedResults.filter(r => r.complexity === 'medium').length,
      complex: results.detailedResults.filter(r => r.complexity === 'complex').length
    }
  }
  
  console.log('\nTest Results:')
  console.log('-------------')
  console.log(`Total Tests: ${results.totalTests}`)
  console.log(`Passed Tests: ${results.passedTests}`)
  console.log(`Average Score: ${(results.averageScore * 100).toFixed(1)}%`)
  
  console.log('\nCategory Breakdown:')
  Object.entries(categoryResults).forEach(([category, stats]) => {
    console.log(`\n${category}:`)
    console.log(`- Tests: ${stats.total}`)
    console.log(`- Passed: ${stats.passed}`)
    console.log(`- Average Score: ${(stats.avgScore * 100).toFixed(1)}%`)
  })
  
  console.log('\nDetailed Results:')
  results.detailedResults.forEach(result => {
    console.log(`\nQuery: "${result.query}"`)
    console.log(`Category: ${result.category} (${result.complexity})`)
    console.log(`Expected: "${result.expectedAnswer}"`)
    console.log(`Actual: "${result.actualResponse}"`)
    console.log('Metrics:', {
      similarity: result.metrics.stringSimilarity.toFixed(2),
      lengthRatio: result.metrics.lengthRatio.toFixed(2),
      keywordMatch: result.metrics.keywordMatch.toFixed(2),
      overallScore: result.metrics.overallScore.toFixed(2)
    })
    console.log(`Status: ${result.passed ? 'PASSED' : 'FAILED'}`)
  })
  
  const suggestions = suggestOptimizations(enrichedResults)
  if (suggestions.length > 0) {
    console.log('\nOptimization Suggestions:')
    suggestions.forEach(suggestion => console.log(`- ${suggestion}`))
  }
  
  return enrichedResults
} 