/**
 * OCR Service - Validation Functions
 * Note: OCR extraction is now handled by Python OCR service in ocr-code folder (port 5002)
 * This file only contains validation utilities
 */

/**
 * Validate extracted values
 * @param {Object} extractedData - Extracted CBC data
 * @returns {Object} Validation result
 */
const validateExtractedData = (extractedData) => {
  const errors = [];
  const warnings = [];
  
  // Check if we have any extracted data at all
  if (!extractedData || Object.keys(extractedData).length === 0) {
    errors.push('No data extracted from the file');
    return {
      isValid: false,
      errors,
      warnings
    };
  }
  
  // Check if we have OCR text (even if values weren't parsed)
  // This is the key check - if we have OCR text, we should allow the upload
  const hasOcrText = extractedData.all_text && extractedData.all_text.trim().length > 0;
  const hasOcrResult = extractedData.ocr_result && Array.isArray(extractedData.ocr_result) && extractedData.ocr_result.length > 0;
  
  if (hasOcrText) {
    console.log('📝 OCR extracted text (first 300 chars):', extractedData.all_text.substring(0, Math.min(300, extractedData.all_text.length)));
  } else if (hasOcrResult) {
    console.log('📝 OCR result array available with', extractedData.ocr_result.length, 'detections');
  } else {
    // Only warn, don't error - maybe values were extracted directly
    warnings.push('No OCR text extracted from the file');
  }
  
  // Check if we have any CBC values
  const cbcParams = ['hemoglobin', 'rbc', 'wbc', 'platelets'];
  const hasAnyCBCValue = cbcParams.some(param => 
    extractedData[param] !== undefined && 
    extractedData[param] !== null && 
    !isNaN(extractedData[param])
  );
  
  if (!hasAnyCBCValue) {
    warnings.push('No standard CBC values found in extracted data. You may need to enter values manually.');
    // Don't treat this as an error - allow the user to proceed with manual entry
  }
  
  // Check for missing required fields (as warnings, not errors)
  const requiredFields = ['hemoglobin', 'rbc', 'wbc', 'platelets'];
  requiredFields.forEach(field => {
    if (extractedData[field] === undefined || extractedData[field] === null || isNaN(extractedData[field])) {
      warnings.push(`Missing value for: ${field}`);
    }
  });
  
  // Validate value ranges (basic sanity checks)
  const ranges = {
    hemoglobin: { min: 5, max: 20 },
    wbc: { min: 1000, max: 50000 },
    platelets: { min: 50000, max: 1000000 },
    rbc: { min: 2, max: 8 },
    hematocrit: { min: 20, max: 60 },
    mcv: { min: 50, max: 150 },
    mch: { min: 15, max: 50 },
    mchc: { min: 25, max: 45 },
    rdw: { min: 10, max: 20 }
  };
  
  for (const [param, range] of Object.entries(ranges)) {
    if (extractedData[param] !== undefined && extractedData[param] !== null && !isNaN(extractedData[param])) {
      const value = parseFloat(extractedData[param]);
      if (value < range.min || value > range.max) {
        warnings.push(`${param} value (${value}) seems unusual. Please verify.`);
      }
    }
  }
  
  // Always return valid - allow upload even with just warnings
  // The user can manually enter values if needed
  return {
    isValid: true, // Always return true - show warnings instead of errors
    errors,
    warnings
  };
};

module.exports = {
  validateExtractedData
};
