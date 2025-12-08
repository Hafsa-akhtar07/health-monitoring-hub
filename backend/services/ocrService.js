/**
 * OCR Service
 * Extracts CBC values from uploaded images/PDFs
 * 
 * Note: This is a mock implementation for initial setup.
 * Replace with actual Tesseract OCR or other OCR service integration.
 */

/**
 * Mock OCR extraction
 * TODO: Replace with actual Tesseract OCR implementation
 * @param {string} filePath - Path to uploaded file
 * @returns {Promise<Object>} Extracted CBC values
 */
const extractCBCValues = async (filePath) => {
  // Simulate OCR processing delay
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Mock extracted values - Replace with actual OCR logic
  // This is a placeholder that returns sample data
  const mockExtractedData = {
    hemoglobin: 12.5,
    rbc: 4.5,
    wbc: 7000,
    platelets: 250000,
    hematocrit: 38.5,
    mcv: 85,
    mch: 28,
    mchc: 33,
    rdw: 13.2,
    extractionMethod: 'mock',
    confidence: 0.85,
    extractedAt: new Date().toISOString()
  };
  
  return mockExtractedData;
};

/**
 * Validate extracted values
 * @param {Object} extractedData - Extracted CBC data
 * @returns {Object} Validation result
 */
const validateExtractedData = (extractedData) => {
  const errors = [];
  const warnings = [];
  
  // Check if required fields are present
  const requiredFields = ['hemoglobin', 'rbc', 'wbc', 'platelets'];
  requiredFields.forEach(field => {
    if (extractedData[field] === undefined || extractedData[field] === null) {
      errors.push(`Missing required field: ${field}`);
    }
  });
  
  // Validate value ranges (basic sanity checks)
  if (extractedData.hemoglobin && (extractedData.hemoglobin < 5 || extractedData.hemoglobin > 20)) {
    warnings.push('Hemoglobin value seems unusual. Please verify.');
  }
  
  if (extractedData.wbc && (extractedData.wbc < 1000 || extractedData.wbc > 50000)) {
    warnings.push('WBC value seems unusual. Please verify.');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

/**
 * TODO: Implement actual OCR using Tesseract.js
 * 
 * Example implementation:
 * 
 * const Tesseract = require('tesseract.js');
 * 
 * const extractCBCValues = async (filePath) => {
 *   const { data: { text } } = await Tesseract.recognize(filePath, 'eng', {
 *     logger: m => console.log(m)
 *   });
 *   
 *   // Parse text to extract CBC values
 *   // Use regex patterns to find values
 *   // Return structured data
 * };
 */

module.exports = {
  extractCBCValues,
  validateExtractedData
};

