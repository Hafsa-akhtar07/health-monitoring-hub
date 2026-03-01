const { checkValue } = require('./referenceRanges');

/**
 * Rule-based detection service
 * Analyzes CBC values against reference ranges and flags abnormalities
 */

/**
 * Analyze CBC data and detect abnormalities
 * @param {Object} cbcData - CBC data object
 * @param {string} gender - Gender ('male' or 'female') for gender-specific ranges
 * @returns {Object} Analysis results with detected abnormalities
 */
const analyzeCBC = (cbcData, gender = null) => {
  const results = {
    parameters: {},
    abnormalities: [],
    overallSeverity: 'normal',
    summary: {
      totalParameters: 0,
      normalCount: 0,
      abnormalCount: 0,
      criticalCount: 0
    }
  };

  // List of CBC parameters to check
  const parameters = [
    'hemoglobin',
    'rbc',
    'wbc',
    'platelets',
    'hematocrit',
    'mcv',
    'mch',
    'mchc',
    'rdw'
  ];

  // Check each parameter
  parameters.forEach(param => {
    if (cbcData[param] !== undefined && cbcData[param] !== null) {
      const value = parseFloat(cbcData[param]);
      
      if (!isNaN(value)) {
        const check = checkValue(param, value, gender);
        
        results.parameters[param] = {
          value,
          ...check
        };
        
        results.summary.totalParameters++;
        
        if (check.isNormal) {
          results.summary.normalCount++;
        } else {
          results.summary.abnormalCount++;
          results.abnormalities.push({
            parameter: param,
            value,
            flag: check.flag,
            severity: check.severity,
            message: check.message,
            referenceRange: check.referenceRange
          });
          
          if (check.severity === 'critical') {
            results.summary.criticalCount++;
          }
        }
      }
    }
  });

  // Determine overall severity
  if (results.summary.criticalCount > 0) {
    results.overallSeverity = 'critical';
  } else if (results.summary.abnormalCount > 0) {
    results.overallSeverity = 'abnormal';
  } else {
    results.overallSeverity = 'normal';
  }

  // Generate summary message
  if (results.summary.abnormalCount === 0) {
    results.summaryMessage = 'All CBC parameters are within normal range.';
  } else if (results.summary.criticalCount > 0) {
    results.summaryMessage = `⚠️ Critical: ${results.summary.criticalCount} parameter(s) show critical abnormalities. Please consult a healthcare provider immediately.`;
  } else {
    results.summaryMessage = `⚠️ Warning: ${results.summary.abnormalCount} parameter(s) are outside normal range. Consider consulting a healthcare provider.`;
  }

  return results;
};

/**
 * Get severity color for UI display
 * @param {string} severity - Severity level
 * @returns {string} Color code
 */
const getSeverityColor = (severity) => {
  const colors = {
    normal: '#10b981',    // green
    mild: '#f59e0b',     // yellow
    moderate: '#f97316', // orange
    critical: '#ef4444', // red
    abnormal: '#f59e0b', // yellow
    unknown: '#6b7280'   // gray
  };
  
  return colors[severity] || colors.unknown;
};

module.exports = {
  analyzeCBC,
  getSeverityColor
};

