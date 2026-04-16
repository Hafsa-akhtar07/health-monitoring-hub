const express = require('express');
const { analyzeCBC } = require('../services/ruleDetection');
const { detectConditions } = require('../services/conditionDetection');
const { getSuggestions } = require('../services/openAIService');
const { query } = require('../config/database');
const axios = require('axios');
const authenticate = require('../middleware/auth');

const router = express.Router();

/**
 * POST /api/analyze
 * Analyze CBC values using rule-based detection and ML service
 * Requires authentication
 */
router.post('/', authenticate, async (req, res) => {
  try {
    const { cbcData, reportId, gender } = req.body;

    if (!cbcData) {
      return res.status(400).json({
        error: 'Missing data',
        message: 'CBC data is required for analysis'
      });
    }

    /**
     * Ensure WBC differential values are in % (model training + most reports).
     * If differential values look like absolute counts (/µL) and WBC is present,
     * convert via: percent = (diffAbs / wbcAbs) * 100.
     */
    const normalizeDifferentialsToPercent = (input) => {
      const out = { ...input };
      const diffKeys = ['neutrophils', 'lymphocytes', 'monocytes', 'eosinophils', 'basophils'];

      const wbcRaw = out.wbc;
      let wbc = wbcRaw === null || wbcRaw === undefined || wbcRaw === '' ? null : parseFloat(wbcRaw);
      if (Number.isNaN(wbc)) wbc = null;

      // If client sent WBC in k/mcL (4–10-ish), convert to cells/µL.
      const wbcAbs = wbc != null && wbc > 0 && wbc < 200 ? wbc * 1000 : wbc;

      diffKeys.forEach((k) => {
        const raw = out[k];
        const v = raw === null || raw === undefined || raw === '' ? null : parseFloat(raw);
        if (v == null || Number.isNaN(v)) return;

        // Already percent
        if (v >= 0 && v <= 100) {
          out[k] = v;
          return;
        }

        // Try converting absolute -> percent if WBC available.
        if (wbcAbs != null && wbcAbs > 0) {
          // If differential looks like k/mcL, convert to cells/µL first.
          const diffAbs = v > 0 && v < 200 ? v * 1000 : v;
          const pct = (diffAbs / wbcAbs) * 100;
          if (pct >= 0 && pct <= 100) {
            out[k] = Math.round(pct * 100) / 100; // 2dp
          }
        }
      });

      return out;
    };

    const normalizedCbcData = normalizeDifferentialsToPercent(cbcData);

    // Validate required fields
    // For strict validation (e.g., when saving a full report) we want all core CBC fields,
    // but for AI analysis we can still proceed if some are missing.
    const requiredFields = ['hemoglobin', 'rbc', 'wbc', 'platelets'];
    const missingFields = requiredFields.filter(field => cbcData[field] === undefined || cbcData[field] === null || cbcData[field] === '');

    // Only block completely empty/invalid payloads; otherwise, log a warning and continue
    if (missingFields.length === requiredFields.length) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: `At least one of the core CBC fields (${requiredFields.join(', ')}) is required for analysis.`,
        missingFields
      });
    }

    // Rule-based detection
    const ruleBasedResults = analyzeCBC(normalizedCbcData, gender);

    // Detect potential conditions based on abnormalities
    const detectedConditions = detectConditions(ruleBasedResults, normalizedCbcData, gender);

    // ML Service call (mock or real)
    let mlResults = null;
    let mlError = null;
    
    try {
      const mlServiceUrl = process.env.ML_SERVICE_URL || 'http://localhost:5001';
      const mlResponse = await axios.post(`${mlServiceUrl}/predict`, {
        cbcData: normalizedCbcData
      }, {
        timeout: 5000 // 5 second timeout
      });
      
      mlResults = mlResponse.data;

      if (mlResults) {
        console.log('📊 ML diagnosis (real): Model=' + (mlResults.usedModel || 'unknown') + ' | Confidence=' + (mlResults.confidence != null ? mlResults.confidence : 'N/A') + ' | Severity=' + (mlResults.severity || 'N/A'));
      }
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
        note: 'Mock ML results - ML service not available',
        usedModel: 'mock (ML service not reachable)'
      };

      console.log('📊 ML diagnosis (fallback): Model=mock | Confidence=', mlResults.confidence, '| Reason: ML service not reachable at', process.env.ML_SERVICE_URL || 'http://localhost:5001');
    }

    // Override ML diagnosis when rule-based engine says everything is normal.
    // ML is a classifier and can disagree with reference-range based checks.
    // This keeps the UI consistent with the "every parameter is normal" expectation.
    console.log('[ML-OVERRIDE] ruleBasedOverallSeverity=', ruleBasedResults?.overallSeverity);
    if (mlResults && ruleBasedResults?.overallSeverity === 'normal') {
      console.log('[ML-OVERRIDE] Applying Normal override to ML results');
      mlResults = {
        ...mlResults,
        severity: 'normal',
        predictedClass: 'Normal',
        confidence: mlResults.confidence != null ? Math.max(mlResults.confidence, 0.8) : 0.8,
        predictions: {
          // UI shows top predictions by sorting values desc.
          // Keep it simple: Normal should be the top one.
          Normal: 1.0
        },
        note: 'ML overridden to Normal because all parameters are normal (rule-based).'
      };
    }

    // Determine overall severity (prioritize critical)
    let overallSeverity = ruleBasedResults.overallSeverity;
    if (mlResults && mlResults.severity === 'critical') {
      overallSeverity = 'critical';
    } else if (mlResults && mlResults.severity && overallSeverity === 'normal') {
      overallSeverity = mlResults.severity;
    }

    // Get diet and medication suggestions
    // If rule-based says everything is normal, return only general wellness guidance.
    // This prevents the LLM from generating condition-specific advice when the report is normal.
    let suggestions = null;
    try {
      if (ruleBasedResults?.overallSeverity === 'normal') {
        suggestions = {
          dietaryRecommendations: [
            'Maintain a balanced diet with fruits, vegetables, whole grains, and lean proteins.',
            'Stay hydrated and limit processed foods and added sugars.'
          ],
          lifestyleSuggestions: [
            'Engage in regular moderate exercise (about 30 minutes most days).',
            'Maintain a consistent sleep routine (7–9 hours) and manage stress.'
          ],
          possibleMedications: [],
          whenToConsultDoctor: 'If you have symptoms or concerns, consult a healthcare provider for proper diagnosis and guidance.',
          disclaimer:
            'This information is for educational purposes only and is not a substitute for professional medical advice, diagnosis, or treatment.'
        };
      } else {
        suggestions = await getSuggestions(detectedConditions, normalizedCbcData, gender);
      }
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

