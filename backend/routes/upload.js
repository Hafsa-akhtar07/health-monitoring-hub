const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');
const { validateExtractedData } = require('../services/ocrService');
const { query } = require('../config/database');
const authenticate = require('../middleware/auth');
const { logError, logSuccess } = require('../services/logger');

const router = express.Router();

/** Canonical CBC keys in display / API order (always returned under `cbc_parameters`). */
const STANDARD_CBC_PARAMS = [
  'hemoglobin',
  'hematocrit',
  'rbc',
  'wbc',
  'platelets',
  'mcv',
  'rdw',
  'mch',
  'mchc',
  'neutrophils',
  'lymphocytes',
  'monocytes',
  'eosinophils',
  'basophils'
];

/**
 * Build a fixed 14-key map: number when extracted, null when missing.
 * Reads scalar CBC fields from the merged upload payload object.
 */
function buildCbcParameterMap(mergedRoot) {
  const map = {};
  for (const key of STANDARD_CBC_PARAMS) {
    const v = mergedRoot[key];
    if (v !== undefined && v !== null && v !== '' && typeof v === 'number' && !Number.isNaN(v)) {
      map[key] = v;
    } else if (v !== undefined && v !== null && v !== '' && typeof v !== 'number') {
      const n = parseFloat(v);
      map[key] = !Number.isNaN(n) ? n : null;
    } else {
      map[key] = null;
    }
  }
  return map;
}

/**
 * Map Python OCR `cbc_fourteen` (found / observed_value / unit / test_name) to top-level numeric fields.
 * No unit conversion — values are what the Python service extracted for display.
 */
function buildScalarsFromCbcFourteen(cbcFourteen) {
  const out = {};
  if (!cbcFourteen || typeof cbcFourteen !== 'object') {
    return out;
  }
  for (const key of STANDARD_CBC_PARAMS) {
    const cell = cbcFourteen[key];
    if (cell && cell.found && cell.observed_value !== null && cell.observed_value !== '') {
      const n = parseFloat(String(cell.observed_value).trim());
      out[key] = Number.isNaN(n) ? null : n;
    }
  }
  return out;
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads');
    // Create uploads directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, and PDF files are allowed.'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: fileFilter
});

/**
 * Call local Python OCR service
 */
async function callPythonOCRService(imagePath, originalFilename) {
  try {
    // Use 127.0.0.1 (not "localhost") so Node does not connect via IPv6 ::1 while Flask listens on IPv4 only.
    const ocrServiceUrl = process.env.OCR_SERVICE_URL || 'http://127.0.0.1:5002';
    console.log(`📤 Calling Python OCR service at ${ocrServiceUrl}/api/extract...`);
    
    const form = new FormData();
    form.append('file', fs.createReadStream(imagePath), {
      filename: originalFilename,
      contentType: 'image/jpeg'
    });

    const response = await axios.post(`${ocrServiceUrl}/api/extract`, form, {
      headers: form.getHeaders(),
      timeout: 300000, // 5 minute timeout for OCR (PaddleOCR can be slow on first run)
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      proxy: false // avoid HTTP(S)_PROXY sending local traffic through a proxy
    });

    if (response.data && response.data.success) {
      console.log(`✅ Python OCR service successful: ${response.data.total_detections} text detections`);
      
      // Log success to logger
      logSuccess(originalFilename, {
        accuracy_percentage: response.data.accuracy_percentage,
        total_detections: response.data.total_detections,
        average_confidence: response.data.average_confidence,
        duration_seconds: response.data.duration_seconds
      });
      
      // Log the full JSON result to console with accuracy
      console.log('\n' + '='.repeat(80));
      console.log('📊 OCR EXTRACTION RESULT (JSON)');
      console.log('='.repeat(80));
      if (response.data.accuracy_percentage !== undefined) {
        console.log(`📈 OCR Accuracy: ${response.data.accuracy_percentage.toFixed(2)}% (Avg Confidence: ${response.data.average_confidence?.toFixed(4) || 0})`);
        console.log(`📝 Total Detections: ${response.data.total_detections || 0}`);
        if (response.data.duration_seconds !== undefined) {
          console.log(`⏱️ Duration: ${response.data.duration_seconds.toFixed(2)} seconds`);
        }
        console.log('='.repeat(80));
      }
      console.log(JSON.stringify(response.data.ocr_result, null, 2));
      console.log('='.repeat(80) + '\n');
      
      return {
        success: true,
        ocr_result: response.data.ocr_result || {},
        all_text: response.data.all_text || '',
        total_detections: response.data.total_detections || 0,
        accuracy_percentage: response.data.accuracy_percentage,
        average_confidence: response.data.average_confidence,
        duration_seconds: response.data.duration_seconds,
        raw_response: response.data,
        structured_data: response.data.structured_data || {},
        cbc_fourteen: response.data.cbc_fourteen || null,
        ocr_pass_used: response.data.ocr_pass_used,
        ocr_compare: response.data.ocr_compare,
        processed_at: response.data.processed_at,
        structured_data_original: response.data.structured_data_original,
        structured_data_preprocessed: response.data.structured_data_preprocessed
      };
    } else {
      throw new Error(response.data?.error || 'OCR extraction failed');
    }
    
  } catch (error) {
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      const errorMsg = 'Python OCR service is not running. Please start it: cd backend/ocr-service && python app.py';
      console.error('❌ Python OCR service not available:', error.message);
      // Let the outer upload handler log the OCR failure once.
      const mappedError = new Error(errorMsg);
      mappedError.code = error.code; // preserve axios error code for outer handler
      throw mappedError;
    }
    console.error('❌ Python OCR service error:', error.message);
    throw error;
  }
}

/**
 * Normalize units for CBC parameters to standard format
 * Standard units: WBC/RBC/Platelets (absolute counts), Hemoglobin (g/dL), etc.
 */
function normalizeCBCUnits(structuredData, regexValues) {
  const normalized = { ...regexValues };
  
  // Map test names to our parameter names (US spelling + common lab synonyms).
  const testNameMap = {
    'hemoglobin': ['hemoglobin', 'haemoglobin', 'hb', 'hgb'],
    'rbc': ['rbc', 'r.b.c', 'red blood cell', 'total r.b.c', 'total rbc', 'erythrocytes', 'erythrocyte'],
    'wbc': ['wbc', 'w.b.c', 'white blood cell', 'total w.b.c', 'total wbc', 'leukocytes', 'leukocyte',
      'tlc', 'total leucocyte count', 'total leukocyte count', 'total wbc count', 'leukocyte count', 'leucocyte count'],
    'platelets': ['platelet', 'platelets', 'plt', 'platelet count', 'thrombocytes', 'thrombocyte'],
    'hematocrit': ['hematocrit', 'haematocrit', 'hematrocrit', 'hct', 'h.c.t', 'pcv', 'packed cell volume', 'packed cell vol'],
    'mcv': ['mcv', 'm.c.v', 'mean corpuscular volume', 'mean cell volume'],
    'mch': ['mch', 'm.c.h', 'mean corpuscular hemoglobin', 'mean cell hemoglobin'],
    'mchc': ['mchc', 'm.c.h.c', 'mean corpuscular hemoglobin concentration', 'mean cell hemoglobin concentration'],
    'rdw': ['rdw', 'r.d.w', 'red cell distribution width'],
    'neutrophils': ['neutrophils', 'polymorphs', 'neutrophil', 'polymorph', 'segmented neutrophil', 'segmented neutrophils'],
    'lymphocytes': ['lymphocytes', 'lymphocyte'],
    'monocytes': ['monocytes', 'monocyte'],
    'eosinophils': ['eosinophils', 'eosinophil'],
    'basophils': ['basophils', 'basophil']
  };

  /** Avoid MCH matching MCHC rows (substring + “…hemoglobin concentration”). */
  const termMatchesStructuredRow = (paramName, term, testNameRaw) => {
    const testName = (testNameRaw || '').toLowerCase();
    const t = term.toLowerCase();
    if (!testName.includes(t)) return false;
    if (paramName === 'mch') {
      if (/\bmchc\b/i.test(testNameRaw || '')) return false;
      if ((/mean\s*corpuscular|mean\s*cell/i.test(testName)) && /conc/i.test(testName)) return false;
    }
    return true;
  };

  // Helper to find test in structured data
  const findTestInStructured = (paramName) => {
    const searchTerms = testNameMap[paramName] || [paramName.toLowerCase()];

    // Search in haematology_report
    if (structuredData.haematology_report && Array.isArray(structuredData.haematology_report)) {
      for (const test of structuredData.haematology_report) {
        if (searchTerms.some(term => termMatchesStructuredRow(paramName, term, test.test_name || ''))) {
          return test;
        }
      }
    }

    // Search in blood_indices
    if (structuredData.blood_indices && Array.isArray(structuredData.blood_indices)) {
      for (const test of structuredData.blood_indices) {
        if (searchTerms.some(term => termMatchesStructuredRow(paramName, term, test.test_name || ''))) {
          return test;
        }
      }
    }

    return null;
  };
  
  // MCHC before MCH: defense in depth (findTestInStructured also disambiguates).
  const paramsToNormalize = ['hemoglobin', 'rbc', 'wbc', 'platelets', 'hematocrit', 'mcv', 'mchc', 'mch', 'rdw',
    'neutrophils', 'lymphocytes', 'monocytes', 'eosinophils', 'basophils'];
  
  for (const param of paramsToNormalize) {
    const testData = findTestInStructured(param);
    
    if (testData && testData.observed_value) {
      const rawValue = parseFloat(testData.observed_value);
      if (isNaN(rawValue)) continue;
      
      const unit = (testData.unit || '').toLowerCase();
      let normalizedValue = rawValue;
      
      // Normalize based on parameter and unit
      if (param === 'wbc') {
        // WBC: Convert to cells/µL (absolute count)
        if (unit.includes('thou') || unit.includes('thou/mm')) {
          normalizedValue = rawValue * 1000;
          console.log(`🔄 Normalized ${param}: ${rawValue} ${unit} → ${normalizedValue} cells/µL (thou/mm³)`);
        } else if (unit.includes('×10³') || unit.includes('x10³') || unit.includes('10^3') ||
            unit.includes('k/') || unit.includes('k/ul') || unit.includes('k/µl')) {
          normalizedValue = rawValue * 1000;
          console.log(`🔄 Normalized ${param}: ${rawValue} ${unit} → ${normalizedValue} cells/µL`);
        } else if (unit.includes('/ul') || unit.includes('/µl') || unit.includes('/cumm') || unit.includes('/cmm')) {
          normalizedValue = rawValue; // Already in absolute count
        } else if (rawValue < 10 && rawValue > 1.5) {
          // Likely in ×10³ format without explicit unit (exclude 1.0–1.5: common OCR false positives)
          normalizedValue = rawValue * 1000;
          console.log(`🔄 Normalized ${param}: ${rawValue} (assumed ×10³) → ${normalizedValue} cells/µL`);
        }
      } else if (param === 'rbc') {
        // RBC: Keep in million/µL (standard format)
        // Some reports might show absolute count, but standard is million/µL
        if (unit.includes('million') || unit.includes('mill')) {
          normalizedValue = rawValue; // Already correct
        } else if (rawValue > 1000) {
          // Likely absolute count, convert to million
          normalizedValue = rawValue / 1000000;
          console.log(`🔄 Normalized ${param}: ${rawValue} (absolute) → ${normalizedValue} million/µL`);
        }
      } else if (param === 'platelets') {
        // Platelets: Convert to cells/µL (absolute count)
        if (unit.includes('thou') || unit.includes('thou/mm')) {
          normalizedValue = rawValue * 1000;
          console.log(`🔄 Normalized ${param}: ${rawValue} ${unit} → ${normalizedValue} cells/µL (thou/mm³)`);
        } else if (unit.includes('lakhs') || unit.includes('lakh')) {
          // 1 Lakh = 100,000
          normalizedValue = rawValue * 100000;
          console.log(`🔄 Normalized ${param}: ${rawValue} Lakhs → ${normalizedValue} cells/µL`);
        } else if (unit.includes('×10³') || unit.includes('x10³') || unit.includes('10^3') || 
                   unit.includes('k/') || unit.includes('k/ul') || unit.includes('k/µl')) {
          normalizedValue = rawValue * 1000;
          console.log(`🔄 Normalized ${param}: ${rawValue} ${unit} → ${normalizedValue} cells/µL`);
        } else if (
          // Reports often show platelet as x10^9/L or x10e9/L.
          // 1 x10^9/L == 1000 cells/µL.
          unit.includes('x10^9') || unit.includes('x10e9') || unit.includes('10^9') || unit.includes('10e9')
        ) {
          normalizedValue = rawValue * 1000;
          console.log(`🔄 Normalized ${param}: ${rawValue} ${unit} → ${normalizedValue} cells/µL`);
        } else if (rawValue < 100 && rawValue > 10 && !unit.includes('/ul') && !unit.includes('/cumm')) {
          // Likely in ×10³ format without explicit unit
          normalizedValue = rawValue * 1000;
          console.log(`🔄 Normalized ${param}: ${rawValue} (assumed ×10³) → ${normalizedValue} cells/µL`);
        } else if (unit.includes('/ul') || unit.includes('/µl') || unit.includes('/cumm') || unit.includes('/cmm')) {
          normalizedValue = rawValue; // Already in absolute count
        }
      } else if (['neutrophils', 'lymphocytes', 'monocytes', 'eosinophils', 'basophils'].includes(param)) {
        // WBC differentials: Usually in %, but sometimes absolute count
        if (unit.includes('%') || unit === '') {
          normalizedValue = rawValue; // Keep as percentage
        } else if (unit.includes('/ul') || unit.includes('/µl') || unit.includes('/cumm')) {
          normalizedValue = rawValue; // Absolute count (keep as is)
        }
      }
      // For other params (hemoglobin, hematocrit, mcv, mch, mchc, rdw), units are usually standard
      
      normalized[param] = normalizedValue;
    }
  }
  
  return normalized;
}

/**
 * Parse CBC values from OCR text
 * Handles both Python OCR service format and raw text strings
 */
function parseCBCValues(ocrResult) {
  const values = {};
  let allText = '';
  
  // Handle different input formats
  if (typeof ocrResult === 'string') {
    // Direct text string
    allText = ocrResult;
  } else if (ocrResult && ocrResult.all_text) {
    // Python OCR service format with all_text
    allText = ocrResult.all_text;
  } else if (Array.isArray(ocrResult)) {
    // Array of OCR detections
    ocrResult.forEach(item => {
      if (item && typeof item === 'object') {
        const text = (item.text || item.words || '').trim();
        if (text) {
          allText += text + '\n';
        }
      } else if (typeof item === 'string') {
        allText += item.trim() + '\n';
      }
    });
  } else if (ocrResult && ocrResult.ocr_result) {
    // Python OCR service format - ocr_result can be object or array
    if (Array.isArray(ocrResult.ocr_result)) {
      // Array format
      ocrResult.ocr_result.forEach(item => {
        if (item && item.text) {
          allText += item.text.trim() + '\n';
        }
      });
    }
    // Also use all_text if available (preferred)
    if (ocrResult.all_text) {
      allText = ocrResult.all_text;
    }
  }
  
  if (allText && allText.length > 0) {
    console.log('📄 OCR Text for parsing (first 500 chars):');
    console.log(allText.substring(0, Math.min(500, allText.length)));
  } else {
    console.log('⚠️ No OCR text extracted!');
    console.log('📦 ocrResult structure:', Object.keys(ocrResult || {}));
  }
  
  const textLower = allText.toLowerCase();
  
  // Enhanced pattern matching for CBC values
  // Try multiple patterns for each parameter to handle various formats
  const patterns = {
    hemoglobin: [
      /(?:hemoglobin|haemoglobin|hb|hgb|hb\s*\(?g\/dl\)?)[\s:]*[=\-\s]*(\d+\.?\d*)/gi,
      /(\d+\.?\d*)\s*(?:g\/dl|g\/dL|gdl)?\s*(?:hemoglobin|haemoglobin|hb|hgb)/gi,
      /hb[\s:]*(\d+\.?\d*)/gi
    ],
    wbc: [
      /total\s*wbc\s*count[\s:]*[=\-\s]*(\d{4,6})\b/gi,
      /total\s*leucocyte\s*count[\s:]*[=\-\s]*(\d{4,6})\b/gi,
      /total\s*leukocyte\s*count[\s:]*[=\-\s]*(\d+\.?\d*)/gi,
      /total\s*leucocyte\s*count[\s:]*[=\-\s]*(\d+\.?\d*)/gi,
      /(?:\btlc\b|total\s*leukocyte|total\s*leucocyte)[\s:()]*[=\-\s]*(\d+\.?\d*)/gi,
      /(?:w\.?\s*b\.?\s*c\.?|wbc|white\s*blood\s*cells?|total\s*w\.?\s*b\.?\s*c\.?|leukocytes|tlc)[\s:]*[=\-\s]*(\d+\.?\d*)/gi,
      /(?:w\.?\s*b\.?\s*c\.?\s*count)[\s:]*[=\-\s]*(\d+\.?\d*)/gi,
      /(\d+\.?\d*)\s*(?:×?10³\/µl|k\/µl|k\/ul|per\s*µl|\/ul)?\s*(?:w\.?\s*b\.?\s*c\.?|wbc|white\s*blood)/gi,
      /wbc[\s:]*(\d+\.?\d*)/gi,
      /w\.?\s*b\.?\s*c\.?[\s:]*(\d+\.?\d*)/gi
    ],
    platelets: [
      /(?:platelets?|plt|platelet\s*count|thrombocytes)[\s:]*[=\-\s]*(\d+\.?\d*)/gi,
      /(\d+\.?\d*)\s*(?:×?10³\/µl|k\/µl|k\/ul|per\s*µl)?\s*(?:platelets|plt)/gi,
      /platelets?[\s:]*(\d+\.?\d*)/gi,
      /plt[\s:]*(\d+\.?\d*)/gi,
      // Fallback for PARTH-style format: "Basophils : 1.28 Lakhs /cmm ... PLATELET COUNT"
      /(\d+\.?\d*)\s*lakhs?\s*\/cmm[^\n]*platelet\s*count/gi
    ],
    rbc: [
      /(?:r\.?\s*b\.?\s*c\.?|rbc|red\s*blood\s*cells?|total\s*r\.?\s*b\.?\s*c\.?|erythrocytes)[\s:]*[=\-\s]*(\d+\.?\d*)/gi,
      /(?:r\.?\s*b\.?\s*c\.?\s*count)[\s:]*[=\-\s]*(\d+\.?\d*)/gi,
      /(\d+\.?\d*)\s*(?:×?10⁶\/µl|million\/µl|m\/µl)?\s*(?:r\.?\s*b\.?\s*c\.?|rbc|red\s*blood)/gi,
      /rbc[\s:]*(\d+\.?\d*)/gi,
      /r\.?\s*b\.?\s*c\.?[\s:]*(\d+\.?\d*)/gi
    ],
    hematocrit: [
      /(?:hematocrit|haematocrit|hematrocrit|hct|h\.?\s*c\.?\s*t\.?|pcv|packed\s*cell\s*vol(?:ume)?)[\s:]*[=\-\s]*(\d+\.?\d*)/gi,
      /(\d+\.?\d*)\s*%?\s*(?:hematocrit|hematrocrit|hct)/gi,
      /hct[\s:]*(\d+\.?\d*)/gi
    ],
    mcv: [
      /(?:mcv|m\.?\s*c\.?\s*v\.?|mean\s*corpuscular\s*volume|mean\s*cell\s*volume)[\s:]*[=\-\s]*(\d+\.?\d*)/gi,
      /(\d+\.?\d*)\s*(?:fl|femtoliters?)?\s*(?:mcv)/gi,
      /mcv[\s:]*(\d+\.?\d*)/gi
    ],
    mch: [
      /(?:mean\s*corpuscular\s*h[ae]moglobin(?!\s*conc)|mean\s*cell\s*h[ae]moglobin(?!\s*conc)|\bmch\b(?!\s*c)|m\.?\s*c\.?\s*h\.?\b(?!\s*c))[\s:]*[=\-\s]*(\d+\.?\d*)/gi,
      /(\d+\.?\d*)\s*(?:pg|picograms?)?\s*(?:\bmch\b)/gi,
      /\bmch\b[\s:]*(\d+\.?\d*)/gi
    ],
    mchc: [
      /(?:mean\s*corpuscular\s*h[ae]moglobin\s*conc(?:entration)?|mean\s*cell\s*h[ae]moglobin\s*conc(?:entration)?|\bmchc\b|m\.?\s*c\.?\s*h\.?\s*c\.?\b)[\s:]*[=\-\s]*(\d+\.?\d*)/gi,
      /(\d+\.?\d*)\s*(?:g\/dl)?\s*(?:\bmchc\b)/gi,
      /\bmchc\b[\s:]*(\d+\.?\d*)/gi
    ],
    rdw: [
      /rdw\s*[-–]\s*cv[\s:]*[=\-\s]*(\d+\.?\d*)/gi,
      /rdw\s*[-–]\s*sd[\s:]*[=\-\s]*(\d+\.?\d*)/gi,
      /(?:rdw|r\.?\s*d\.?\s*w\.?|red\s*cell\s*distribution\s*width)[\s:]*[=\-\s]*(\d+\.?\d*)/gi,
      /(\d+\.?\d*)\s*%?\s*(?:rdw)/gi,
      /rdw[\s:]*(\d+\.?\d*)/gi
    ],
    neutrophils: [
      // Handle DOW-style "NEUTROPHILS% 49 % 40-80" where '%' is directly after the keyword.
      /(?:(?:segmented\s*)?neutrophils?|polymorphs?|neutrophil|polymorph)[\s%:]*[=\-\s]*(\d+\.?\d*)/gi,
      /(\d+\.?\d*)\s*%?\s*(?:neutrophils?|polymorphs?)/gi
    ],
    lymphocytes: [
      /(?:lymphocytes?(?!\s*count)|lymphocyte\b)[\s%:]*[=\-\s]*(\d+\.?\d*)/gi,
      /(\d+\.?\d*)\s*%?\s*(?:lymphocytes?(?!\s*count))/gi
    ],
    monocytes: [
      /(?:monocytes?|monocyte)[\s%:]*[=\-\s]*(\d+\.?\d*)/gi,
      /(\d+\.?\d*)\s*%?\s*(?:monocytes?)/gi
    ],
    eosinophils: [
      /(?:eosinophils?|eosinophil)[\s%:]*[=\-\s]*(\d+\.?\d*)/gi,
      /(\d+\.?\d*)\s*%?\s*(?:eosinophils?)/gi
    ],
    basophils: [
      /(?:basophils?|basophil)[\s%:]*[=\-\s]*(\d+\.?\d*)/gi,
      /(\d+\.?\d*)\s*%?\s*(?:basophils?)/gi
    ]
  };
  
  // Extract values using multiple patterns
  for (const [key, patternList] of Object.entries(patterns)) {
    for (const pattern of patternList) {
      pattern.lastIndex = 0; // Reset regex
      const match = pattern.exec(textLower);
      if (match && match[1]) {
        const value = parseFloat(match[1]);
        const isDiffPercentKey = ['neutrophils', 'lymphocytes', 'monocytes', 'eosinophils', 'basophils'].includes(
          key
        );
        // Differential percentages can legitimately be 0%.
        const valueOk = !isNaN(value) && (isDiffPercentKey ? value >= 0 : value > 0);
        if (valueOk) {
          // Extract unit context from surrounding text for better normalization
          const matchContext = match[0].toLowerCase();
          const contextStart = Math.max(0, match.index - 50);
          const contextEnd = Math.min(textLower.length, match.index + match[0].length + 50);
          const contextText = textLower.substring(contextStart, contextEnd);
          
          // Unit conversions (will be further normalized by normalizeCBCUnits if structured data available)
          if (key === 'wbc') {
            const explicitThousand =
              contextText.includes('×10³') ||
              contextText.includes('x10³') ||
              contextText.includes('10^3') ||
              contextText.includes('k/ul') ||
              contextText.includes('k/µl') ||
              (contextText.includes('thou') && (contextText.includes('mm3') || contextText.includes('mm^3') || contextText.includes('mm³')));
            // Reject stray "1" (and similar) from OCR unless units say ×10³ (avoids 1 → 1000 false positive)
            if (!explicitThousand && value <= 1.5) {
              console.log(`⚠️ Skipping dubious WBC regex match: ${value} (no explicit ×10³/k/µl context)`);
              continue;
            }
            // WBC: Convert to cells/µL (absolute count)
            if (explicitThousand) {
              values[key] = value * 1000;
              console.log(`✅ Found ${key}: ${value} → ${values[key]} (converted from ×10³/µL)`);
            } else if (value < 10 && value > 1.5) {
              // Likely in ×10³ format without explicit unit
              values[key] = value * 1000;
              console.log(`✅ Found ${key}: ${value} → ${values[key]} (assumed ×10³/µL)`);
            } else {
              values[key] = value;
              console.log(`✅ Found ${key}: ${value}`);
            }
          } else if (key === 'rbc') {
            // RBC: Keep in million/µL (standard format)
            if (value >= 0.5 && value <= 20) {
              values[key] = value;
              console.log(`✅ Found ${key}: ${value}`);
            } else if (value > 1000) {
              // Likely absolute count, convert to million
              values[key] = value / 1000000;
              console.log(`✅ Found ${key}: ${value} → ${values[key]} (converted from absolute)`);
            } else {
              console.log(`⚠️ Skipping improbable ${key} value: ${value}`);
              continue;
            }
          } else if (key === 'platelets') {
            // Platelets: Convert to cells/µL (absolute count)
            if (contextText.includes('thou') && (contextText.includes('mm3') || contextText.includes('mm^3') || contextText.includes('mm³'))) {
              values[key] = value * 1000;
              console.log(`✅ Found ${key}: ${value} thou/mm³ → ${values[key]} cells/µL`);
            } else if (contextText.includes('lakhs') || contextText.includes('lakh')) {
              // e.g., "1.28 Lakhs /cmm" → 128000
              values[key] = value * 100000;
              console.log(`✅ Found ${key}: ${value} Lakhs → ${values[key]} cells/µL`);
            } else if (contextText.includes('×10³') || contextText.includes('x10³') || contextText.includes('10^3') || 
                       contextText.includes('k/ul') || contextText.includes('k/µl')) {
              values[key] = value * 1000;
              console.log(`✅ Found ${key}: ${value} → ${values[key]} (converted from ×10³/µL)`);
            } else if (value < 100 && value > 10) {
              // Likely ×10³/µL format without explicit unit
              values[key] = value * 1000;
              console.log(`✅ Found ${key}: ${value} → ${values[key]} (assumed ×10³/µL)`);
            } else {
              values[key] = value;
              console.log(`✅ Found ${key}: ${value}`);
            }
          } else if (['neutrophils', 'lymphocytes', 'monocytes', 'eosinophils', 'basophils'].includes(key)) {
            // WBC differentials: Usually in %, keep as is
            values[key] = value;
            console.log(`✅ Found ${key}: ${value}%`);
          } else {
            values[key] = value;
            console.log(`✅ Found ${key}: ${value}`);
          }
          break; // Stop after first successful match for this parameter
        }
      }
    }
  }
  
  console.log('📊 Extracted CBC values:', values);
  
  return {
    values,
    allText: allText.trim()
  };
}

/**
 * POST /api/upload
 * Upload CBC report image/PDF and extract values via Baidu PaddleOCR
 * Requires authentication
 */
router.post('/', authenticate, upload.single('file'), async (req, res) => {
  let filePath = null;
  
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'No file uploaded',
        message: 'Please upload a file'
      });
    }

    console.log('📁 File uploaded:', req.file.filename);
    filePath = req.file.path;

    // Extract using local Python OCR service
    let extractedData = {};
    
    try {
      // Call Python OCR service
      const ocrResult = await callPythonOCRService(filePath, req.file.originalname);
      
      if (ocrResult.success) {
        const raw = ocrResult.raw_response || {};
        const structuredData = ocrResult.structured_data || raw.structured_data || {};

        // Python OCR is the source of truth: pass through cbc_fourteen + structured_data as-is (no Node unit math).
        const cbcFourteen = ocrResult.cbc_fourteen != null ? ocrResult.cbc_fourteen : raw.cbc_fourteen;
        const cbcScalars = buildScalarsFromCbcFourteen(cbcFourteen);

        extractedData = {
          ...structuredData,
          ...cbcScalars,
          cbc_fourteen: cbcFourteen || null,
          ocr_pass_used: ocrResult.ocr_pass_used ?? raw.ocr_pass_used,
          ocr_compare: ocrResult.ocr_compare ?? raw.ocr_compare,
          processed_at: ocrResult.processed_at ?? raw.processed_at,
          structured_data_original: ocrResult.structured_data_original ?? raw.structured_data_original,
          structured_data_preprocessed: ocrResult.structured_data_preprocessed ?? raw.structured_data_preprocessed,
          raw_ocr: ocrResult.ocr_result,
          all_text: ocrResult.all_text || '',
          total_detections: ocrResult.total_detections || 0,
          accuracy_percentage: ocrResult.accuracy_percentage,
          average_confidence: ocrResult.average_confidence,
          duration_seconds: ocrResult.duration_seconds,
          ocr_result: ocrResult.ocr_result
        };
        extractedData.cbc_parameters = buildCbcParameterMap(extractedData);
        
        console.log(`✅ Python OCR extracted ${extractedData.total_detections} text blocks`);
        console.log(`📝 All text length: ${extractedData.all_text.length} characters`);
        console.log('📊 CBC (Python pass-through, cbc_fourteen) — full 14-parameter view:');
        STANDARD_CBC_PARAMS.forEach((param) => {
          const cell = cbcFourteen && cbcFourteen[param];
          const v = extractedData.cbc_parameters[param];
          const u = cell && cell.unit ? ` ${cell.unit}` : '';
          if (v !== null && v !== undefined) {
            console.log(`  ✅ ${param.toUpperCase().padEnd(15)}: ${v}${u}`);
          } else {
            console.log(`  ❌ ${param.toUpperCase().padEnd(15)}: NOT FOUND`);
          }
        });
      } else {
        throw new Error('OCR extraction failed - no data returned');
      }
      
    } catch (ocrError) {
      console.error('❌ OCR extraction error:', ocrError.message);
      
      // Log OCR error
      logError('ocr_error', req.file?.originalname || 'unknown', ocrError.message, {
        error_type: ocrError.name,
        error_code: ocrError.code,
        file_size: req.file?.size,
        file_mimetype: req.file?.mimetype
      });
      const io = req.app.get('io');
      if (io) io.emit('ocr:error', { message: 'OCR error logged' });

      if (ocrError.message.includes('not running')) {
        return res.status(503).json({
          error: 'OCR service unavailable',
          message: 'Python OCR service is not running. Please start it: cd backend/ocr-service && python app.py',
          details: process.env.NODE_ENV === 'development' ? ocrError.message : undefined
        });
      }
      
      return res.status(500).json({
        error: 'OCR extraction failed',
        message: 'Failed to extract values from the uploaded file. Please try manual entry.',
        details: process.env.NODE_ENV === 'development' ? ocrError.message : undefined
      });
    }

    // Validate extracted data
    console.log('🔍 Validating extracted data...');
    console.log('📦 ExtractedData keys:', Object.keys(extractedData));
    console.log('📝 Has all_text:', !!extractedData.all_text);
    console.log('📝 all_text length:', extractedData.all_text?.length || 0);
    
    const validation = validateExtractedData(extractedData);
    
    console.log('✅ Validation result:', {
      isValid: validation.isValid,
      errorsCount: validation.errors.length,
      warningsCount: validation.warnings.length
    });
    
    // Only reject if there are actual errors (not warnings)
    // Warnings are acceptable - user can manually enter missing values
    if (!validation.isValid && validation.errors.length > 0) {
      console.log('❌ Validation failed with errors:', validation.errors);
      
      // Log validation error
      logError('validation_error', req.file?.originalname || 'unknown', 'Validation failed', {
        errors: validation.errors,
        warnings: validation.warnings,
        extracted_keys: Object.keys(extractedData)
      });
      const ioValidation = req.app.get('io');
      if (ioValidation) ioValidation.emit('ocr:error', { message: 'Validation error logged' });

      return res.status(400).json({
        error: 'Invalid extracted data',
        message: 'Could not extract data from the file',
        details: validation.errors,
        warnings: validation.warnings
      });
    }
    
    // Log warnings if any
    if (validation.warnings && validation.warnings.length > 0) {
      console.log('⚠️ Validation warnings:');
      validation.warnings.forEach(warning => console.log(`  - ${warning}`));
    }

    // Display extracted data with accuracy
    console.log('\n' + '='.repeat(80));
    console.log('📊 EXTRACTED CBC DATA');
    if (extractedData.accuracy_percentage !== undefined) {
      console.log(`📈 OCR Accuracy: ${extractedData.accuracy_percentage.toFixed(2)}%`);
    }
    if (extractedData.duration_seconds !== undefined) {
      console.log(`⏱️ Duration: ${extractedData.duration_seconds.toFixed(2)} seconds`);
    }
    console.log('='.repeat(80));
    const summaryMap = extractedData.cbc_parameters || buildCbcParameterMap(extractedData);
    STANDARD_CBC_PARAMS.forEach((param) => {
      const v = summaryMap[param];
      if (v !== null && v !== undefined) {
        console.log(`  ✅ ${param.toUpperCase().padEnd(15)}: ${v}`);
      } else {
        console.log(`  ❌ ${param.toUpperCase().padEnd(15)}: NOT FOUND`);
      }
    });
    console.log('='.repeat(80) + '\n');

    // Save report to database (with authenticated user ID)
    let reportId;
    try {
      const result = await query(
        `INSERT INTO reports (user_id, filename, file_path, extracted_data, created_at)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
         RETURNING id`,
        [req.user.id, req.file.originalname, filePath, JSON.stringify(extractedData)]
      );
      reportId = result.rows[0].id;
      console.log(`✅ Report saved to database with ID: ${reportId} for user ${req.user.id}`);

      const io = req.app.get('io');
      if (io) {
        io.emit('report:uploaded', {
          reportId,
          userId: req.user.id,
          message: 'New report uploaded',
          filename: req.file.originalname,
        });
      }
    } catch (dbError) {
      console.error('Database error:', dbError);
      return res.status(500).json({
        error: 'Database error',
        message: 'Failed to save report to database'
      });
    }

    // Return success response
    res.status(200).json({
      success: true,
      message: 'File uploaded and processed successfully',
      reportId,
      extractedData,
      warnings: validation.warnings,
      fileInfo: {
        originalName: req.file.originalname,
        filename: req.file.filename,
        size: req.file.size,
        mimetype: req.file.mimetype
      }
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      error: 'Upload failed',
      message: 'An error occurred while processing the upload',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    // Clean up uploaded file
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
});

module.exports = router;