import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import api from '../utils/api';

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

const ResultsDisplay = ({ reportId, cbcData, gender, onBack, onUploadNew }) => {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [openAIResponse, setOpenAIResponse] = useState(null);
  const [openAILoading, setOpenAILoading] = useState(false);
  const [mlResult, setMlResult] = useState(null);
  const [analysisWarnings, setAnalysisWarnings] = useState([]);
  const hasAnalyzed = useRef(false);
  const recommendationsRef = useRef(null);

  const genderLower = gender ? String(gender).toLowerCase() : null;
  const isMale = genderLower === 'male' || genderLower === 'm';
  const isFemale = genderLower === 'female' || genderLower === 'f';

  // Cleveland Clinic (adults). Use gender-specific where applicable.
  const referenceRanges = {
    // Cleveland Clinic (adults). WBC/Platelets in absolute counts (cells/µL).
    wbc: { min: 4000, max: 10000, unit: 'cells/µL', displayName: 'WBC' },
    rbc: {
      min: isMale ? 4.5 : 4.0,
      max: isMale ? 6.1 : 5.4,
      unit: 'million cells/µL',
      displayName: 'RBC',
      note: !isMale && !isFemale ? 'Female: 4.0–5.4 | Male: 4.5–6.1' : undefined
    },
    hemoglobin: {
      min: isMale ? 13.0 : 11.5,
      max: isMale ? 17.0 : 15.5,
      unit: 'g/dL',
      displayName: 'Hemoglobin',
      note: !isMale && !isFemale ? 'Female: 11.5–15.5 | Male: 13–17' : undefined
    },
    hematocrit: {
      min: isMale ? 40 : 36,
      max: isMale ? 55 : 48,
      unit: '%',
      displayName: 'Hematocrit',
      note: !isMale && !isFemale ? 'Female: 36–48 | Male: 40–55' : undefined
    },
    mcv: { min: 80, max: 100, unit: 'fL', displayName: 'MCV' },
    rdw: { min: 12, max: 15, unit: '%', displayName: 'RDW' },
    mch: { min: 27, max: 31, unit: 'pg', displayName: 'MCH' },
    mchc: { min: 32, max: 36, unit: 'g/dL', displayName: 'MCHC' },
    platelets: { min: 150000, max: 400000, unit: 'cells/µL', displayName: 'Platelets' },
    // Differentials in % (model trained on % and most reports provide %)
    neutrophils: { min: 40, max: 80, unit: '%', displayName: 'Neutrophils' },
    lymphocytes: { min: 20, max: 40, unit: '%', displayName: 'Lymphocytes' },
    monocytes: { min: 2, max: 10, unit: '%', displayName: 'Monocytes' },
    eosinophils: { min: 1, max: 6, unit: '%', displayName: 'Eosinophils' },
    basophils: { min: 0, max: 1, unit: '%', displayName: 'Basophils' }
  };

  // FIXED: Proper 5-range categorization with range-width based calculation
  const getCategory = (value, min, max) => {
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return 'normal';
    
    // Handle edge case where min equals max
    if (min === max) {
      if (numValue === min) return 'normal';
      if (numValue < min) {
        const percentBelow = ((min - numValue) / min) * 100;
        if (percentBelow > 30) return 'very-low';
        if (percentBelow > 10) return 'low';
        return 'mild-low';
      }
      if (numValue > max) {
        const percentAbove = ((numValue - max) / max) * 100;
        if (percentAbove > 30) return 'very-high';
        if (percentAbove > 10) return 'high';
        return 'mild-high';
      }
    }
    
    // Calculate normal range width
    const rangeWidth = max - min;
    
    if (numValue < min) {
      // Calculate how far below as percentage of the normal range width
      const percentBelowNormal = ((min - numValue) / rangeWidth) * 100;
      if (percentBelowNormal > 30) return 'very-low';
      if (percentBelowNormal > 10) return 'low';
      return 'mild-low';
    }
    
    if (numValue > max) {
      // Calculate how far above as percentage of the normal range width
      const percentAboveNormal = ((numValue - max) / rangeWidth) * 100;
      if (percentAboveNormal > 30) return 'very-high';
      if (percentAboveNormal > 10) return 'high';
      return 'mild-high';
    }
    
    return 'normal';
  };

  // FIXED: Updated color mapping for 7 categories
  const getCategoryColor = (category) => {
    switch (category) {
      case 'very-low': return '#991b1b';     // Dark Red - Severe
      case 'low': return '#dc2626';          // Red - Moderate
      case 'mild-low': return '#f97316';     // Orange - Mild
      case 'normal': return '#22c55e';       // Green - Normal
      case 'mild-high': return '#eab308';    // Yellow - Mild
      case 'high': return '#f59e0b';         // Amber - Moderate
      case 'very-high': return '#dc2626';    // Red - Severe
      default: return '#9ca3af';
    }
  };

  // FIXED: Gradient showing all 7 zones
  const getCategoryGradient = () => {
    return 'linear-gradient(90deg, #991b1b 0%, #dc2626 15%, #f97316 30%, #22c55e 50%, #eab308 70%, #f59e0b 85%, #dc2626 100%)';
  };

  const getStatusTextFromCategory = (category) => {
    switch (category) {
      case 'very-low': return 'Severely Low';
      case 'low': return 'Moderately Low';
      case 'mild-low': return 'Mildly Low';
      case 'normal': return 'Normal';
      case 'mild-high': return 'Mildly High';
      case 'high': return 'Moderately High';
      case 'very-high': return 'Severely High';
      case 'missing': return 'Not Extracted';
      default: return 'Normal';
    }
  };

  const normalizeCbcForDisplay = useCallback((input) => {
    const out = { ...(input || {}) };
    const toNum = (v) => {
      const n = v === null || v === undefined || v === '' ? NaN : parseFloat(v);
      return Number.isNaN(n) ? null : n;
    };

    // WBC and Platelets: normalize to cells/µL
    const wbc = toNum(out.wbc);
    if (wbc != null && wbc > 0 && wbc < 200) out.wbc = wbc * 1000; // k/mcL -> cells/µL

    const platelets = toNum(out.platelets);
    if (platelets != null && platelets > 0 && platelets < 5000) out.platelets = platelets * 1000; // k/mcL -> cells/µL

    // Differentials: normalize to %
    const wbcAbs = toNum(out.wbc);
    const diffKeys = ['neutrophils', 'lymphocytes', 'monocytes', 'eosinophils', 'basophils'];
    diffKeys.forEach((k) => {
      const v = toNum(out[k]);
      if (v == null) return;
      if (v >= 0 && v <= 100) return; // already %
      if (wbcAbs != null && wbcAbs > 0) {
        const diffAbs = v > 0 && v < 200 ? v * 1000 : v;
        const pct = (diffAbs / wbcAbs) * 100;
        if (pct >= 0 && pct <= 100) out[k] = Math.round(pct * 100) / 100;
      }
    });

    return out;
  }, []);

  const normalizeSuggestions = useCallback((rawSuggestions) => {
    const safeString = (v) => (v === null || v === undefined ? '' : String(v));

    const tryParseJson = (value) => {
      if (typeof value !== 'string') return value;
      const s = value.trim();
      if (!s) return value;
      // Only attempt JSON parse when it looks like JSON
      if (!(s.startsWith('{') || s.startsWith('['))) return value;
      try {
        return JSON.parse(s);
      } catch (_) {
        return value;
      }
    };

    const asStringArray = (value) => {
      if (value === null || value === undefined) return [];
      const parsed = tryParseJson(value);

      if (Array.isArray(parsed)) {
        return parsed
          .map((v) => (typeof v === 'string' ? v.trim() : safeString(v).trim()))
          .filter(Boolean);
      }

      // Some models return a single string that contains multiple lines/bullets
      if (typeof parsed === 'string') {
        const s = parsed.trim();
        if (!s) return [];
        // Split on newlines or bullet-like separators if present
        const parts = s
          .split(/\r?\n|•|-\s+/g)
          .map((p) => p.trim())
          .filter(Boolean);
        return parts.length > 1 ? parts : [s];
      }

      // If it's an object, stringify it (caller may handle object shapes separately)
      if (typeof parsed === 'object') return [safeString(parsed)];

      return [safeString(parsed)].filter(Boolean);
    };

    const suggestions = tryParseJson(rawSuggestions) || {};

    // Sometimes the backend returns a *stringified whole suggestions object* inside one field
    // (ex: dietaryRecommendations contains {"dietaryRecommendations":[...], ...} ).
    const maybeWholeObject =
      typeof suggestions === 'object' && suggestions !== null
        ? suggestions
        : tryParseJson(safeString(rawSuggestions));

    const obj =
      typeof maybeWholeObject === 'object' && maybeWholeObject !== null ? maybeWholeObject : {};

    const dietaryRaw =
      obj.dietaryRecommendations ?? obj.dietary ?? obj.diet ?? obj.dietary_recommendations;
    const lifestyleRaw =
      obj.lifestyleSuggestions ?? obj.lifestyle ?? obj.lifestyle_suggestions ?? obj.lifestyleRecommendations;
    const medsRaw =
      obj.possibleMedications ?? obj.medications ?? obj.possible_medications ?? obj.meds;
    const doctorRaw =
      obj.whenToConsultDoctor ?? obj.doctorConsult ?? obj.doctor_consult ?? obj.when_to_consult_doctor;
    const disclaimerRaw =
      obj.disclaimer ?? obj.medicalDisclaimer ?? obj.medical_disclaimer;

    // possibleMedications can be array of strings OR array of objects.
    const medsParsed = tryParseJson(medsRaw);
    const medications = Array.isArray(medsParsed)
      ? medsParsed
      : asStringArray(medsParsed);

    return {
      dietary: asStringArray(dietaryRaw),
      lifestyle: asStringArray(lifestyleRaw),
      medications,
      doctorConsult:
        (typeof doctorRaw === 'string' ? doctorRaw : safeString(doctorRaw)).trim() ||
        'Please consult a healthcare provider for proper diagnosis and treatment.',
      disclaimer:
        (typeof disclaimerRaw === 'string' ? disclaimerRaw : safeString(disclaimerRaw)).trim() ||
        'This information is for educational purposes only and not a substitute for professional medical advice.'
    };
  }, []);

  // FIXED: Status text using range-width calculation consistently
  const getStatusText = (value, min, max) => {
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return 'Value not available';
    
    // Handle edge case where min equals max
    if (min === max) {
      if (numValue === min) return 'Normal';
      if (numValue < min) {
        const percentBelow = ((min - numValue) / min) * 100;
        if (percentBelow > 30) return 'Severely Low';
        if (percentBelow > 10) return 'Moderately Low';
        return 'Mildly Low';
      }
      if (numValue > max) {
        const percentAbove = ((numValue - max) / max) * 100;
        if (percentAbove > 30) return 'Severely High';
        if (percentAbove > 10) return 'Moderately High';
        return 'Mildly High';
      }
    }
    
    const rangeWidth = max - min;
    
    if (numValue < min) {
      const percentBelowNormal = ((min - numValue) / min) * 100;
      if (percentBelowNormal > 30) return 'Severely Low';
      if (percentBelowNormal > 10) return 'Moderately Low';
      return 'Mildly Low';
    }
    
    if (numValue > max) {
      const percentAboveNormal = ((numValue - max) / max) * 100;
      if (percentAboveNormal > 30) return 'Severely High';
      if (percentAboveNormal > 10) return 'Moderately High';
      return 'Mildly High';
    }
    
    return 'Normal';
  };

  // FIXED: Status color using consistent thresholds
  const getStatusColor = (value, min, max) => {
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return '#6b7280';
    
    // Handle edge case where min equals max
    if (min === max) {
      if (numValue === min) return '#22c55e';
      if (numValue < min) {
        const percentBelow = ((min - numValue) / min) * 100;
        if (percentBelow > 30) return '#991b1b';
        if (percentBelow > 10) return '#dc2626';
        return '#f97316';
      }
      if (numValue > max) {
        const percentAbove = ((numValue - max) / max) * 100;
        if (percentAbove > 30) return '#991b1b';
        if (percentAbove > 10) return '#dc2626';
        return '#eab308';
      }
    }
    
    const rangeWidth = max - min;
    
    if (numValue < min) {
      const percentBelowNormal = ((min - numValue) / rangeWidth) * 100;
      if (percentBelowNormal > 30) return '#991b1b';  // Severe - Dark Red
      if (percentBelowNormal > 10) return '#dc2626';  // Moderate - Red
      return '#f97316';  // Mild - Orange
    }
    
    if (numValue > max) {
      const percentAboveNormal = ((numValue - max) / rangeWidth) * 100;
      if (percentAboveNormal > 30) return '#991b1b';  // Severe - Dark Red
      if (percentAboveNormal > 10) return '#dc2626';  // Moderate - Red
      return '#eab308';  // Mild - Yellow
    }
    
    return '#22c55e';  // Normal - Green
  };

  // FIXED: Bar position with proper scaling
  const getBarPosition = (value, min, max) => {
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return 50;
    
    // Handle edge case where min equals max
    if (min === max) {
      if (numValue === min) return 50;
      // For single-point ranges, use percentage deviation from the value
      const maxAllowedDeviation = min * 2; // Allow up to 200% deviation
      let position = 50 + ((numValue - min) / maxAllowedDeviation) * 50;
      position = Math.max(0, Math.min(100, position));
      return position;
    }
    
    const rangeWidth = max - min;
    
    // Show up to 3x the normal range for better visualization
    const maxAllowedDeviation = rangeWidth * 3;
    const extendedMin = min - maxAllowedDeviation;
    const extendedMax = max + maxAllowedDeviation;
    const totalRange = extendedMax - extendedMin;
    
    // Clamp value to extended range for visualization
    let clampedValue = Math.max(extendedMin, Math.min(extendedMax, numValue));
    
    // Calculate position (0-100%)
    let position = ((clampedValue - extendedMin) / totalRange) * 100;
    position = Math.max(0, Math.min(100, position));
    
    return position;
  };

  const analyzeValues = useCallback(() => {
    if (!cbcData) return null;
    const normalized = normalizeCbcForDisplay(cbcData);

    const results = {
      parameters: {},
      normalCount: 0,
      lowCount: 0,
      highCount: 0,
      totalCount: STANDARD_CBC_PARAMS.length,
      extractedCount: 0,
      overallStatus: 'normal',
      detectedConditions: []
    };

    STANDARD_CBC_PARAMS.forEach((key) => {
      const value = normalized?.[key];
      const range = referenceRanges[key];
      if (!range) return;

      if (
        value === null ||
        value === undefined ||
        value === '' ||
        Number.isNaN(parseFloat(value))
      ) {
        results.parameters[key] = {
          value: null,
          referenceRange: range,
          category: 'missing',
          statusText: 'Not Extracted',
          statusCategory: 'missing',
          barPosition: 50,
          message: 'Value not extracted from this report.'
        };
        return;
      }

      const numValue = parseFloat(value);
      results.extractedCount++;
      const category = getCategory(numValue, range.min, range.max);
      const statusText = getStatusTextFromCategory(category);
      
      let statusCategory = 'normal';
      if (category === 'very-low' || category === 'low' || category === 'mild-low') statusCategory = 'low';
      if (category === 'high' || category === 'very-high' || category === 'mild-high') statusCategory = 'high';
      
      if (statusCategory === 'low') results.lowCount++;
      else if (statusCategory === 'high') results.highCount++;
      else results.normalCount++;

      results.parameters[key] = {
        value: numValue,
        referenceRange: range,
        category,
        statusText,
        statusCategory,
        barPosition: getBarPosition(numValue, range.min, range.max),
        message: generateParameterMessage(key, numValue, range, statusCategory)
      };
    });

    // Determine overall status
    if (results.lowCount > results.highCount) results.overallStatus = 'low';
    else if (results.highCount > results.lowCount) results.overallStatus = 'high';
    else results.overallStatus = 'normal';

    // Detect possible conditions
    results.detectedConditions = detectConditions(results.parameters);

    return results;
  }, [cbcData]);

  const generateParameterMessage = (param, value, range, status) => {
    const messages = {
      hemoglobin: {
        normal: 'Hemoglobin level is within normal range.',
        low: 'Low hemoglobin may indicate anemia. Consider consulting a doctor.',
        high: 'High hemoglobin may indicate dehydration or other conditions.'
      },
      wbc: {
        normal: 'White blood cell count is normal.',
        low: 'Low WBC count may indicate immune system issues.',
        high: 'High WBC count may indicate infection or inflammation.'
      },
      platelets: {
        normal: 'Platelet count is within normal range.',
        low: 'Low platelet count may increase bleeding risk.',
        high: 'High platelet count may indicate clotting disorders.'
      }
    };

    return messages[param]?.[status] || `${value} ${range.unit} is ${status} compared to normal range (${range.min}-${range.max} ${range.unit}).`;
  };

  const detectConditions = (parameters) => {
    const conditions = [];

    if (parameters.hemoglobin?.statusCategory === 'low') {
      conditions.push({
        name: 'Possible Anemia',
        confidence: 0.85,
        description: 'Low hemoglobin levels may indicate anemia. Further testing may be needed.',
        recommendations: ['Consult hematologist', 'Consider iron-rich diet', 'Monitor fatigue levels']
      });
    }

    if (parameters.wbc?.statusCategory === 'high') {
      conditions.push({
        name: 'Possible Infection/Inflammation',
        confidence: 0.75,
        description: 'Elevated white blood cells may indicate infection or inflammatory response.',
        recommendations: ['Consult doctor', 'Monitor for fever', 'Rest and hydration']
      });
    }

    if (parameters.platelets?.statusCategory === 'low') {
      conditions.push({
        name: 'Thrombocytopenia Risk',
        confidence: 0.65,
        description: 'Low platelet count may increase bleeding risk.',
        recommendations: ['Hematology consultation', 'Avoid blood thinners', 'Monitor for bruising']
      });
    }

    if (parameters.platelets?.statusCategory === 'high') {
      conditions.push({
        name: 'Thrombocytosis Risk',
        confidence: 0.65,
        description: 'High platelet count may indicate clotting tendencies.',
        recommendations: ['Hematology consultation', 'Stay hydrated', 'Monitor for unusual clotting']
      });
    }

    return conditions;
  };

  const fetchOpenAIRecommendations = async () => {
    if (!cbcData) return;
    try {
      setOpenAILoading(true);
      setOpenAIResponse(null);
      setMlResult(null);

      const normalizedCbcData = normalizeCbcForDisplay(cbcData);
      const response = await api.post('/analyze', {
        cbcData: normalizedCbcData,
        reportId,
        gender: gender || null
      });

      const backendAnalysis = response.data?.analysis;

      if (backendAnalysis?.ml) {
        setMlResult(backendAnalysis.ml);
      }
      setAnalysisWarnings(response.data?.warnings || []);

      const suggestions = backendAnalysis?.suggestions;
      if (suggestions) {
        setOpenAIResponse(normalizeSuggestions(suggestions));
        
        setTimeout(() => {
          if (recommendationsRef.current) {
            recommendationsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 100);
      } else {
        setOpenAIResponse(null);
      }
    } catch (error) {
      console.error('OpenAI recommendations error:', error.response?.data || error.message);
      setMlResult(null);
      setOpenAIResponse(null);
      setAnalysisWarnings([]);
    } finally {
      setOpenAILoading(false);
    }
  };

  const handleAnalyze = useCallback(() => {
    if (!cbcData) {
      setError('No CBC data available for analysis');
      return;
    }

    setLoading(true);
    setError(null);

    setTimeout(() => {
      const analysisResults = analyzeValues();
      
      if (analysisResults) {
        setAnalysis(analysisResults);
        hasAnalyzed.current = true;
        fetchOpenAIRecommendations();
      } else {
        setError('Analysis failed. Please try again.');
      }
      
      setLoading(false);
    }, 1500);
  }, [cbcData, analyzeValues]);

  useEffect(() => {
    if (cbcData && !hasAnalyzed.current) {
      handleAnalyze();
    }
  }, [cbcData, handleAnalyze]);

  const getOverallStatusColor = (status) => {
    switch (status) {
      case 'low': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-green-100 text-green-800 border-green-200';
    }
  };

  const getOverallStatusIcon = (status) => {
    switch (status) {
      case 'low': return 'fas fa-arrow-down';
      case 'high': return 'fas fa-arrow-up';
      default: return 'fas fa-check-circle';
    }
  };

  const handleExportPDF = () => {
    if (!analysis || !cbcData) {
      alert('No analysis data available to export');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to export PDF');
      return;
    }

    const currentDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const printHTML = `<!DOCTYPE html>
      <html>
        <head>
          <title>CBC Analysis Report - ${currentDate}</title>
          <style>
            @media print { @page { margin: 1cm; size: A4; } }
            body { font-family: 'Arial', sans-serif; margin: 0; padding: 20px; color: #333; background: white; }
            .header { border-bottom: 3px solid #8B0000; padding-bottom: 15px; margin-bottom: 30px; }
            .header h1 { color: #8B0000; margin: 0; font-size: 28px; }
            .section { margin-bottom: 30px; page-break-inside: avoid; }
            .section-title { color: #8B0000; font-size: 20px; font-weight: bold; margin-bottom: 15px; border-bottom: 2px solid #FFE4E1; padding-bottom: 8px; }
            .parameters-table { width: 100%; border-collapse: collapse; }
            .parameters-table th { background: #8B0000; color: white; padding: 12px; text-align: left; }
            .parameters-table td { padding: 10px 12px; border-bottom: 1px solid #ddd; }
            .disclaimer { margin-top: 40px; padding: 15px; background: #fff3cd; border: 1px solid #ffc107; border-radius: 5px; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Health Monitoring Hub - CBC Analysis Report</h1>
            <p>Generated on ${currentDate}</p>
          </div>
          <div class="section">
            <div class="section-title">Overall Summary</div>
            <p>Overall Status: ${analysis.overallStatus.toUpperCase()}</p>
            <p>Normal: ${analysis.normalCount} | Low: ${analysis.lowCount} | High: ${analysis.highCount}</p>
          </div>
          <div class="section">
            <div class="section-title">CBC Parameters Analysis</div>
            <table class="parameters-table">
              <thead><tr><th>Parameter</th><th>Value</th><th>Reference Range</th><th>Status</th></tr></thead>
              <tbody>
                ${Object.entries(analysis.parameters).map(([key, param]) => `
                  <tr>
                    <td><strong>${param.referenceRange.displayName || key.toUpperCase()}</strong></td>
                    <td>${param.value} ${param.referenceRange.unit}</td>
                    <td>${param.referenceRange.min} - ${param.referenceRange.max}</td>
                    <td>${param.statusText}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          <div class="disclaimer">
            <strong>⚠️ DISCLAIMER:</strong> This analysis is for informational purposes only. 
            Always consult with a healthcare professional for medical advice.
          </div>
        </body>
      </html>`;

    printWindow.document.write(printHTML);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 250);
  };
const getGoogleLink = (text) =>
  `https://www.google.com/search?q=${encodeURIComponent(text)}`;
  const handleRegenerateRecommendations = () => {
    fetchOpenAIRecommendations();
  };

  return (
    <div className="min-h-screen p-4 md:p-8 relative overflow-x-clip" style={{
      background: 'linear-gradient(180deg, #fff5f5 0%, #ffe0e0 10%, #ffcccc 20%, #ffb3b3 35%, #ff9999 50%, #ff8080 65%, #e06666 80%, #cc4d4d 90%, #b33b3b 100%)',
      backgroundAttachment: 'fixed'
    }}>
      <div className="max-w-7xl mx-auto relative z-10">
        {/* Header */}
        <div className="mb-6 md:mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-[#2c1212] mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>
                CBC Analysis Results
              </h1>
              <p className="text-[#4e2a2a] font-medium">
                AI-powered analysis of your complete blood count report
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto sm:flex-shrink-0">
              <Button 
                variant="outline"
                onClick={handleExportPDF}
                className="border-[#8B0000] text-[#8B0000] hover:bg-white/80 transition-all duration-300 sm:hover:scale-105 w-full sm:w-auto"
              >
                <i className="fas fa-download mr-2"></i>
                Export Report
              </Button>
              <Button 
                onClick={onUploadNew}
                className="bg-gradient-to-r from-[#8B0000] to-[#B22222] hover:from-[#A52A2A] hover:to-[#8B0000] text-white shadow-lg shadow-red-900/50 transition-all duration-300 sm:hover:scale-105 w-full sm:w-auto"
              >
                <i className="fas fa-plus mr-2"></i>
                New Analysis
              </Button>
            </div>
          </div>
        </div>

        {/* Clinical Disclaimer */}
        <Alert className="mb-6 border-amber-300 bg-amber-100/90 backdrop-blur-sm shadow-lg">
          <i className="fas fa-exclamation-triangle text-amber-700 mt-1"></i>
          <AlertDescription className="text-amber-800">
            <strong>Important Disclaimer:</strong> This analysis is for informational purposes only. 
            Always consult with a qualified healthcare professional for medical advice and diagnosis.
          </AlertDescription>
        </Alert>

        {/* Loading State */}
        {loading && (
          <div className="space-y-4">
            <div className="text-center text-[#4e2a2a] py-8">
              <i className="fas fa-spinner fa-spin text-3xl text-[#8B0000] mb-3"></i>
              <p className="font-medium">Analyzing your CBC values...</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <Card className="border-red-300 bg-red-100/90 backdrop-blur-sm shadow-lg mb-6">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 text-red-800">
                <i className="fas fa-exclamation-circle text-xl"></i>
                <div>
                  <h3 className="font-semibold">Analysis Error</h3>
                  <p>{error}</p>
                </div>
              </div>
              <Button 
                onClick={handleAnalyze}
                className="mt-4 bg-red-600 hover:bg-red-700 text-white"
              >
                <i className="fas fa-redo mr-2"></i>
                Try Again
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Analysis Results */}
        {analysis && !loading && (
          <div className="space-y-6">
            {/* Overall Summary */}
            <Card className="shadow-2xl hover:shadow-red-900/20 transition-all duration-500 border-0 bg-white/95 backdrop-blur-sm">
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-[#2c1212]">
                      <i className="fas fa-chart-line text-[#8B0000]"></i>
                      Overall Assessment
                    </CardTitle>
                    <CardDescription className="text-[#4e2a2a]">
                      Summary of your CBC analysis results
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="text-center p-4 bg-green-100 rounded-xl border border-green-200 shadow-sm">
                    <div className="text-2xl font-bold text-green-700">{analysis.normalCount}</div>
                    <div className="text-sm text-gray-700 font-medium">Normal</div>
                  </div>
                  <div className="text-center p-4 bg-orange-100 rounded-xl border border-orange-200 shadow-sm">
                    <div className="text-2xl font-bold text-orange-700">{analysis.lowCount}</div>
                    <div className="text-sm text-gray-700 font-medium">Low</div>
                  </div>
                  <div className="text-center p-4 bg-yellow-100 rounded-xl border border-yellow-200 shadow-sm">
                    <div className="text-2xl font-bold text-yellow-700">{analysis.highCount}</div>
                    <div className="text-sm text-gray-700 font-medium">High</div>
                  </div>
                  <div className="text-center p-4 bg-blue-100 rounded-xl border border-blue-200 shadow-sm">
                    <div className="text-2xl font-bold text-blue-700">{analysis.totalCount}</div>
                    <div className="text-sm text-gray-700 font-medium">Total Parameters</div>
                  </div>
                </div>
                {analysis.detectedConditions.length > 0 && (
                  <div className="mt-4">
                    <h4 className="font-semibold text-[#2c1212] mb-2">⚠️ Detected Conditions</h4>
                    <div className="space-y-2">
                      {analysis.detectedConditions.map((condition, index) => (
                        <div key={index} className="p-3 bg-red-50 border border-red-200 rounded-lg">
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-semibold text-red-800">{condition.name}</span>
                          </div>
                          <p className="text-sm text-red-700">{condition.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ML Diagnosis */}
            {mlResult && (
              <Card className="shadow-2xl hover:shadow-red-900/20 transition-all duration-500 border-0 bg-white/95 backdrop-blur-sm">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-indigo-800">
                        <i className="fas fa-brain"></i>
                        ML Diagnosis
                      </CardTitle>
                      <CardDescription className="text-[#4e2a2a]">
                        Output from trained CBC model
                      </CardDescription>
                    </div>
                    <div className="px-3 py-1 rounded-full text-sm font-semibold bg-indigo-100 text-indigo-800 border border-indigo-200">
                      {mlResult.severity ? mlResult.severity.toUpperCase() : 'N/A'}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-200">
                      <h4 className="font-semibold text-indigo-800 mb-1">Model Severity</h4>
                      <p className="text-2xl font-bold text-indigo-900">
                        {mlResult.severity ? mlResult.severity.toUpperCase() : 'N/A'}
                      </p>
                    </div>
                    <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-200">
                      <h4 className="font-semibold text-indigo-800 mb-1">Confidence</h4>
                      <p className="text-2xl font-bold text-indigo-900">
                        {mlResult.confidence != null ? (mlResult.confidence * 100).toFixed(1) + '%' : 'N/A'}
                      </p>
                    </div>
                    <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-200">
                      <h4 className="font-semibold text-indigo-800 mb-1">Top Predictions</h4>
                      {mlResult.predictions && Object.keys(mlResult.predictions).length > 0 ? (
                        <ul className="mt-2 space-y-1">
                          {Object.entries(mlResult.predictions)
                            .sort((a, b) => b[1] - a[1])
                            .slice(0, 3)
                            .map(([label, prob]) => (
                              <li key={label} className="flex items-center justify-between text-sm">
                                <span className="text-indigo-900">{label}</span>
                                <span className="font-semibold text-indigo-800">
                                  {(prob * 100).toFixed(1)}%
                                </span>
                              </li>
                            ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-indigo-900 mt-2">N/A</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Parameter Details with improved bar */}
            <Card className="shadow-2xl hover:shadow-red-900/20 transition-all duration-500 border-0 bg-white/95 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-[#2c1212]">
                  <i className="fas fa-microscope text-[#8B0000]"></i>
                  Parameter Details
                </CardTitle>
                <CardDescription className="text-[#4e2a2a]">
                  Detailed breakdown of each CBC parameter with severity categories
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {STANDARD_CBC_PARAMS.map((key) => {
                    const param = analysis.parameters[key];
                    if (!param) return null;
                    const range = param.referenceRange;
                    const displayName = range.displayName || key.charAt(0).toUpperCase() + key.slice(1);
                    const statusColor = param.statusCategory === 'missing'
                      ? '#6b7280'
                      : getCategoryColor(param.category);
                    
                    return (
                      <div key={key} className="p-5 rounded-xl bg-white border-2 border-gray-100 hover:border-[#8B0000]/30 transition-all duration-300 shadow-sm hover:shadow-md">
                        <div className="flex justify-between items-center mb-3">
                          <div>
                            <span className="font-bold text-gray-800 text-lg">{displayName}</span>
                            {range.note && (
                              <span className="ml-2 text-xs text-gray-500">({range.note})</span>
                            )}
                          </div>
                        </div>
                        
                        <div className="text-center mb-4">
                          <div className="text-3xl font-bold" style={{ color: statusColor }}>
                            {param.value === null ? '—' : param.value}
                          </div>
                          <div className="text-sm text-gray-600">{range.unit}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            Reference: {range.min} - {range.max} {range.unit}
                          </div>
                        </div>
                        
                        {/* Gradient bar with marker on top */}
                        <div className="relative mb-2">
                          <div 
                            className="w-full h-3 rounded-full overflow-hidden shadow-inner"
                            style={{ background: getCategoryGradient() }}
                          >
                          </div>
                          {/* Marker dot positioned ON the bar */}
                          <div 
                            className="absolute w-5 h-5 bg-white border-3 border-gray-800 rounded-full shadow-lg transform -translate-x-2.5 -translate-y-1"
                            style={{ 
                              left: `${param.barPosition}%`,
                              top: '-4px',
                              border: param.statusCategory === 'missing' ? '3px solid #6b7280' : '3px solid #1f2937',
                              boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                            }}
                          >
                            <div
                              className="absolute inset-0 rounded-full m-0.5"
                              style={{ backgroundColor: param.statusCategory === 'missing' ? '#6b7280' : '#1f2937' }}
                            ></div>
                          </div>
                        </div>
                        
                        {/* Labels under the bar */}
                        <div className="flex justify-between text-xs font-medium mt-2 px-1">
                          <span style={{ color: '#991b1b' }}>Very Low</span>
                          <span style={{ color: '#f97316' }}>Mild Low</span>
                          <span style={{ color: '#22c55e' }}>Normal</span>
                          <span style={{ color: '#eab308' }}>Mild High</span>
                          <span style={{ color: '#dc2626' }}>Very High</span>
                        </div>
                        
                        <p className="text-sm text-gray-700 mt-4 pt-3 border-t border-gray-100">{param.message}</p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* AI Recommendations Section */}
            <div ref={recommendationsRef}>
              <Card className="shadow-2xl hover:shadow-red-900/20 transition-all duration-500 border-0 bg-white/95 backdrop-blur-sm">
                <CardHeader className="bg-gradient-to-r from-[#fff8f8] to-white">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-[#2c1212]">
                        <i className="fas fa-robot text-[#8B0000]"></i>
                        AI-Powered Recommendations
                      </CardTitle>
                      <CardDescription className="text-[#4e2a2a]">
                        Personalized suggestions based on your CBC results
                      </CardDescription>
                    </div>
                    <div className="px-3 py-1 bg-[#FFE4E1] text-[#8B0000] rounded-full text-sm font-semibold shadow-sm">
                      AI Generated
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="p-6">
                  {openAILoading && (
                    <div className="text-center py-8">
                      <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#8B0000] mb-3"></div>
                      <p className="text-[#4e2a2a]">Generating personalized recommendations...</p>
                    </div>
                  )}

                  {openAIResponse && !openAILoading && (
                    <div className="space-y-6">
                      <div className="bg-green-50 border border-green-200 rounded-xl p-5 shadow-sm">
                        <h4 className="font-semibold text-green-800 mb-3 flex items-center gap-2">
                          <i className="fas fa-apple-alt"></i>
                          Dietary Recommendations
                        </h4>
                        <ul className="space-y-2">
                          {openAIResponse.dietary.map((rec, index) => (
                            <li key={index} className="flex items-start gap-2">
                              <i className="fas fa-check text-green-600 mt-1"></i>
                              <span className="text-gray-700">{rec}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 shadow-sm">
                        <h4 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
                          <i className="fas fa-running"></i>
                          Lifestyle Suggestions
                        </h4>
                        <ul className="space-y-2">
                          {openAIResponse.lifestyle.map((suggestion, index) => (
                            <li key={index} className="flex items-start gap-2">
                              <i className="fas fa-check text-blue-600 mt-1"></i>
                              <span className="text-gray-700">{suggestion}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {openAIResponse.medications && openAIResponse.medications.length > 0 && (
                        <div className="bg-purple-50 border border-purple-200 rounded-xl p-5 shadow-sm">
                          <h4 className="font-semibold text-purple-800 mb-3 flex items-center gap-2">
                            <i className="fas fa-pills"></i>
                            Possible Medications (Informational Only)
                          </h4>
                          <ul className="space-y-2">
                            {openAIResponse.medications.map((med, index) => {
  // handle BOTH cases (string OR object)
  if (typeof med === "string") {
    return (
      <li key={index} className="flex items-start gap-2">
        <i className="fas fa-check text-purple-600 mt-1"></i>
        <span className="text-gray-700">{med}</span>
      </li>
    );
  }

  return (
    <li key={index} className="flex items-start gap-2">
      <i className="fas fa-check text-purple-600 mt-1"></i>

      <span className="text-gray-700">
        {med.name && (
          <a
            href={getGoogleLink(med.name)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline font-medium"
          >
            {med.name}
          </a>
        )}

        {med.purpose && `: ${med.purpose}`}
        {med.note && ` (${med.note})`}
      </span>
    </li>
  );
})}
                          </ul>
                          <p className="text-xs text-purple-700 mt-2">
                            Always consult a qualified clinician before starting or stopping any medication.
                          </p>
                        </div>
                      )}

                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 shadow-sm">
                        <h4 className="font-semibold text-amber-800 mb-3 flex items-center gap-2">
                          <i className="fas fa-user-md"></i>
                          When to Consult a Doctor
                        </h4>
                        <p className="text-gray-700">{openAIResponse.doctorConsult}</p>
                      </div>

                      <div className="bg-red-50 border border-red-200 rounded-xl p-5 shadow-sm">
                        <h4 className="font-semibold text-red-800 mb-3 flex items-center gap-2">
                          <i className="fas fa-exclamation-triangle"></i>
                          Important Medical Disclaimer
                        </h4>
                        <p className="text-red-700">{openAIResponse.disclaimer}</p>
                      </div>
                    </div>
                  )}

                  {openAIResponse && !openAILoading && (
                    <div className="mt-6 text-center">
                      <Button 
                        variant="outline"
                        onClick={handleRegenerateRecommendations}
                        className="border-[#8B0000] text-[#8B0000] hover:bg-[#FFE4E1] transition-all duration-300 hover:scale-105"
                      >
                        <i className="fas fa-sync-alt mr-2"></i>
                        Regenerate Recommendations
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Next Steps */}
            <Card className="shadow-2xl hover:shadow-red-900/20 transition-all duration-500 border-0 bg-white/95 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-[#2c1212]">
                  <i className="fas fa-calendar-check text-[#8B0000]"></i>
                  Next Steps & Follow-up
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-gradient-to-br from-blue-50 to-white rounded-xl border border-blue-200 shadow-sm">
                    <h4 className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
                      <i className="fas fa-clock"></i>
                      Recommended Follow-up
                    </h4>
                    <p className="text-gray-700">
                      Based on your {analysis.overallStatus} results, 
                      {analysis.overallStatus === 'low' || analysis.overallStatus === 'high'
                        ? ' schedule a doctor appointment within 2 weeks for further evaluation.'
                        : ' routine follow-up in 6-12 months is recommended.'
                      }
                    </p>
                  </div>
                  
                  <div className="p-4 bg-gradient-to-br from-green-50 to-white rounded-xl border border-green-200 shadow-sm">
                    <h4 className="font-semibold text-green-800 mb-2 flex items-center gap-2">
                      <i className="fas fa-file-medical"></i>
                      Keep This Report
                    </h4>
                    <p className="text-gray-700">
                      Save or print this analysis to share with your healthcare provider. 
                      This will help them understand your health trends.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResultsDisplay;