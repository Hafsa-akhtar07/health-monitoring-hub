const express = require('express');
const { query } = require('../config/database');

const router = express.Router();

/**
 * POST /api/reports
 * Save manually entered CBC report
 */
router.post('/', async (req, res) => {
  try {
    const { cbcData, userId } = req.body;

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

    // Save report to database
    const result = await query(
      `INSERT INTO reports (user_id, extracted_data, created_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP)
       RETURNING id, created_at`,
      [userId || null, JSON.stringify(cbcData)]
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
 * Get all reports (with optional pagination)
 */
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // Get total count
    const countResult = await query('SELECT COUNT(*) FROM reports');
    const total = parseInt(countResult.rows[0].count);

    // Get reports
    const result = await query(
      `SELECT id, user_id, filename, extracted_data, created_at
       FROM reports
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
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
 * Get a specific report by ID
 */
router.get('/:id', async (req, res) => {
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
       WHERE r.id = $1`,
      [reportId]
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
 * Delete a report by ID
 */
router.delete('/:id', async (req, res) => {
  try {
    const reportId = parseInt(req.params.id);

    if (isNaN(reportId)) {
      return res.status(400).json({
        error: 'Invalid report ID',
        message: 'Report ID must be a number'
      });
    }

    // Check if report exists
    const checkResult = await query('SELECT id, file_path FROM reports WHERE id = $1', [reportId]);
    
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

module.exports = router;

