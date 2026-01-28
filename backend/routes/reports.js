const express = require('express');
const { query } = require('../config/database');
const authenticate = require('../middleware/auth');

const router = express.Router();

/**
 * POST /api/reports
 * Save manually entered CBC report
 * Requires authentication
 */
router.post('/', authenticate, async (req, res) => {
  try {
    const { cbcData } = req.body;

    if (!cbcData) {
      return res.status(400).json({
        error: 'Missing data',
        message: 'CBC data is required'
      });
    }

    // Validate required fields
    const requiredFields = ['hemoglobin', 'rbc', 'wbc', 'platelets'];
    const missingFields = requiredFields.filter(field => !cbcData[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: `The following fields are required: ${missingFields.join(', ')}`,
        missingFields
      });
    }

    // Save report to database (with authenticated user ID)
    const result = await query(
      `INSERT INTO reports (user_id, extracted_data, created_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP)
       RETURNING id, created_at`,
      [req.user.id, JSON.stringify(cbcData)]
    );

    const reportId = result.rows[0].id;

    res.status(201).json({
      success: true,
      message: 'Report saved successfully',
      reportId,
      cbcData,
      createdAt: result.rows[0].created_at
    });

  } catch (error) {
    console.error('Save report error:', error);
    res.status(500).json({
      error: 'Failed to save report',
      message: 'An error occurred while saving the report',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/reports
 * Get all reports for the authenticated user (with optional pagination)
 * Requires authentication
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // Get total count for this user
    const countResult = await query('SELECT COUNT(*) FROM reports WHERE user_id = $1', [req.user.id]);
    const total = parseInt(countResult.rows[0].count);

    // Get reports for this user only
    const result = await query(
      `SELECT id, user_id, filename, extracted_data, created_at
       FROM reports
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.user.id, limit, offset]
    );

    res.status(200).json({
      success: true,
      reports: result.rows.map(row => ({
        id: row.id,
        userId: row.user_id,
        filename: row.filename,
        cbcData: row.extracted_data,
        createdAt: row.created_at
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get reports error:', error);
    res.status(500).json({
      error: 'Failed to fetch reports',
      message: 'An error occurred while fetching reports',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/reports/:id
 * Get a specific report by ID (only if it belongs to the authenticated user)
 * Requires authentication
 */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const reportId = parseInt(req.params.id);

    if (isNaN(reportId)) {
      return res.status(400).json({
        error: 'Invalid report ID',
        message: 'Report ID must be a number'
      });
    }

    const result = await query(
      `SELECT r.id, r.user_id, r.filename, r.file_path, r.extracted_data, r.created_at,
              a.id as analysis_id, a.rule_based_results, a.ml_results, a.severity, a.created_at as analyzed_at
       FROM reports r
       LEFT JOIN analyses a ON r.id = a.report_id
       WHERE r.id = $1 AND r.user_id = $2`,
      [reportId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Report not found',
        message: `No report found with ID ${reportId}`
      });
    }

    const row = result.rows[0];

    res.status(200).json({
      success: true,
      report: {
        id: row.id,
        userId: row.user_id,
        filename: row.filename,
        filePath: row.file_path,
        cbcData: row.extracted_data,
        createdAt: row.created_at,
        analysis: row.analysis_id ? {
          id: row.analysis_id,
          ruleBasedResults: row.rule_based_results,
          mlResults: row.ml_results,
          severity: row.severity,
          analyzedAt: row.analyzed_at
        } : null
      }
    });

  } catch (error) {
    console.error('Get report error:', error);
    res.status(500).json({
      error: 'Failed to fetch report',
      message: 'An error occurred while fetching the report',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * DELETE /api/reports/:id
 * Delete a report by ID (only if it belongs to the authenticated user)
 * Requires authentication
 */
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const reportId = parseInt(req.params.id);

    if (isNaN(reportId)) {
      return res.status(400).json({
        error: 'Invalid report ID',
        message: 'Report ID must be a number'
      });
    }

    // Check if report exists and belongs to the user
    const checkResult = await query('SELECT id, file_path FROM reports WHERE id = $1 AND user_id = $2', [reportId, req.user.id]);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Report not found',
        message: `No report found with ID ${reportId}`
      });
    }

    // Delete associated file if exists
    const filePath = checkResult.rows[0].file_path;
    if (filePath) {
      const fs = require('fs');
      const path = require('path');
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (fileError) {
        console.error('Error deleting file:', fileError);
      }
    }

    // Delete report from database (cascade will delete analyses)
    await query('DELETE FROM reports WHERE id = $1', [reportId]);

    res.status(200).json({
      success: true,
      message: 'Report deleted successfully'
    });

  } catch (error) {
    console.error('Delete report error:', error);
    res.status(500).json({
      error: 'Failed to delete report',
      message: 'An error occurred while deleting the report',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/reports/anonymized
 * Get anonymized CBC data for research purposes (no user identifiers)
 * Requires authentication (admin/researcher access can be added later)
 */
router.get('/anonymized', authenticate, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;

    // Get reports with only CBC data, no user info
    const result = await query(
      `SELECT 
        r.id as report_id,
        r.extracted_data,
        r.created_at as report_date
      FROM reports r
      WHERE r.extracted_data IS NOT NULL
      ORDER BY r.created_at DESC
      LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    // Anonymize data - extract only CBC values, remove any identifying info
    const anonymizedData = result.rows.map(row => {
      const cbcData = row.extracted_data;
      const anonymized = {
        report_id: row.report_id, // Can be used for tracking but not linked to user
        report_date: row.report_date,
        // Extract only numeric CBC parameters
        hemoglobin: cbcData?.hemoglobin || null,
        rbc: cbcData?.rbc || null,
        wbc: cbcData?.wbc || null,
        platelets: cbcData?.platelets || null,
        hematocrit: cbcData?.hematocrit || null,
        mcv: cbcData?.mcv || null,
        mch: cbcData?.mch || null,
        mchc: cbcData?.mchc || null,
        rdw: cbcData?.rdw || null
      };
      return anonymized;
    });

    res.status(200).json({
      success: true,
      count: anonymizedData.length,
      data: anonymizedData,
      note: 'This data has been anonymized. No user identifiers, names, emails, or file paths are included.'
    });

  } catch (error) {
    console.error('Anonymized export error:', error);
    res.status(500).json({
      error: 'Failed to export anonymized data',
      message: 'An error occurred while exporting anonymized data',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;

