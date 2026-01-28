/**
 * LLM Suggestion Service (Mistral-based)
 * Provides diet and medication suggestions based on CBC analysis
 */

const axios = require('axios');

/**
 * Get diet and medication suggestions from an LLM (Mistral API)
 * @param {Array} conditions - Detected conditions
 * @param {Object} cbcData - CBC data
 * @param {string} gender - Patient gender
 * @returns {Promise<Object>} Suggestions with diet and medication recommendations
 */
const getSuggestions = async (conditions, cbcData, gender = null) => {
  // Prefer Mistral API; fall back to mock if no key
  const mistralApiKey = process.env.MISTRAL_API_KEY;

  if (!mistralApiKey) {
    // No LLM configured – use rule-based mock suggestions
    return getMockSuggestions(conditions);
  }

  try {
    // Build prompt text
    const conditionNames = conditions.map(c => c.condition).join(', ');
    const abnormalParams = Object.entries(cbcData)
      .filter(([key, value]) => 
        ['hemoglobin', 'rbc', 'wbc', 'platelets', 'hematocrit', 'mcv', 'mch', 'mchc'].includes(key) && value
      )
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');

    const prompt = `You are a medical assistant. Based on the following CBC (Complete Blood Count) analysis:

Conditions detected: ${conditionNames}
CBC Values: ${abnormalParams}
Gender: ${gender || 'Not specified'}

Please provide:
1. Dietary recommendations to help improve these conditions (be specific with foods)
2. Lifestyle suggestions
3. Possible medications that might be prescribed (with disclaimer that this is informational only and not medical advice)
4. When to consult a doctor

Format your response as JSON with this structure:
{
  "dietaryRecommendations": ["recommendation 1", "recommendation 2", ...],
  "lifestyleSuggestions": ["suggestion 1", "suggestion 2", ...],
  "possibleMedications": [{"name": "medication name", "purpose": "what it's for", "note": "important note"}],
  "whenToConsultDoctor": "guidance on when to see a doctor",
  "disclaimer": "Important medical disclaimer"
}

IMPORTANT: Always include a strong disclaimer that this is for informational purposes only and not a substitute for professional medical advice.`;
 
    const response = await axios.post(
      'https://api.mistral.ai/v1/chat/completions',
      {
        // You can switch to another deployed model here if needed
        model: process.env.MISTRAL_MODEL_ID || 'mistral-small-latest',
        messages: [
          {
            role: 'system',
            content:
              'You are a helpful medical assistant. Always include disclaimers that your advice is informational and not a substitute for professional medical care.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 1000
      },
      {
        headers: {
          Authorization: `Bearer ${mistralApiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000 // 30 second timeout
      }
    );

    const content = response.data.choices?.[0]?.message?.content || '';

    // Try to extract JSON from the LLM response
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.warn('Failed to parse Mistral JSON response, using text format');
    }

    // Fallback: return structured text response
    return {
      dietaryRecommendations: [content],
      lifestyleSuggestions: [],
      possibleMedications: [],
      whenToConsultDoctor: 'Consult a healthcare provider for proper diagnosis and treatment.',
      disclaimer:
        'This information is for educational purposes only and is not a substitute for professional medical advice, diagnosis, or treatment.',
      rawResponse: content
    };
  } catch (error) {
    console.error('Mistral API error:', error.message);
    // Fallback to mock suggestions if LLM fails
    return getMockSuggestions(conditions);
  }
};

/**
 * Get mock suggestions when OpenAI is not available
 * @param {Array} conditions - Detected conditions
 * @returns {Object} Mock suggestions
 */
const getMockSuggestions = (conditions) => {
  // Rule-based suggestions per condition (fallback when OpenAI not configured)
  const suggestions = {
    dietaryRecommendations: [],
    lifestyleSuggestions: [],
    possibleMedications: [],
    whenToConsultDoctor: 'Please consult a healthcare provider for proper diagnosis and treatment.',
    disclaimer: '⚠️ DISCLAIMER: This information is for educational purposes only and is NOT a substitute for professional medical advice, diagnosis, or treatment. Always seek the advice of your physician or other qualified health provider with any questions you may have regarding a medical condition. Never disregard professional medical advice or delay in seeking it because of something you have read here.',
    note: 'Mock suggestions - OpenAI API not configured. Configure OPENAI_API_KEY in .env file for AI-powered recommendations.'
  };

  const add = (diet = [], life = [], meds = []) => {
    suggestions.dietaryRecommendations.push(...diet);
    suggestions.lifestyleSuggestions.push(...life);
    suggestions.possibleMedications.push(...meds);
  };

  conditions.forEach(condition => {
    const condName = (condition.condition || '').toLowerCase();

    // Anemia / low Hb
    if (condName.includes('anemia') || condName.includes('iron')) {
      add(
        [
          'Increase iron-rich foods: lean red meat, spinach, lentils, beans, fortified cereals',
          'Pair iron with vitamin C foods (citrus, bell peppers, tomatoes) to improve absorption',
          'Include folate sources: dark leafy greens, citrus, beans'
        ],
        [
          'Avoid tea/coffee with meals (may inhibit iron absorption)',
          'Ensure 7–9 hours sleep; pace activity if fatigued'
        ],
        [
          'Discuss iron supplementation with a clinician if iron deficiency is confirmed'
        ]
      );
    }

    // Infection / leukocytosis / high WBC
    if (condName.includes('leukocytosis') || condName.includes('infection') || condName.includes('possible infection')) {
      add(
        [
          'Hydrate well; consider warm broths and herbal teas',
          'Favor anti-inflammatory foods: turmeric, ginger, garlic, berries',
          'Include probiotics (yogurt, kefir, fermented foods) unless contraindicated'
        ],
        [
          'Prioritize rest; avoid overexertion',
          'Practice hygiene: handwashing, mask if advised',
          'Manage stress with brief relaxation or breathing exercises'
        ],
        []
      );
    }

    // Thrombocytopenia / low platelets
    if (condName.includes('thrombocytopenia') || condName.includes('platelet')) {
      add(
        [
          'Foods with vitamin K: leafy greens, broccoli, Brussels sprouts',
          'Folate sources: spinach, asparagus, avocados',
          'Vitamin B12 sources: fish, meat, eggs, dairy (if tolerated)'
        ],
        [
          'Avoid contact sports or activities with bleeding risk',
          'Use soft-bristled toothbrush; avoid harsh flossing'
        ],
        [
          'Avoid NSAIDs without medical advice if platelets are low',
          'Discuss therapies (e.g., corticosteroids/IVIG) with a clinician if platelet disorder is confirmed'
        ]
      );
    }

    // Generic low RBC / low hematocrit
    if (condName.includes('low rbc') || condName.includes('low hematocrit')) {
      add(
        [
          'Iron and B12 sources: lean meats, eggs, dairy, fortified cereals',
          'Hydrate adequately; balanced protein intake'
        ],
        [
          'Avoid overexertion if symptomatic; rest as needed'
        ],
        []
      );
    }
  });

  // Default suggestions if nothing matched
  if (
    suggestions.dietaryRecommendations.length === 0 &&
    suggestions.lifestyleSuggestions.length === 0 &&
    suggestions.possibleMedications.length === 0
  ) {
    add(
      [
        'Balanced diet with fruits, vegetables, whole grains, and lean proteins',
        'Stay hydrated; limit processed foods and added sugars'
      ],
      [
        'Regular moderate exercise (30 minutes most days)',
        'Maintain consistent sleep routine (7–9 hours)',
        'Stress management (mindfulness, breathing drills)'
      ],
      []
    );
  }

  return suggestions;
};

module.exports = {
  getSuggestions
};

