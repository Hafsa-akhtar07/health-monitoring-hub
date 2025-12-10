/**
 * OpenAI Service
 * Provides diet and medication suggestions based on CBC analysis
 */

const axios = require('axios');

/**
 * Get diet and medication suggestions from OpenAI
 * @param {Array} conditions - Detected conditions
 * @param {Object} cbcData - CBC data
 * @param {string} gender - Patient gender
 * @returns {Promise<Object>} Suggestions with diet and medication recommendations
 */
const getSuggestions = async (conditions, cbcData, gender = null) => {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey || apiKey === 'your_openai_api_key_here') {
    // Return mock suggestions if OpenAI API key is not configured
    return getMockSuggestions(conditions);
  }

  try {
    // Build prompt for OpenAI
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
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful medical assistant. Always include disclaimers that your advice is informational and not a substitute for professional medical care.'
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
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000 // 30 second timeout
      }
    );

    const content = response.data.choices[0].message.content;
    
    // Try to parse JSON from response
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.warn('Failed to parse OpenAI JSON response, using text format');
    }

    // Fallback: return structured text response
    return {
      dietaryRecommendations: [content],
      lifestyleSuggestions: [],
      possibleMedications: [],
      whenToConsultDoctor: 'Consult a healthcare provider for proper diagnosis and treatment.',
      disclaimer: 'This information is for educational purposes only and is not a substitute for professional medical advice, diagnosis, or treatment.',
      rawResponse: content
    };

  } catch (error) {
    console.error('OpenAI API error:', error.message);
    // Fallback to mock suggestions
    return getMockSuggestions(conditions);
  }
};

/**
 * Get mock suggestions when OpenAI is not available
 * @param {Array} conditions - Detected conditions
 * @returns {Object} Mock suggestions
 */
const getMockSuggestions = (conditions) => {
  const conditionNames = conditions.map(c => c.condition).join(', ');

  const suggestions = {
    dietaryRecommendations: [],
    lifestyleSuggestions: [],
    possibleMedications: [],
    whenToConsultDoctor: 'Please consult a healthcare provider for proper diagnosis and treatment.',
    disclaimer: '⚠️ DISCLAIMER: This information is for educational purposes only and is NOT a substitute for professional medical advice, diagnosis, or treatment. Always seek the advice of your physician or other qualified health provider with any questions you may have regarding a medical condition. Never disregard professional medical advice or delay in seeking it because of something you have read here.',
    note: 'Mock suggestions - OpenAI API not configured. Configure OPENAI_API_KEY in .env file for AI-powered recommendations.'
  };

  // Generate suggestions based on conditions
  conditions.forEach(condition => {
    const condName = condition.condition.toLowerCase();

    if (condName.includes('anemia') || condName.includes('iron')) {
      suggestions.dietaryRecommendations.push(
        'Increase iron-rich foods: lean red meat, spinach, lentils, beans, fortified cereals',
        'Consume vitamin C-rich foods with iron meals to enhance absorption (oranges, bell peppers, tomatoes)',
        'Include folate-rich foods: dark leafy greens, citrus fruits, beans'
      );
      suggestions.lifestyleSuggestions.push(
        'Avoid tea/coffee with meals (can inhibit iron absorption)',
        'Get adequate sleep (7-9 hours per night)',
        'Consider iron supplements only under medical supervision'
      );
      suggestions.possibleMedications.push({
        name: 'Iron Supplements',
        purpose: 'To treat iron deficiency anemia',
        note: 'Should be taken under medical supervision. Common forms: ferrous sulfate, ferrous fumarate'
      });
    }

    if (condName.includes('leukocytosis') || condName.includes('infection')) {
      suggestions.dietaryRecommendations.push(
        'Stay hydrated with water and herbal teas',
        'Eat anti-inflammatory foods: turmeric, ginger, garlic, berries',
        'Include probiotics: yogurt, kefir, fermented foods'
      );
      suggestions.lifestyleSuggestions.push(
        'Get adequate rest to support immune system',
        'Practice good hygiene to prevent further infection',
        'Avoid stress and maintain a balanced routine'
      );
    }

    if (condName.includes('thrombocytopenia')) {
      suggestions.dietaryRecommendations.push(
        'Eat foods rich in vitamin K: leafy greens, broccoli, Brussels sprouts',
        'Include foods with folate: spinach, asparagus, avocados',
        'Consume foods with B12: fish, meat, eggs, dairy'
      );
      suggestions.lifestyleSuggestions.push(
        'Avoid activities that may cause bleeding or bruising',
        'Use soft-bristled toothbrush',
        'Be cautious with medications that affect blood clotting'
      );
      suggestions.possibleMedications.push({
        name: 'Corticosteroids or IVIG',
        purpose: 'To treat immune thrombocytopenia',
        note: 'Prescribed only by healthcare providers based on severity and cause'
      });
    }
  });

  // Default suggestions if no specific conditions
  if (suggestions.dietaryRecommendations.length === 0) {
    suggestions.dietaryRecommendations.push(
      'Maintain a balanced diet with fruits, vegetables, whole grains, and lean proteins',
      'Stay hydrated by drinking adequate water throughout the day',
      'Limit processed foods and added sugars'
    );
    suggestions.lifestyleSuggestions.push(
      'Get regular exercise (30 minutes most days)',
      'Maintain a healthy sleep schedule',
      'Manage stress through relaxation techniques'
    );
  }

  return suggestions;
};

module.exports = {
  getSuggestions
};

