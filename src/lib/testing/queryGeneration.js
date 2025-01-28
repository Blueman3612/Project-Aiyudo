import { OpenAI } from 'openai'
import { supabase } from '../supabaseClient'

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
})

/**
 * Generates test queries based on the content of a PDF document
 * @param {string} organizationId - The organization ID that owns the document
 * @param {string} fileName - The name of the PDF file to generate queries for
 * @returns {Promise<Array<{query: string, expectedAnswer: string, category: string}>>}
 */
export async function generateTestQueries(organizationId, fileName) {
  try {
    // First, get all document chunks for this file
    const { data: chunks, error } = await supabase
      .from('document_embeddings')
      .select('content, metadata')
      .eq('organization_id', organizationId)
      .eq('file_name', fileName)
      .order('metadata->chunk_index')

    if (error) throw error

    // Combine all chunks into a single document
    const fullDocument = chunks
      .sort((a, b) => a.metadata.chunk_index - b.metadata.chunk_index)
      .map(chunk => chunk.content)
      .join('\n\n')

    // Generate test queries using GPT-4
    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        {
          role: "system",
          content: `You are a test query generator for a document Q&A system. Generate test queries in valid JSON format.

Instructions:
1. Generate realistic and natural customer queries
2. Include both simple factual queries and complex questions
3. Vary the complexity and scope
4. Include edge cases and potential misunderstandings
5. Categorize each query appropriately

Your response must be a valid JSON object in this exact format:
{
  "queries": [
    {
      "query": "What is the refund policy?",
      "expectedAnswer": "According to the document, refunds are processed within 14 days.",
      "category": "Policy",
      "complexity": "simple"
    }
  ]
}`
        },
        {
          role: "user",
          content: `Generate 5 test queries based on this document and return them in JSON format:\n\n${fullDocument}`
        }
      ],
      response_format: { type: "json_object" }
    })

    try {
      const parsedResponse = JSON.parse(response.choices[0].message.content)
      if (!parsedResponse.queries || !Array.isArray(parsedResponse.queries)) {
        console.error('Invalid response format:', parsedResponse)
        throw new Error('Invalid response format from OpenAI')
      }
      return parsedResponse.queries
    } catch (parseError) {
      console.error('Error parsing OpenAI response:', parseError)
      console.error('Raw response:', response.choices[0].message.content)
      throw new Error('Failed to parse test queries response')
    }
  } catch (error) {
    console.error('Error generating test queries:', error)
    throw error
  }
}

/**
 * Evaluates a bot's response against the expected answer
 * @param {string} query - The test query
 * @param {string} botResponse - The bot's response
 * @param {string} expectedAnswer - The expected answer
 * @returns {Promise<{score: number, feedback: string}>}
 */
export async function evaluateResponse(query, botResponse, expectedAnswer) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        {
          role: "system",
          content: `You are an expert evaluator for a document Q&A system. Evaluate responses in valid JSON format.

Evaluation criteria:
1. Factual accuracy
2. Completeness
3. Relevance
4. Clarity

Your response must be a valid JSON object in this exact format:
{
  "score": 0.85,
  "feedback": "Detailed explanation of the evaluation"
}`
        },
        {
          role: "user",
          content: `Evaluate this Q&A pair and return a JSON response:

QUERY: ${query}
EXPECTED: ${expectedAnswer}
RESPONSE: ${botResponse}`
        }
      ],
      response_format: { type: "json_object" }
    })

    try {
      const parsedResponse = JSON.parse(response.choices[0].message.content)
      if (typeof parsedResponse.score !== 'number' || typeof parsedResponse.feedback !== 'string') {
        console.error('Invalid evaluation format:', parsedResponse)
        throw new Error('Invalid evaluation format from OpenAI')
      }
      return parsedResponse
    } catch (parseError) {
      console.error('Error parsing evaluation response:', parseError)
      console.error('Raw response:', response.choices[0].message.content)
      throw new Error('Failed to parse evaluation response')
    }
  } catch (error) {
    console.error('Error evaluating response:', error)
    throw error
  }
} 