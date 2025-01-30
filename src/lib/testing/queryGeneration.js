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
1. Generate 5 diverse test queries including:
   - Formal business questions
   - Casual/informal language questions
   - Questions with improper grammar
   - Confusing or ambiguous questions
   - Multiple questions in one
   - Irrelevant questions (that should get "no answer found")
   - Vague questions
   - Technical questions
   - Emergency scenario questions
2. Include questions of varying complexity:
   - Simple (basic facts)
   - Medium (operational procedures)
   - Complex (multi-step processes, policies)
3. Cover different categories:
   - Product Standards
   - Food Safety
   - Customer Service
   - Operations
   - Equipment
   - Training
   - Marketing
   - Compliance
   - Off Topic

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

/**
 * Returns a set of predefined test cases covering various scenarios
 * @returns {Array<{query: string, expectedAnswer: string, category: string, complexity: string}>}
 */
export function getStaticTestCases() {
  return [
    // Original core business questions
    {
      category: "Product Standards",
      complexity: "complex",
      query: "What are the mandatory ingredients for a Detroit-style pizza?",
      expectedAnswer: "A Detroit-style pizza must have Wisconsin brick cheese, a thick square crust, and sauce on top. These are the essential ingredients that define our Detroit-style pizza."
    },
    {
      category: "Food Safety",
      complexity: "medium",
      query: "What temperature should the pizza be stored at?",
      expectedAnswer: "All pizzas must be stored at or below 40°F (4°C) in the refrigerator to maintain food safety."
    },
    // Casual/Informal Language
    {
      category: "Customer Service",
      complexity: "simple",
      query: "yo whats ur refund policy like?",
      expectedAnswer: "We offer full refunds for orders within 30 minutes of delivery if you're not satisfied with your pizza."
    },
    {
      category: "Ordering",
      complexity: "simple",
      query: "can i get extra stuff on my pizza",
      expectedAnswer: "Yes, you can customize your pizza with additional toppings from our menu for an extra charge per topping."
    },
    // Questions with improper grammar
    {
      category: "Delivery",
      complexity: "medium",
      query: "how long pizza take to come to my house",
      expectedAnswer: "We guarantee delivery within 45 minutes of your order, or you'll receive a discount on your next purchase."
    },
    // Confusing or ambiguous questions
    {
      category: "Menu",
      complexity: "complex",
      query: "what's that thing you guys put on the crust that makes it taste good",
      expectedAnswer: "Our signature crust is brushed with garlic butter and sprinkled with our proprietary herb blend before baking."
    },
    // Questions requiring specific details
    {
      category: "Food Preparation",
      complexity: "complex",
      query: "How exactly do you make the dough rise properly?",
      expectedAnswer: "Our dough must proof for 24-48 hours at 38-40°F, then rest at room temperature for 2 hours before stretching."
    },
    // Questions about policies
    {
      category: "Employment",
      complexity: "medium",
      query: "What benefits do your workers get?",
      expectedAnswer: "Full-time employees receive health insurance, paid time off, 401(k) matching, and meal discounts."
    },
    // Irrelevant questions
    {
      category: "Off Topic",
      complexity: "simple",
      query: "What's the weather like in Miami?",
      expectedAnswer: "I couldn't find a relevant answer in the document."
    },
    {
      category: "Off Topic",
      complexity: "medium",
      query: "How do I fix my car's transmission?",
      expectedAnswer: "I couldn't find a relevant answer in the document."
    },
    // Technical questions
    {
      category: "Equipment",
      complexity: "complex",
      query: "What's the maintenance schedule for the pizza ovens?",
      expectedAnswer: "Pizza ovens must be cleaned daily, deep cleaned weekly, and professionally serviced every 3 months for optimal performance."
    },
    // Emergency procedures
    {
      category: "Safety",
      complexity: "complex",
      query: "What do we do if there's a fire in the kitchen?",
      expectedAnswer: "Immediately evacuate the building, call 911, use fire extinguishers only if safe, and follow the emergency evacuation plan posted by each exit."
    },
    // Quality control
    {
      category: "Quality Assurance",
      complexity: "medium",
      query: "How do you check if a pizza is cooked right?",
      expectedAnswer: "Check that the crust is golden brown, cheese is fully melted, internal temperature reaches 165°F, and the bottom is crispy."
    },
    // Specific scenarios
    {
      category: "Customer Service",
      complexity: "complex",
      query: "what if someone says they got food poisoning",
      expectedAnswer: "Document the complaint, gather order details, notify management immediately, and follow our incident response protocol for food safety concerns."
    },
    // Vague questions
    {
      category: "General",
      complexity: "simple",
      query: "is it good?",
      expectedAnswer: "I couldn't find a relevant answer in the document."
    },
    // Multiple questions in one
    {
      category: "Operations",
      complexity: "complex",
      query: "what time do you open and close and do you deliver everywhere and what's your most popular pizza",
      expectedAnswer: "We're open 11 AM to 11 PM daily, deliver within a 5-mile radius, and our Detroit-style Pepperoni Supreme is our most ordered pizza."
    },
    // Questions about exceptions
    {
      category: "Policy",
      complexity: "medium",
      query: "can i get a refund after 2 days",
      expectedAnswer: "No, refunds are only available within 30 minutes of delivery. After that, we can offer store credit or replacement based on management discretion."
    },
    // Questions about special cases
    {
      category: "Dietary",
      complexity: "complex",
      query: "what if i'm allergic to gluten",
      expectedAnswer: "We offer gluten-free crusts, but we cannot guarantee zero cross-contamination as our kitchen handles wheat products. We recommend those with severe allergies exercise caution."
    },
    // Questions about documentation
    {
      category: "Compliance",
      complexity: "medium",
      query: "where are the health inspection reports kept",
      expectedAnswer: "Health inspection reports are maintained in the compliance folder in the manager's office and must be readily available for review."
    },
    // Questions about training
    {
      category: "Training",
      complexity: "complex",
      query: "how long does it take to train a new pizza maker",
      expectedAnswer: "New pizza makers undergo a 2-week training program, including food safety certification, dough preparation, topping portioning, and cooking techniques."
    },
    // Questions about equipment
    {
      category: "Equipment",
      complexity: "medium",
      query: "what do i do if the oven breaks",
      expectedAnswer: "Immediately notify the manager, log the issue in the maintenance system, and contact our authorized repair service. Use backup ovens if available."
    },
    // Questions about ingredients
    {
      category: "Inventory",
      complexity: "medium",
      query: "how long does cheese last in the fridge",
      expectedAnswer: "Shredded cheese must be used within 7 days of opening when stored at 40°F or below. Check date labels and temperature logs daily."
    },
    // Questions about delivery
    {
      category: "Delivery",
      complexity: "complex",
      query: "what happens if the driver gets in an accident",
      expectedAnswer: "Drivers must immediately report accidents to management, contact police if necessary, and follow our incident reporting procedure. All deliveries are covered by our insurance policy."
    },
    // Questions about marketing
    {
      category: "Marketing",
      complexity: "medium",
      query: "can we post pics of customers on social media",
      expectedAnswer: "Customer photos can only be posted with written consent. All social media posts must follow our marketing guidelines and protect customer privacy."
    },
    // Questions about competition
    {
      category: "Business",
      complexity: "simple",
      query: "why are you better than other pizza places",
      expectedAnswer: "Our Detroit-style pizza features authentic Wisconsin brick cheese, house-made sauce, and 48-hour proofed dough, setting us apart from competitors."
    }
  ];
} 