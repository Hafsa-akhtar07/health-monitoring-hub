/**
 * Condition Detection Service
 * Maps CBC abnormalities to potential medical conditions
 */

/**
 * Detect potential conditions based on CBC abnormalities
 * @param {Object} ruleBasedResults - Results from rule-based detection
 * @param {Object} cbcData - Original CBC data
 * @param {string} gender - Patient gender
 * @returns {Array} Array of detected conditions with confidence
 */
const detectConditions = (ruleBasedResults, cbcData, gender = null) => {
  const conditions = [];
  const abnormalities = ruleBasedResults.abnormalities || [];

  // Helper function to check if parameter is abnormal
  const isAbnormal = (paramName) => {
    return abnormalities.some(ab => ab.parameter === paramName);
  };

  const getParamValue = (paramName) => {
    return cbcData[paramName];
  };

  // Anemia detection
  if (isAbnormal('hemoglobin') || isAbnormal('rbc') || isAbnormal('hematocrit')) {
    const hb = getParamValue('hemoglobin');
    const rbc = getParamValue('rbc');
    const mcv = getParamValue('mcv');
    const mch = getParamValue('mch');
    const mchc = getParamValue('mchc');

    if (hb < 12 || (gender === 'male' && hb < 13)) {
      if (mcv && mcv < 80) {
        conditions.push({
          condition: 'Microcytic Anemia',
          possibleCauses: ['Iron deficiency', 'Thalassemia', 'Chronic disease'],
          severity: hb < 8 ? 'critical' : 'abnormal',
          confidence: 0.75,
          description: 'Low hemoglobin with small red blood cells (low MCV)'
        });
      } else if (mcv && mcv > 100) {
        conditions.push({
          condition: 'Macrocytic Anemia',
          possibleCauses: ['Vitamin B12 deficiency', 'Folate deficiency', 'Liver disease'],
          severity: hb < 8 ? 'critical' : 'abnormal',
          confidence: 0.75,
          description: 'Low hemoglobin with large red blood cells (high MCV)'
        });
      } else {
        conditions.push({
          condition: 'Normocytic Anemia',
          possibleCauses: ['Chronic disease', 'Blood loss', 'Hemolytic anemia'],
          severity: hb < 8 ? 'critical' : 'abnormal',
          confidence: 0.70,
          description: 'Low hemoglobin with normal-sized red blood cells'
        });
      }
    }
  }

  // Leukocytosis (High WBC)
  if (isAbnormal('wbc')) {
    const wbc = getParamValue('wbc');
    if (wbc > 11000) {
      conditions.push({
        condition: 'Leukocytosis',
        possibleCauses: ['Infection', 'Inflammation', 'Leukemia (rare)', 'Stress response'],
        severity: wbc > 30000 ? 'critical' : 'abnormal',
        confidence: 0.80,
        description: 'Elevated white blood cell count, often indicating infection or inflammation'
      });
    } else if (wbc < 4000) {
      conditions.push({
        condition: 'Leukopenia',
        possibleCauses: ['Viral infection', 'Bone marrow disorders', 'Autoimmune conditions', 'Medications'],
        severity: wbc < 2000 ? 'critical' : 'abnormal',
        confidence: 0.75,
        description: 'Low white blood cell count, may indicate infection or bone marrow issues'
      });
    }
  }

  // Thrombocytopenia (Low Platelets)
  if (isAbnormal('platelets')) {
    const platelets = getParamValue('platelets');
    if (platelets < 150000) {
      conditions.push({
        condition: 'Thrombocytopenia',
        possibleCauses: ['Immune thrombocytopenia', 'Medications', 'Bone marrow disorders', 'Viral infections'],
        severity: platelets < 50000 ? 'critical' : 'abnormal',
        confidence: 0.80,
        description: 'Low platelet count, may affect blood clotting ability'
      });
    } else if (platelets > 450000) {
      conditions.push({
        condition: 'Thrombocytosis',
        possibleCauses: ['Inflammation', 'Iron deficiency', 'Myeloproliferative disorders'],
        severity: 'abnormal',
        confidence: 0.70,
        description: 'Elevated platelet count'
      });
    }
  }

  // Iron deficiency indicators
  if (isAbnormal('mch') || isAbnormal('mchc')) {
    const mch = getParamValue('mch');
    const mchc = getParamValue('mchc');
    if ((mch && mch < 27) || (mchc && mchc < 32)) {
      conditions.push({
        condition: 'Iron Deficiency',
        possibleCauses: ['Dietary deficiency', 'Blood loss', 'Malabsorption'],
        severity: 'abnormal',
        confidence: 0.75,
        description: 'Low mean corpuscular hemoglobin, suggesting iron deficiency'
      });
    }
  }

  // If no specific conditions detected but abnormalities exist
  if (conditions.length === 0 && abnormalities.length > 0) {
    conditions.push({
      condition: 'CBC Abnormalities Detected',
      possibleCauses: ['Requires further investigation'],
      severity: ruleBasedResults.overallSeverity,
      confidence: 0.60,
      description: 'Some CBC parameters are outside normal range. Further evaluation recommended.'
    });
  }

  // If everything is normal
  if (conditions.length === 0) {
    conditions.push({
      condition: 'Normal CBC',
      possibleCauses: [],
      severity: 'normal',
      confidence: 0.95,
      description: 'All CBC parameters are within normal range'
    });
  }

  return conditions;
};

module.exports = {
  detectConditions
};

