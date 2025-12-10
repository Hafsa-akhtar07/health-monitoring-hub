const express = require('express');
const { analyzeCBC } = require('../services/ruleDetection');
const { detectConditions } = require('../services/conditionDetection');
const { getSuggestions } = require('../services/openAIService');
const { query } = require('../config/database');
const axios = require('axios');

const router = express.Router();

/**
 * POST /api/analyze
 * Analyze CBC values using rule-based detection and ML service
 */
router.post('/', async (req, res) => {
  try {
    const { cbcData, reportId, gender } = req.body;

    if (!cbcData) {
      return res.status(400).json({
        error: 'Missing data',
        message: 'CBC data is required for analysis'
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

    // Rule-based detection
    const ruleBasedResults = analyzeCBC(cbcData, gender);

    // Detect potential conditions based on abnormalities
    const detectedConditions = detectConditions(ruleBasedResults, cbcData, gender);

    // ML Service call (mock or real)
    let mlResults = null;
    let mlError = null;
    
    try {
      const mlServiceUrl = process.env.ML_SERVICE_URL || 'http://localhost:5001';
      const mlResponse = await axios.post(`${mlServiceUrl}/predict`, {
        cbcData: cbcData
      }, {
        timeout: 5000 // 5 second timeout
      });
      
      mlResults = mlResponse.data;
    } catch (mlErr) {
      console.warn('ML service unavailable, using rule-based only:', mlErr.message);
      mlError = 'ML service unavailable';
      
      // Mock ML results for development
      mlResults = {
        severity: ruleBasedResults.overallSeverity,
        confidence: 0.75,
        predictions: {
          normal: ruleBasedResults.overallSeverity === 'normal' ? 0.8 : 0.2,
          mild: ruleBasedResults.overallSeverity === 'abnormal' ? 0.7 : 0.1,
          critical: ruleBasedResults.overallSeverity === 'critical' ? 0.9 : 0.1
        },
        detectedConditions: detectedConditions, // Include conditions in ML results
        note: 'Mock ML results - ML service not available'
      };
    }

    // Determine overall severity (prioritize critical)
    let overallSeverity = ruleBasedResults.overallSeverity;
    if (mlResults && mlResults.severity === 'critical') {
      overallSeverity = 'critical';
    } else if (mlResults && mlResults.severity && overallSeverity === 'normal') {
      overallSeverity = mlResults.severity;
    }

    // Get diet and medication suggestions from OpenAI
    let suggestions = null;
    try {
      suggestions = await getSuggestions(detectedConditions, cbcData, gender);
    } catch (suggestionError) {
      console.warn('Failed to get suggestions:', suggestionError.message);
      // Continue without suggestions
    }

    // Save analysis to database if reportId is provided
    let analysisId = null;
    if (reportId) {
      try {
        const result = await query(
          `INSERT INTO analyses (report_id, rule_based_results, ml_results, severity, created_at)
           VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
           RETURNING id`,
          [
            reportId,
            JSON.stringify(ruleBasedResults),
            JSON.stringify(mlResults),
            overallSeverity
          ]
        );
        analysisId = result.rows[0].id;
      } catch (dbError) {
        console.error('Error saving analysis:', dbError);
        // Continue even if database save fails
      }
    }

    // Prepare response
    const response = {
      success: true,
      message: 'Analysis completed successfully',
      analysis: {
        id: analysisId,
        ruleBased: ruleBasedResults,
        ml: mlResults,
        conditions: detectedConditions, // Actual conditions detected
        suggestions: suggestions, // Diet and medication suggestions
        overallSeverity,
        summary: {
          totalParameters: ruleBasedResults.summary.totalParameters,
          normalCount: ruleBasedResults.summary.normalCount,
          abnormalCount: ruleBasedResults.summary.abnormalCount,
          criticalCount: ruleBasedResults.summary.criticalCount,
          summaryMessage: ruleBasedResults.summaryMessage
        }
      },
      warnings: mlError ? [`ML Service: ${mlError}`] : []
    };

    res.status(200).json(response);

  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({
      error: 'Analysis failed',
      message: 'An error occurred while analyzing the CBC data',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;

