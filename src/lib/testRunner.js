import { runSearchTests, suggestOptimizations } from './testUtils.js'

export async function runOptimizationTests(organizationId) {
  console.log('Running search optimization tests...')
  
  const results = await runSearchTests(organizationId)
  
  console.log('\nTest Results:')
  console.log('-------------')
  console.log(`Total Tests: ${results.totalTests}`)
  console.log(`Passed Tests: ${results.passedTests}`)
  console.log(`Average Score: ${(results.averageScore * 100).toFixed(1)}%`)
  
  console.log('\nDetailed Results:')
  results.detailedResults.forEach(result => {
    console.log(`\nQuery: "${result.query}"`)
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
  
  const suggestions = suggestOptimizations(results)
  if (suggestions.length > 0) {
    console.log('\nOptimization Suggestions:')
    suggestions.forEach(suggestion => console.log(`- ${suggestion}`))
  }
  
  return results
} 