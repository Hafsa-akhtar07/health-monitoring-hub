/**
 * CBC Reference Ranges
 * These are standard medical reference ranges for Complete Blood Count parameters
 */

const referenceRanges = {
  // Hemoglobin (g/dL)
  hemoglobin: {
    male: { min: 13.5, max: 17.5 },
    female: { min: 12.0, max: 15.5 },
    unit: 'g/dL'
  },
  
  // Red Blood Cells (RBC) - million cells/μL
  rbc: {
    male: { min: 4.5, max: 5.5 },
    female: { min: 4.0, max: 5.0 },
    unit: 'million cells/μL'
  },
  
  // White Blood Cells (WBC) - cells/μL
  wbc: {
    min: 4000,
    max: 11000,
    unit: 'cells/μL'
  },
  
  // Platelets - cells/μL
  platelets: {
    min: 150000,
    max: 450000,
    unit: 'cells/μL'
  },
  
  // Hematocrit (%)
  hematocrit: {
    male: { min: 40, max: 50 },
    female: { min: 36, max: 46 },
    unit: '%'
  },
  
  // Mean Corpuscular Volume (MCV) - fL
  mcv: {
    min: 80,
    max: 100,
    unit: 'fL'
  },
  
  // Mean Corpuscular Hemoglobin (MCH) - pg
  mch: {
    min: 27,
    max: 33,
    unit: 'pg'
  },
  
  // Mean Corpuscular Hemoglobin Concentration (MCHC) - g/dL
  mchc: {
    min: 32,
    max: 36,
    unit: 'g/dL'
  },
  
  // Red Cell Distribution Width (RDW) - %
  rdw: {
    min: 11.5,
    max: 14.5,
    unit: '%'
  }
};

/**
 * Get reference range for a parameter
 * @param {string} parameter - Parameter name (e.g., 'hemoglobin')
 * @param {string} gender - 'male' or 'female' (optional, for gender-specific ranges)
 * @returns {Object} Reference range object with min, max, and unit
 */
const getReferenceRange = (parameter, gender = null) => {
  const range = referenceRanges[parameter.toLowerCase()];
  
  if (!range) {
    return null;
  }
  
  // If range is gender-specific
  if (range.male && range.female) {
    if (gender && (gender.toLowerCase() === 'male' || gender.toLowerCase() === 'm')) {
      return { ...range.male, unit: range.unit };
    } else if (gender && (gender.toLowerCase() === 'female' || gender.toLowerCase() === 'f')) {
      return { ...range.female, unit: range.unit };
    }
    // Default to male range if gender not specified
    return { ...range.male, unit: range.unit };
  }
  
  // If range is not gender-specific
  return range;
};

/**
 * Check if a value is within normal range
 * @param {string} parameter - Parameter name
 * @param {number} value - Value to check
 * @param {string} gender - Gender (optional)
 * @returns {Object} Status object with isNormal, flag, and severity
 */
const checkValue = (parameter, value, gender = null) => {
  const range = getReferenceRange(parameter, gender);
  
  if (!range) {
    return {
      isNormal: null,
      flag: 'UNKNOWN',
      severity: 'unknown',
      message: `No reference range found for ${parameter}`
    };
  }
  
  const min = range.min;
  const max = range.max;
  
  if (value < min) {
    const deviation = ((min - value) / min) * 100;
    let severity = 'mild';
    
    if (deviation > 30) {
      severity = 'critical';
    } else if (deviation > 15) {
      severity = 'moderate';
    }
    
    return {
      isNormal: false,
      flag: 'LOW',
      severity,
      message: `${parameter} is below normal range (${min}-${max} ${range.unit})`,
      referenceRange: { min, max, unit: range.unit },
      value,
      deviation: deviation.toFixed(2) + '%'
    };
  } else if (value > max) {
    const deviation = ((value - max) / max) * 100;
    let severity = 'mild';
    
    if (deviation > 30) {
      severity = 'critical';
    } else if (deviation > 15) {
      severity = 'moderate';
    }
    
    return {
      isNormal: false,
      flag: 'HIGH',
      severity,
      message: `${parameter} is above normal range (${min}-${max} ${range.unit})`,
      referenceRange: { min, max, unit: range.unit },
      value,
      deviation: deviation.toFixed(2) + '%'
    };
  } else {
    return {
      isNormal: true,
      flag: 'NORMAL',
      severity: 'normal',
      message: `${parameter} is within normal range (${min}-${max} ${range.unit})`,
      referenceRange: { min, max, unit: range.unit },
      value
    };
  }
};

module.exports = {
  referenceRanges,
  getReferenceRange,
  checkValue
};

