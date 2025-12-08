const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { extractCBCValues, validateExtractedData } = require('../services/ocrService');
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
  // Accept images and PDFs
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
 * POST /api/upload
 * Upload CBC report image/PDF and extract values via OCR
 */
router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'No file uploaded',
        message: 'Please upload a file'
      });
    }

    console.log('File uploaded:', req.file.filename);

    // Extract CBC values using OCR
    const filePath = req.file.path;
    let extractedData;
    
    try {
      extractedData = await extractCBCValues(filePath);
    } catch (ocrError) {
      console.error('OCR extraction error:', ocrError);
      // Clean up uploaded file
      fs.unlinkSync(filePath);
      return res.status(500).json({
        error: 'OCR extraction failed',
        message: 'Failed to extract values from the uploaded file. Please try manual entry.',
        details: process.env.NODE_ENV === 'development' ? ocrError.message : undefined
      });
    }

    // Validate extracted data
    const validation = validateExtractedData(extractedData);
    
    if (!validation.isValid) {
      // Clean up uploaded file
      fs.unlinkSync(filePath);
      return res.status(400).json({
        error: 'Invalid extracted data',
        message: 'Could not extract required CBC values from the file',
        details: validation.errors
      });
    }

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
    } catch (dbError) {
      console.error('Database error:', dbError);
      // Clean up uploaded file
      fs.unlinkSync(filePath);
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
  }
});

module.exports = router;

