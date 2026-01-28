const express = require('express');
const { query } = require('../config/database');
const authenticate = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/history
 * Get patient history with all reports and analyses for the authenticated user
 * Query params: limit, page
 * Requires authentication
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const page = parseInt(req.query.page) || 1;
    const offset = (page - 1) * limit;

    // Get reports with analyses for authenticated user only
    const result = await query(
      `SELECT 
        r.id,
        r.user_id,
        r.filename,
        r.extracted_data,
        r.created_at,
        a.id as analysis_id,
        a.severity,
        a.rule_based_results,
        a.ml_results,
        a.created_at as analyzed_at
      FROM reports r
      LEFT JOIN analyses a ON r.id = a.report_id
      WHERE r.user_id = $1
      ORDER BY r.created_at DESC
      LIMIT $2 OFFSET $3`,
      [req.user.id, limit, offset]
    );

    // Get total count for this user
    const countResult = await query(
      `SELECT COUNT(*) FROM reports r WHERE r.user_id = $1`,
      [req.user.id]
    );
    const total = parseInt(countResult.rows[0].count);

    // Format response
    const reports = result.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      filename: row.filename,
      cbcData: row.extracted_data,
      createdAt: row.created_at,
      analysis: row.analysis_id ? {
        id: row.analysis_id,
        severity: row.severity,
        ruleBasedResults: row.rule_based_results,
        mlResults: row.ml_results,
        analyzedAt: row.analyzed_at
      } : null
    }));

    res.status(200).json({
      success: true,
      reports,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({
      error: 'Failed to fetch history',
      message: 'An error occurred while fetching patient history',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/history/trends
 * Get trend data for graphing (parameter values over time) for the authenticated user
 * Query params: parameter (hemoglobin, rbc, wbc, platelets)
 * Requires authentication
 */
router.get('/trends', authenticate, async (req, res) => {
  try {
    const parameter = req.query.parameter || 'hemoglobin'; // Default to hemoglobin

    const validParameters = ['hemoglobin', 'rbc', 'wbc', 'platelets', 'hematocrit', 'mcv', 'mch', 'mchc', 'rdw'];
    if (!validParameters.includes(parameter)) {
      return res.status(400).json({
        error: 'Invalid parameter',
        message: `Parameter must be one of: ${validParameters.join(', ')}`
      });
    }

    // Get reports with the specified parameter for authenticated user only
    const result = await query(
      `SELECT 
        r.id,
        r.created_at,
        r.extracted_data->>$1 as parameter_value,
        a.severity
      FROM reports r
      LEFT JOIN analyses a ON r.id = a.report_id
      WHERE r.user_id = $2
      AND r.extracted_data->>$1 IS NOT NULL
      ORDER BY r.created_at ASC`,
      [parameter, req.user.id]
    );

    // Format for charting
    const trends = result.rows.map(row => ({
      date: row.created_at,
      value: parseFloat(row.parameter_value),
      severity: row.severity,
      reportId: row.id
    }));

    res.status(200).json({
      success: true,
      parameter,
      data: trends,
      count: trends.length
    });

  } catch (error) {
    console.error('Get trends error:', error);
    res.status(500).json({
      error: 'Failed to fetch trends',
      message: 'An error occurred while fetching trend data',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;

