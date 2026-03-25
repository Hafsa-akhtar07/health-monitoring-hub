const express = require('express');
const authenticate = require('../middleware/auth');
const { query } = require('../config/database');
const { getRecentErrors, countOcrErrorEntries } = require('../services/logger');

const router = express.Router();

async function requireAdmin(req, res, next) {
  try {
    const result = await query('SELECT role FROM users WHERE id = $1', [req.user.id]);
    const role = result.rows[0]?.role;
    if (role !== 'admin') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Admin access required.'
      });
    }
    next();
  } catch (err) {
    console.error('Admin check error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Could not verify admin access.'
    });
  }
}

/**
 * GET /api/admin/overview
 */
router.get('/overview', authenticate, requireAdmin, async (req, res) => {
  try {
    const [usersRes, patientsRes, reportsRes] = await Promise.all([
      query('SELECT COUNT(*)::int AS c FROM users'),
      query(`SELECT COUNT(*)::int AS c FROM users WHERE COALESCE(role, 'patient') = 'patient'`),
      query('SELECT COUNT(*)::int AS c FROM reports')
    ]);

    res.json({
      success: true,
      data: {
        totalUsers: usersRes.rows[0].c,
        patientUsers: patientsRes.rows[0].c,
        totalReports: reportsRes.rows[0].c,
        totalOcrErrors: countOcrErrorEntries()
      }
    });
  } catch (err) {
    console.error('Admin overview error:', err);
    res.status(500).json({
      error: 'Failed to load overview',
      message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

/**
 * GET /api/admin/ocr-logs?limit=50
 */
router.get('/ocr-logs', authenticate, requireAdmin, (req, res) => {
  try {
    const raw = parseInt(req.query.limit, 10);
    const limit = Number.isFinite(raw) ? Math.min(Math.max(raw, 1), 500) : 50;
    const logs = getRecentErrors(limit);
    res.json({ success: true, logs });
  } catch (err) {
    console.error('Admin ocr-logs error:', err);
    res.status(500).json({
      error: 'Failed to read OCR logs',
      message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

module.exports = router;
