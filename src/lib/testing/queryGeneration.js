import { OpenAI } from 'openai'
import { supabase } from '../supabaseClient'

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
})

/**
 * Fetches and analyzes past test grades for an organization
 * @param {string} organizationId - The organization ID
 * @returns {Promise<string>} Analysis of past performance
 */
async function analyzePastGrades(organizationId) {
  try {
    const { data: grades, error } = await supabase
      .from('test_grades')
      .select('*')
      .eq('organization_id', organizationId)
      .order('graded_at', { ascending: false })
      .limit(20) // Reduced from 50

    if (error) throw error
    if (!grades || grades.length === 0) return null

    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        {
          role: "system",
          content: `Analyze these grades. Focus on:
1. What responses scored well/poorly
2. Common mistakes to avoid
3. Key improvement areas

Be brief and specific.`
        },
        {
          role: "user",
          content: JSON.stringify(grades)
        }
      ],
      temperature: 0.7,
      max_tokens: 200 // Reduced from 500
    })

    return response.choices[0].message.content
  } catch (error) {
    console.error('Error analyzing grades:', error)
    return null
  }
}

/**
 * Generates test queries based on the content of a PDF document and past performance
 * @param {string} organizationId - The organization ID that owns the document
 * @param {string} fileName - The name of the PDF file to generate queries for
 * @param {number} [count=5] - Number of queries to generate
 * @returns {Promise<Array<{query: string, category: string}>>}
 */
export async function generateTestQueries(organizationId, fileName, count = 5) {
  try {
    // Cache key for document content
    const cacheKey = `doc_content_${organizationId}_${fileName}`
    let fullDocument = sessionStorage.getItem(cacheKey)
    
    if (!fullDocument) {
      // Get document chunks for this file
      const { data: chunks, error } = await supabase
        .from('document_embeddings')
        .select('content')
        .eq('organization_id', organizationId)
        .eq('file_name', fileName)
        .limit(3)

      if (error) throw error
      fullDocument = chunks.map(chunk => chunk.content).join('\n')
      sessionStorage.setItem(cacheKey, fullDocument)
      setTimeout(() => sessionStorage.removeItem(cacheKey), 30 * 60 * 1000)
    }

    // Get analysis of past performance
    const performanceAnalysis = await analyzePastGrades(organizationId)

    // Generate test queries using GPT-4 with enhanced prompt
    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        {
          role: "system",
          content: `Generate challenging and diverse customer service questions that test the bot's ability to handle both standard and complex scenarios.

You must return a valid JSON object with this exact structure:
{
  "queries": [
    {
      "query": "string with the question",
      "category": "category name"
    }
  ]
}

CRITICAL: ENSURE HIGH DIVERSITY
Each batch of questions MUST include a mix of different topics. Avoid generating multiple questions about the same topic (like wrong orders or delivery issues).

Question types to include (use ALL categories):

1. Menu & Ingredients Questions
- "can you break down exactly what cheeses go into your blend? my kid has specific dairy allergies"
- "what makes your sauce different from NY style? is it chunky or smooth?"
- "which pizzas can be made vegan? need the full ingredient list for each one"

2. Ordering & Customization
- "planning a half veggie half meat lovers - can you do different thickness for each half?"
- "want extra crispy edges but soft middle, plus light on the sauce - possible?"
- "need 3 different styles - can you do Detroit, NY, and Chicago all in one order?"

3. Special Events & Catering
- "hosting a pizza-making party for 15 kids - what equipment/ingredients should we have?"
- "need catering for 200 people, mix of squares and rounds, plus appetizers and drinks"
- "wedding reception planning - can we do mini versions of all your specialty pizzas?"

4. Technical & Process Questions
- "what temp do you cook at? trying to recreate that crispy bottom at home"
- "how do you prevent cross-contamination with gluten-free orders?"
- "curious about your dough fermentation process - why 48 hours specifically?"

5. Dietary & Allergen Concerns
- "which items are certified kosher? need rabbi certification details"
- "can you list every ingredient that contains soy? including oils and seasonings"
- "what's the carb count in your cauliflower crust vs regular?"

6. Business & Partnership
- "interested in franchising - what's your expansion plan for next year?"
- "want to feature you in a food documentary - who handles media requests?"
- "looking to supply your restaurants with local organic tomatoes - procurement contact?"

7. Unique Situations
- "throwing a surprise party - need silent delivery + special entrance instructions"
- "want to send pizzas to 5 different cities simultaneously - possible?"
- "filming a commercial - need 20 identical pizzas that won't melt under lights"

8. Location & Service Area
- "moving to Chicago next month - planning to open any stores there?"
- "what's the max distance you'll deliver for large catering orders?"
- "looking at your Times Square location - private event space available?"

Make each question:
- Use different topics and scenarios
- Include realistic details and context
- Mix simple and complex inquiries
- Vary the emotional tone (excited, concerned, curious, urgent)
- Use natural language with occasional typos/slang
- Add specific details that require attention

DIVERSITY RULES:
1. NO MORE THAN ONE question about wrong orders per batch
2. NO MORE THAN ONE question about delivery issues per batch
3. NO MORE THAN ONE question about any specific topic
4. MUST include questions from at least 6 different categories
5. MUST mix business hours, ingredient, allergy, catering, and technical questions
6. ALTERNATE between simple and complex scenarios

Past Analysis:
${performanceAnalysis || "No past data available"}`
        },
        {
          role: "user",
          content: `Generate ${count} completely unique customer questions (mix of relevant and challenging scenarios) in JSON format based on:\n${fullDocument}`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.9,
      max_tokens: 800,
      presence_penalty: 0.98,
      frequency_penalty: 0.98
    })

    try {
      const parsedResponse = JSON.parse(response.choices[0].message.content)
      if (!parsedResponse.queries || !Array.isArray(parsedResponse.queries)) {
        throw new Error('Invalid response format from OpenAI')
      }
      return parsedResponse.queries.map(query => ({
        query: query.query,
        category: query.category,
        expectedAnswer: null
      }))
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