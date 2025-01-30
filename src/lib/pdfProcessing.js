import { supabase } from './supabaseClient'
import { OpenAI } from 'openai'

// Configure PDF.js worker
const pdfjsLib = await import('pdfjs-dist')
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`

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
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
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
 * @returns {Promise<Array<{content: string, similarity: number, file_name: string}>>}
 */
export async function searchDocuments(query, organizationId) {
  try {
    // Generate embedding for the search query
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: query,
      encoding_format: "float"
    })
    const queryEmbedding = response.data[0].embedding

    // Search for similar documents
    const { data: documents, error } = await supabase
      .from('document_embeddings')
      .select('content, file_name, metadata, embedding')
      .eq('organization_id', organizationId)
      .limit(50)

    if (error) throw error

    // Calculate similarity scores with confidence metrics
    const sortedDocuments = documents
      .map(doc => {
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

        // Detect potential contradictions or hallucinations
        const hasSpecificDetails = /\b(must|shall|required|mandatory|specific)\b.*\b(wear|use|have|carry)\b/i.test(contentLower)
        const isGeneralPolicy = /\b(policy|procedure|guideline)\b/i.test(contentLower)
        const detailConfidence = hasSpecificDetails ? 1.2 : (isGeneralPolicy ? 0.9 : 1.0)

        return {
          content: doc.content,
          file_name: doc.file_name,
          metadata: doc.metadata,
          similarity: similarity * detailConfidence,
          termMatchRatio,
          hasSpecificDetails,
          isGeneralPolicy
        }
      })
      .filter(doc => doc.similarity > 0.2 || doc.termMatchRatio > 0.5)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5)

    if (sortedDocuments.length === 0) {
      return [{ 
        content: "I couldn't find a relevant answer in the document.",
        similarity: 0
      }]
    }

    // Analyze document confidence
    const avgSimilarity = sortedDocuments.reduce((sum, doc) => sum + doc.similarity, 0) / sortedDocuments.length
    const hasContradictions = sortedDocuments.some((doc, i) => 
      i > 0 && doc.hasSpecificDetails && sortedDocuments[0].hasSpecificDetails && 
      doc.similarity > sortedDocuments[0].similarity * 0.8
    )

    // Use GPT-4 to generate a natural language response
    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        {
          role: "system",
          content: `You are a helpful customer service AI that provides clear, concise answers based on company documentation.
          
Instructions:
1. Answer in natural, conversational language
2. Be concise and direct
3. Only include information that is explicitly stated in the provided content
4. If the document doesn't specify details about a topic, say so directly
5. Do not infer or assume details that aren't explicitly stated
6. If you find contradicting information, acknowledge the uncertainty
7. For policy questions, only state requirements that are clearly documented
8. If the confidence is low or information is ambiguous, err on the side of saying information isn't specified

Document confidence: ${avgSimilarity > 0.8 ? 'high' : avgSimilarity > 0.5 ? 'medium' : 'low'}
Potential contradictions: ${hasContradictions ? 'yes' : 'no'}`
        },
        {
          role: "user",
          content: `Question: "${query}"

Relevant content from documentation:
${sortedDocuments.map(doc => doc.content).join('\n\n')}

Please provide a natural, concise answer based only on explicitly stated information in this content.`
        }
      ],
      temperature: 0.1,
      max_tokens: 150
    })

    return [{
      content: completion.choices[0].message.content,
      similarity: Math.max(...sortedDocuments.map(doc => doc.similarity))
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