const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');
const { validateExtractedData } = require('../services/ocrService');
const { query } = require('../config/database');

const router = express.Router();

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
    const ocrServiceUrl = process.env.OCR_SERVICE_URL || 'http://localhost:5002';
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
      maxBodyLength: Infinity
    });

    if (response.data && response.data.success) {
      console.log(`✅ Python OCR service successful: ${response.data.total_detections} text detections`);
      
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
        structured_data: response.data.ocr_result || {} // Full structured data from universal parser
      };
    } else {
      throw new Error(response.data?.error || 'OCR extraction failed');
    }
    
  } catch (error) {
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      console.error('❌ Python OCR service not available:', error.message);
      throw new Error('Python OCR service is not running. Please start it: cd backend/ocr-service && python app.py');
    }
    console.error('❌ Python OCR service error:', error.message);
    throw error;
  }
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
      /plt[\s:]*(\d+\.?\d*)/gi
    ],
    rbc: [
      /(?:r\.?\s*b\.?\s*c\.?|rbc|red\s*blood\s*cells?|total\s*r\.?\s*b\.?\s*c\.?|erythrocytes)[\s:]*[=\-\s]*(\d+\.?\d*)/gi,
      /(?:r\.?\s*b\.?\s*c\.?\s*count)[\s:]*[=\-\s]*(\d+\.?\d*)/gi,
      /(\d+\.?\d*)\s*(?:×?10⁶\/µl|million\/µl|m\/µl)?\s*(?:r\.?\s*b\.?\s*c\.?|rbc|red\s*blood)/gi,
      /rbc[\s:]*(\d+\.?\d*)/gi,
      /r\.?\s*b\.?\s*c\.?[\s:]*(\d+\.?\d*)/gi
    ],
    hematocrit: [
      /(?:hematocrit|haematocrit|hct|h\.?\s*c\.?\s*t\.?|pcv|packed\s*cell\s*volume)[\s:]*[=\-\s]*(\d+\.?\d*)/gi,
      /(\d+\.?\d*)\s*%?\s*(?:hematocrit|hct)/gi,
      /hct[\s:]*(\d+\.?\d*)/gi
    ],
    mcv: [
      /(?:mcv|m\.?\s*c\.?\s*v\.?|mean\s*corpuscular\s*volume)[\s:]*[=\-\s]*(\d+\.?\d*)/gi,
      /(\d+\.?\d*)\s*(?:fl|femtoliters?)?\s*(?:mcv)/gi,
      /mcv[\s:]*(\d+\.?\d*)/gi
    ],
    mch: [
      /(?:mch|m\.?\s*c\.?\s*h\.?|mean\s*corpuscular\s*hemoglobin)[\s:]*[=\-\s]*(\d+\.?\d*)/gi,
      /(\d+\.?\d*)\s*(?:pg|picograms?)?\s*(?:mch)/gi,
      /mch[\s:]*(\d+\.?\d*)/gi
    ],
    mchc: [
      /(?:mchc|m\.?\s*c\.?\s*h\.?\s*c\.?|mean\s*corpuscular\s*hemoglobin\s*concentration)[\s:]*[=\-\s]*(\d+\.?\d*)/gi,
      /(\d+\.?\d*)\s*(?:g\/dl)?\s*(?:mchc)/gi,
      /mchc[\s:]*(\d+\.?\d*)/gi
    ],
    rdw: [
      /(?:rdw|r\.?\s*d\.?\s*w\.?|red\s*cell\s*distribution\s*width)[\s:]*[=\-\s]*(\d+\.?\d*)/gi,
      /(\d+\.?\d*)\s*%?\s*(?:rdw)/gi,
      /rdw[\s:]*(\d+\.?\d*)/gi
    ]
  };
  
  // Extract values using multiple patterns
  for (const [key, patternList] of Object.entries(patterns)) {
    for (const pattern of patternList) {
      pattern.lastIndex = 0; // Reset regex
      const match = pattern.exec(textLower);
      if (match && match[1]) {
        const value = parseFloat(match[1]);
        if (!isNaN(value) && value > 0) {
          // Unit conversions
          if (key === 'wbc') {
            // WBC: if value is < 10, it's likely in ×10³/µL format, convert to absolute
            if (value < 10 && value > 0.1) {
              values[key] = value * 1000;
              console.log(`✅ Found ${key}: ${value} → ${values[key]} (converted from ×10³/µL)`);
            } else {
              values[key] = value;
              console.log(`✅ Found ${key}: ${value}`);
            }
            } else if (key === 'rbc') {
              // RBC: valid physiological range roughly 2-8 (million/µL)
              if (value >= 0.5 && value <= 20) {
                values[key] = value;
                console.log(`✅ Found ${key}: ${value}`);
              } else {
                console.log(`⚠️ Skipping improbable ${key} value: ${value}`);
                continue;
              }
          } else if (key === 'platelets') {
            // Platelets: if value is < 100, it's likely in ×10³/µL format
            if (value < 100 && value > 10) {
              values[key] = value * 1000;
              console.log(`✅ Found ${key}: ${value} → ${values[key]} (converted from ×10³/µL)`);
            } else {
              values[key] = value;
              console.log(`✅ Found ${key}: ${value}`);
            }
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
 */
router.post('/', upload.single('file'), async (req, res) => {
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
        // Parse CBC values from OCR result
        const parsedData = parseCBCValues(ocrResult);
        
        // Get full structured data from OCR result (same format as ocr-code JSON files)
        const structuredData = ocrResult.ocr_result || {};
        
        // Combine extracted data with full structured data from universal parser
        extractedData = {
          ...parsedData.values,  // CBC values parsed from text
          ...structuredData,     // Full structured data (patient_info, haematology_report, etc.)
          raw_ocr: ocrResult.ocr_result,
          all_text: parsedData.allText || ocrResult.all_text,
          total_detections: ocrResult.total_detections || 0,
          accuracy_percentage: ocrResult.accuracy_percentage,
          average_confidence: ocrResult.average_confidence,
          duration_seconds: ocrResult.duration_seconds,
          ocr_result: ocrResult.ocr_result  // Full JSON result (same as ocr-code output)
        };
        
        console.log(`✅ Python OCR extracted ${extractedData.total_detections} text blocks`);
        console.log(`📝 All text length: ${extractedData.all_text.length} characters`);
        
        // Display parsed values
        if (Object.keys(parsedData.values).length > 0) {
          console.log('📊 Parsed CBC Values:');
          Object.entries(parsedData.values).forEach(([key, value]) => {
            console.log(`  ✅ ${key}: ${value}`);
          });
        } else {
          console.log('⚠️ No CBC values extracted from OCR text');
          console.log('📄 First 500 chars of OCR text:');
          console.log(extractedData.all_text.substring(0, 500));
        }
      } else {
        throw new Error('OCR extraction failed - no data returned');
      }
      
    } catch (ocrError) {
      console.error('❌ OCR extraction error:', ocrError.message);
      
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
    const cbcParams = ['hemoglobin', 'rbc', 'wbc', 'platelets', 'hematocrit', 'mcv', 'mch', 'mchc', 'rdw'];
    
    cbcParams.forEach(param => {
      if (extractedData[param] !== undefined && extractedData[param] !== null) {
        console.log(`  ✅ ${param.toUpperCase().padEnd(15)}: ${extractedData[param]}`);
      } else {
        console.log(`  ❌ ${param.toUpperCase().padEnd(15)}: NOT FOUND`);
      }
    });
    console.log('='.repeat(80) + '\n');

    // Save report to database
    let reportId;
    try {
      const result = await query(
        `INSERT INTO reports (filename, file_path, extracted_data, created_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
         RETURNING id`,
        [req.file.originalname, filePath, JSON.stringify(extractedData)]
      );
      reportId = result.rows[0].id;
      console.log(`✅ Report saved to database with ID: ${reportId}`);
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