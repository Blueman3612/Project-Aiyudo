import { supabase } from './supabaseClient'
import { OpenAI } from 'openai'

// Configure PDF.js worker
import { getDocument } from 'pdfjs-dist'
import { GlobalWorkerOptions } from 'pdfjs-dist/build/pdf.mjs'
GlobalWorkerOptions.workerSrc = '/node_modules/pdfjs-dist/build/pdf.worker.mjs'

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
})

/**
 * Extracts text from a PDF file and generates embeddings for semantic search
 * @param {File} file - The PDF file to process
 * @param {string} organizationId - The ID of the organization this document belongs to
 * @param {string} filePath - The path where the file was uploaded
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function processPDFDocument(file, organizationId, filePath) {
  try {
    console.log('Starting PDF processing with:', {
      fileName: file?.name,
      fileType: file?.type,
      fileSize: file?.size,
      organizationId,
      filePath
    })

    // Validate inputs
    if (!file) {
      console.error('File is missing')
      return { success: false, error: 'File is required' }
    }
    if (!organizationId) {
      console.error('Organization ID is missing')
      return { success: false, error: 'Organization ID is required' }
    }
    if (!filePath) {
      console.error('File path is missing')
      return { success: false, error: 'File path is required' }
    }

    // Validate file type
    if (!file.type || file.type !== 'application/pdf') {
      console.error('Invalid file type:', file.type)
      return {
        success: false,
        error: 'Invalid file type. Only PDF files are supported.'
      }
    }

    console.log('Starting PDF text extraction')

    // Split text into more meaningful chunks
    function splitIntoChunks(text, maxChunkSize = 1000) {
      // First, split by paragraphs
      const paragraphs = text.split(/\n\s*\n/)
      const chunks = []
      let currentChunk = ''
      let chunkIndex = 0

      for (const paragraph of paragraphs) {
        // If adding this paragraph would exceed maxChunkSize, save current chunk and start new one
        if ((currentChunk + paragraph).length > maxChunkSize && currentChunk.length > 0) {
          // Only add non-empty chunks
          if (currentChunk.trim()) {
            chunks.push(currentChunk.trim())
          }
          currentChunk = paragraph
          chunkIndex++
        } else {
          // Add paragraph to current chunk
          currentChunk = currentChunk ? `${currentChunk}\n\n${paragraph}` : paragraph
        }
      }

      // Add the last chunk if it's not empty
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim())
      }

      // Add metadata to each chunk
      return chunks.map((chunk, index) => ({
        text: chunk,
        metadata: {
          chunk_index: index + 1,
          total_chunks: chunks.length
        }
      }))
    }

    // Get the PDF text content using pdf.js
    const arrayBuffer = await file.arrayBuffer()
    const pdf = await getDocument({ data: arrayBuffer }).promise
    let text = ''
    
    // Extract text from each page
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const content = await page.getTextContent()
      const pageText = content.items.map(item => item.str).join(' ')
      text += pageText + '\n\n' // Add paragraph breaks between pages
    }

    // Create organization_files record first
    const { error: fileError } = await supabase
      .from('organization_files')
      .insert({
        organization_id: organizationId,
        storage_path: filePath,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        has_embeddings: false
      })

    if (fileError) {
      console.error('Error creating file record:', fileError)
      throw fileError
    }

    // Split text into chunks with metadata
    const chunks = splitIntoChunks(text)

    // Generate embeddings for each chunk
    const embeddings = await Promise.all(
      chunks.map(async (chunk) => {
        const response = await openai.embeddings.create({
          model: "text-embedding-3-small",
          input: chunk.text,
          encoding_format: "float"
        })
        return {
          content: chunk.text,
          embedding: response.data[0].embedding,
          metadata: {
            ...chunk.metadata,
            pageCount: pdf.numPages,
            document_name: file.name,
            total_chunks: chunks.length
          },
          file_name: file.name,
          file_path: filePath
        }
      })
    )

    // Store embeddings in Supabase
    const { error: insertError } = await supabase
      .from('document_embeddings')
      .insert(
        embeddings.map(emb => ({
          content: emb.content,
          embedding: emb.embedding,
          metadata: emb.metadata,
          organization_id: organizationId,
          file_name: emb.file_name,
          file_path: emb.file_path
        }))
      )

    if (insertError) {
      console.error('Error inserting embeddings:', insertError)
      throw insertError
    }

    // Update organization_files record to mark as processed
    const { error: updateError } = await supabase
      .from('organization_files')
      .update({ has_embeddings: true })
      .eq('storage_path', filePath)

    if (updateError) {
      console.error('Error updating file record:', updateError)
      throw updateError
    }

    return { success: true }
  } catch (error) {
    console.error('Error processing PDF:', error)
    return { 
      success: false, 
      error: error.message 
    }
  }
}

/**
 * Checks if a file has already been processed for embeddings
 * @param {string} storagePath - The storage path of the file
 * @returns {Promise<boolean>}
 */
export async function hasExistingEmbeddings(storagePath) {
  try {
    const { data, error } = await supabase
      .from('organization_files')
      .select('has_embeddings')
      .eq('storage_path', storagePath)
      .single()

    if (error) throw error
    return data?.has_embeddings || false
  } catch (error) {
    console.error('Error checking embeddings status:', error)
    return false
  }
}

/**
 * Searches for relevant document chunks based on a query
 * @param {string} query - The search query
 * @param {string} organizationId - The organization ID to search within
 * @param {Array<{role: string, content: string}>} conversationHistory - Previous messages in the conversation
 * @returns {Promise<Array<{content: string, similarity: number, file_name: string}>>}
 */
export async function searchDocuments(query, organizationId, conversationHistory = []) {
  try {
    if (!query) {
      return [{ 
        content: "No query provided",
        similarity: 0
      }]
    }

    // Cache embeddings for 5 minutes
    const cacheKey = `query_embedding_${query}`
    let queryEmbedding = sessionStorage.getItem(cacheKey)
    
    if (!queryEmbedding) {
      const response = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: query,
        encoding_format: "float"
      })
      queryEmbedding = response.data[0].embedding
      sessionStorage.setItem(cacheKey, JSON.stringify(queryEmbedding))
      setTimeout(() => sessionStorage.removeItem(cacheKey), 5 * 60 * 1000) // Clear after 5 minutes
    } else {
      queryEmbedding = JSON.parse(queryEmbedding)
    }

    // Search for similar documents with optimized query
    const { data: documents, error } = await supabase
      .from('document_embeddings')
      .select('content, file_name, metadata, embedding')
      .eq('organization_id', organizationId)
      .limit(20)  // Reduced from 50 to improve performance

    if (error) throw error

    // Use Web Worker for similarity calculations if available
    let sortedDocuments
    if (typeof Worker !== 'undefined') {
      const workerCode = `
        onmessage = function(e) {
          const { documents, queryEmbedding, query } = e.data;
          
          function calculateSimilarities(docs) {
            return docs.map(doc => {
              const docEmbedding = Array.isArray(doc.embedding) ? doc.embedding : JSON.parse(doc.embedding)
              
              // Calculate cosine similarity
              const dotProduct = queryEmbedding.reduce((sum, val, i) => sum + val * (docEmbedding[i] || 0), 0)
              const queryMagnitude = Math.sqrt(queryEmbedding.reduce((sum, val) => sum + val * val, 0))
              const docMagnitude = Math.sqrt(docEmbedding.reduce((sum, val) => sum + val * val, 0))
              const similarity = dotProduct / (queryMagnitude * docMagnitude)

              // Calculate confidence metrics
              const contentLower = doc.content.toLowerCase()
              const queryTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 2)
              const termMatches = queryTerms.filter(term => contentLower.includes(term)).length
              const termMatchRatio = termMatches / queryTerms.length

              // Detect potential relevance signals
              const hasSpecificDetails = /\\b(must|shall|required|mandatory|specific|policy|procedure|step|process)\\b/i.test(contentLower)
              const hasNumbers = /\\b\\d+(?:\\.\\d+)?(?:\\s*(?:minutes|hours|days|weeks|months|years|inches|feet|meters|cm|mm|%))?\\b/i.test(contentLower)
              const isListItem = /^(?:\\d+\\.|[•\\-\\*]|\\([a-z\\d]\\))\\s/m.test(doc.content)
              
              // Calculate confidence score
              const confidenceMultiplier = (
                (hasSpecificDetails ? 1.2 : 1.0) *
                (hasNumbers ? 1.1 : 1.0) *
                (isListItem ? 1.1 : 1.0)
              )

              return {
                content: doc.content,
                file_name: doc.file_name,
                metadata: doc.metadata,
                similarity: similarity * confidenceMultiplier,
                termMatchRatio,
                hasSpecificDetails,
                hasNumbers,
                isListItem
              }
            });
          }

          const results = calculateSimilarities(documents);
          postMessage(results);
        }
      `
      const blob = new Blob([workerCode], { type: 'application/javascript' })
      const worker = new Worker(URL.createObjectURL(blob))
      
      sortedDocuments = await new Promise((resolve) => {
        worker.onmessage = (e) => {
          worker.terminate()
          resolve(e.data)
        }
        worker.postMessage({ documents, queryEmbedding, query })
      })
    } else {
      // Fallback when Web Workers are not available
      function calculateSimilarities(docs) {
        return docs.map(doc => {
          const docEmbedding = Array.isArray(doc.embedding) ? doc.embedding : JSON.parse(doc.embedding)
          
          // Calculate cosine similarity
          const dotProduct = queryEmbedding.reduce((sum, val, i) => sum + val * (docEmbedding[i] || 0), 0)
          const queryMagnitude = Math.sqrt(queryEmbedding.reduce((sum, val) => sum + val * val, 0))
          const docMagnitude = Math.sqrt(docEmbedding.reduce((sum, val) => sum + val * val, 0))
          const similarity = dotProduct / (queryMagnitude * docMagnitude)

          // Calculate confidence metrics
          const contentLower = doc.content.toLowerCase()
          const queryTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 2)
          const termMatches = queryTerms.filter(term => contentLower.includes(term)).length
          const termMatchRatio = termMatches / queryTerms.length

          // Detect potential relevance signals
          const hasSpecificDetails = /\b(must|shall|required|mandatory|specific|policy|procedure|step|process)\b/i.test(contentLower)
          const hasNumbers = /\b\d+(?:\.\d+)?(?:\s*(?:minutes|hours|days|weeks|months|years|inches|feet|meters|cm|mm|%))?\b/i.test(contentLower)
          const isListItem = /^(?:\d+\.|[•\-\*]|\([a-z\d]\))\s/m.test(doc.content)
          
          // Calculate confidence score
          const confidenceMultiplier = (
            (hasSpecificDetails ? 1.2 : 1.0) *
            (hasNumbers ? 1.1 : 1.0) *
            (isListItem ? 1.1 : 1.0)
          )

          return {
            content: doc.content,
            file_name: doc.file_name,
            metadata: doc.metadata,
            similarity: similarity * confidenceMultiplier,
            termMatchRatio,
            hasSpecificDetails,
            hasNumbers,
            isListItem
          }
        })
      }
      sortedDocuments = calculateSimilarities(documents)
    }

    sortedDocuments = sortedDocuments
      .filter(doc => doc.similarity > 0.1 || doc.termMatchRatio > 0.3)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 3)  // Reduced from 5 to improve performance

    if (sortedDocuments.length === 0) {
      return [{ 
        content: "I couldn't find a relevant answer in the documentation. Please rephrase your question or contact support for assistance.",
        similarity: 0
      }]
    }

    // Analyze document confidence
    const avgSimilarity = sortedDocuments.reduce((sum, doc) => sum + doc.similarity, 0) / sortedDocuments.length
    const hasContradictions = sortedDocuments.some((doc, i) => 
      i > 0 && doc.hasSpecificDetails && sortedDocuments[0].hasSpecificDetails && 
      doc.similarity > sortedDocuments[0].similarity * 0.9
    )

    // Use GPT-4 to generate a natural language response - with caching
    const responseKey = `gpt_response_${query}_${sortedDocuments.map(d => d.content).join('').slice(0, 100)}`
    let formattedResponse = sessionStorage.getItem(responseKey)
    let testResponse = null

    if (!formattedResponse) {
      // First, generate the test response if this is a test query
      if (sortedDocuments[0].similarity > 0.7) {
        const testCompletion = await openai.chat.completions.create({
          model: "gpt-4-turbo-preview",
          messages: [
            {
              role: "system",
              content: `You are generating an ideal test response for a customer service question. This will be used to grade the actual bot's response.

Your response should:
1. Be clear and direct
2. Include all necessary information from the documents
3. Use natural, conversational language
4. Avoid technical terms unless necessary
5. Be under 100 words
6. Never reference documentation or policies
7. Use proper punctuation and spacing
8. Never use unnecessary line breaks

Example format:
Question: "What cheese do you use?"
Response: "We use Wisconsin brick cheese on all our Detroit-style pizzas. It's a key ingredient that gives our pizzas their unique flavor and perfect melt."

Question: "${query}"
Content to base response on:
${sortedDocuments.map(doc => doc.content).join('\n\n')}`
            }
          ],
          temperature: 0.3,
          max_tokens: 150
        })
        testResponse = testCompletion.choices[0].message.content
      }

      // Then generate the actual bot response
    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        {
          role: "system",
          content: `You are a helpful, friendly customer service AI for a Detroit-style pizza company. You provide clear, natural answers based on company information.

CRITICAL RESPONSE RULES:
1. RESPONSES MUST BE UNDER 100 WORDS - NO EXCEPTIONS
2. NEVER reference documentation, protocols, policies, or guidelines
3. NEVER explain what you're going to do - just do it
4. BE DIRECT AND NATURAL - like a helpful human
5. NO NUMBERED LISTS OR BULLET POINTS
6. FOCUS ON IMMEDIATE ACTION AND SOLUTIONS
7. USE PROPER PUNCTUATION AND SPACING
8. NEVER USE UNNECESSARY LINE BREAKS - only use them for clear paragraph separation when needed

WRONG RESPONSES (DO NOT USE):
- "According to our procedures..."
- "Let me assist you by..."
- "Our documentation states..."
- "Based on our protocols..."
- "Our guidelines require..."

RIGHT RESPONSES (USE THESE):
- "I'll fix this right away!"
- "I'm so sorry about that!"
- "Here's what I can do:"
- "I'm sending a new order now."
- "We'll make this right."

Document confidence: ${avgSimilarity > 0.7 ? 'high' : avgSimilarity > 0.4 ? 'medium' : 'low'}
Potential contradictions: ${hasContradictions ? 'yes' : 'no'}`
        },
        // Add conversation history if available
        ...(conversationHistory?.length ? (
          console.log('Using conversation history in prompt:', JSON.stringify(conversationHistory, null, 2)),
          conversationHistory
        ) : []),
        {
          role: "user",
          content: `Question: "${query}"

Relevant content:
${sortedDocuments.map((doc, i) => `${doc.content}`).join('\n\n')}

Provide a natural, concise answer based only on this content. Remember to be direct and conversational, never reference documentation or policies.`
        }
      ],
      temperature: 0.7,
      max_tokens: 250
    })

    const response = completion.choices[0].message.content
      formattedResponse = response
        .replace(/\s*\n\s*\n\s*/g, '\n')  // Replace multiple newlines with a single one
        .replace(/\s*\n\s*/g, ' ')  // Replace single newlines with spaces
      .trim()

      sessionStorage.setItem(responseKey, formattedResponse)
      setTimeout(() => sessionStorage.removeItem(responseKey), 5 * 60 * 1000) // Clear after 5 minutes
    }

    return [{
      content: formattedResponse,
      similarity: Math.max(...sortedDocuments.map(doc => doc.similarity)),
      expectedAnswer: testResponse // Add the test response if available
    }]

  } catch (error) {
    console.error('Error searching documents:', error)
    throw error
  }
}

/**
 * Formats a response in natural language
 */
function formatNaturalResponse(query, content) {
  if (!content) return null

  // Remove technical terms and formatting
  content = content
    .replace(/(?:detroit -|detroit-)\s*style/gi, 'Detroit-style')
    .replace(/\([^)]*\)/g, '')
    .replace(/\b(?:minimum|specifications?|requirements?)\b/gi, '')
    .trim()

  // Extract key information based on query type
  const queryLower = query.toLowerCase()
  if (queryLower.includes('size') || queryLower.includes('dimensions')) {
    return `The ${content.includes('Detroit-style') ? '' : 'Detroit-style '}pizza comes in ${content.match(/\d+×\d+(?:\s*(?:or|and)\s*\d+×\d+)?/)?.[0].replace('×', ' by ')} inches.`
  }
  
  if (queryLower.includes('cheese') || queryLower.includes('ingredients')) {
    return content.replace(/mandatory|blend mandatory/, 'is required')
  }

  // Default natural language formatting
  return content
    .replace(/^(the|a|an)\s+/i, '')
    .replace(/\s+/g, ' ')
    .replace(/\b(is|are)\s+(mandatory|required)\b/gi, 'must be used')
    .trim()
}

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
export function evaluateResponse(botResponse, expectedAnswer) {
  if (!botResponse || !expectedAnswer) return 0

  const content = botResponse.toLowerCase()
  const expected = expectedAnswer.toLowerCase()

  // Calculate various metrics
  const stringSimilarity = calculateStringSimilarity(content, expected)
  
  // Heavily penalize verbose responses
  const lengthRatio = expected.length / Math.max(content.length, expected.length)
  
  // More strict keyword matching
  const expectedKeywords = expected.split(' ')
    .filter(word => word.length > 3)
    .map(word => word.toLowerCase())
  const keywordMatch = expectedKeywords
    .filter(keyword => content.includes(keyword))
    .length / expectedKeywords.length

  // Penalize non-natural language and formatting
  const formatPenalties = [
    content.includes('•') ? 0.5 : 1,  // Bullet points
    content.includes('specifications') ? 0.7 : 1,  // Copy-pasted headers
    /\d+×\d+/.test(content) ? 0.8 : 1,  // Dimensions with × symbol
    content.includes('quality control') ? 0.7 : 1,  // Technical terms
    /\d+°[FC]/.test(content) ? 0.8 : 1  // Temperature specifications
  ].reduce((a, b) => a * b)

  // Increased verbosity penalty
  const verbosityPenalty = content.length > expected.length * 1.5 ? 0.3 : 1  // More aggressive length penalty

  // Calculate weighted score with penalties
  const overallScore = (
    (stringSimilarity * 0.2) +
    (lengthRatio * 0.5) +      // Even higher weight for conciseness
    (keywordMatch * 0.3)
  ) * verbosityPenalty * formatPenalties  // Apply both penalties

  return overallScore
} 