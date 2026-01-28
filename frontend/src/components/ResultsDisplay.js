import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import api from '../utils/api';

const ResultsDisplay = ({ reportId, cbcData, onBack, onUploadNew }) => {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [openAIResponse, setOpenAIResponse] = useState(null);
  const [openAILoading, setOpenAILoading] = useState(false);
  const [mlResult, setMlResult] = useState(null); // backend ML model output
  const hasAnalyzed = useRef(false);

  const referenceRanges = {
    hemoglobin: { min: 13.5, max: 17.5, unit: 'g/dL' },
    wbc: { min: 4.5, max: 11.0, unit: '×10³/µL' },
    platelets: { min: 150, max: 450, unit: '×10³/µL' },
    rbc: { min: 4.5, max: 5.9, unit: '×10⁶/µL' },
    hematocrit: { min: 41, max: 53, unit: '%' },
    mcv: { min: 80, max: 100, unit: 'fL' },
    mch: { min: 27, max: 33, unit: 'pg' },
    mchc: { min: 32, max: 36, unit: 'g/dL' }
  };

  const analyzeValues = useCallback(() => {
    if (!cbcData) return null;

    const results = {
      parameters: {},
      normalCount: 0,
      abnormalCount: 0,
      criticalCount: 0,
      overallSeverity: 'normal',
      detectedConditions: []
    };

    Object.entries(cbcData).forEach(([key, value]) => {
      const range = referenceRanges[key];
      if (!range || isNaN(value)) return;

      const numValue = parseFloat(value);
      let status = 'normal';
      let severity = 'normal';
      let flag = 'NORMAL';

      if (numValue < range.min) {
        status = 'low';
        const deviation = ((range.min - numValue) / range.min) * 100;
        if (deviation > 20) {
          severity = 'critical';
          flag = 'CRITICAL';
        } else if (deviation > 10) {
          severity = 'abnormal';
          flag = 'LOW';
        } else {
          severity = 'mild';
          flag = 'LOW';
        }
      } else if (numValue > range.max) {
        status = 'high';
        const deviation = ((numValue - range.max) / range.max) * 100;
        if (deviation > 20) {
          severity = 'critical';
          flag = 'CRITICAL';
        } else if (deviation > 10) {
          severity = 'abnormal';
          flag = 'HIGH';
        } else {
          severity = 'mild';
          flag = 'HIGH';
        }
      }

      results.parameters[key] = {
        value: numValue,
        referenceRange: range,
        status,
        severity,
        flag,
        message: generateParameterMessage(key, numValue, range, status)
      };

      if (severity === 'critical') results.criticalCount++;
      else if (severity === 'abnormal' || severity === 'mild') results.abnormalCount++;
      else results.normalCount++;
    });

    // Determine overall severity
    if (results.criticalCount > 0) results.overallSeverity = 'critical';
    else if (results.abnormalCount > 0) results.overallSeverity = 'abnormal';
    else results.overallSeverity = 'normal';

    // Detect possible conditions
    results.detectedConditions = detectConditions(results.parameters);

    return results;
  }, [cbcData, referenceRanges]);

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

    return messages[param]?.[status] || `Value is ${status} compared to normal range.`;
  };

  const detectConditions = (parameters) => {
    const conditions = [];

    if (parameters.hemoglobin?.severity === 'critical' && parameters.hemoglobin?.status === 'low') {
      conditions.push({
        name: 'Anemia',
        confidence: 0.85,
        description: 'Severely low hemoglobin levels may indicate anemia.',
        severity: 'critical',
        recommendations: ['Consult hematologist', 'Iron supplement', 'Diet rich in iron']
      });
    }

    if (parameters.wbc?.severity === 'critical' && parameters.wbc?.status === 'high') {
      conditions.push({
        name: 'Possible Infection',
        confidence: 0.75,
        description: 'Elevated white blood cells may indicate infection.',
        severity: 'critical',
        recommendations: ['Consult doctor', 'Antibiotics if bacterial', 'Rest and hydration']
      });
    }

    if (parameters.platelets?.severity === 'critical') {
      conditions.push({
        name: 'Platelet Disorder',
        confidence: 0.65,
        description: 'Abnormal platelet count may indicate clotting issues.',
        severity: 'critical',
        recommendations: ['Hematology consultation', 'Avoid aspirin', 'Monitor bleeding']
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

      // Ask backend to analyze and get suggestions + ML diagnosis
      const response = await api.post('/analyze', {
        cbcData,
        reportId,
        gender: null
      });

      const backendAnalysis = response.data?.analysis;

      // Capture ML model output from backend
      if (backendAnalysis?.ml) {
        setMlResult(backendAnalysis.ml);
      }

      const suggestions = backendAnalysis?.suggestions;
      if (suggestions) {
        const mapped = {
          dietary: suggestions.dietaryRecommendations || [],
          lifestyle: suggestions.lifestyleSuggestions || [],
          medications: (suggestions.possibleMedications || []).map(med =>
            med && med.name
              ? `${med.name}: ${med.purpose || ''}${med.note ? ` (${med.note})` : ''}`
              : med
          ),
          doctorConsult: suggestions.whenToConsultDoctor || 'Please consult a healthcare provider for proper diagnosis and treatment.',
          disclaimer: suggestions.disclaimer || 'This information is for educational purposes only and not a substitute for professional medical advice.'
        };
        setOpenAIResponse(mapped);
      } else {
        setOpenAIResponse(null);
      }
    } catch (error) {
      console.error('OpenAI recommendations error:', error.response?.data || error.message);
      setMlResult(null);
      setOpenAIResponse(null);
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

    // Simulate analysis with setTimeout
    setTimeout(() => {
      const analysisResults = analyzeValues();
      
      if (analysisResults) {
        setAnalysis(analysisResults);
        hasAnalyzed.current = true;
        
        // Fetch AI-powered recommendations from backend (OpenAI or rule-based)
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

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'abnormal':
      case 'mild': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'normal': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'critical': return 'fas fa-exclamation-triangle';
      case 'abnormal': return 'fas fa-exclamation-circle';
      case 'normal': return 'fas fa-check-circle';
      default: return 'fas fa-info-circle';
    }
  };

  const handleExportPDF = () => {
    if (!analysis || !cbcData) {
      alert('No analysis data available to export');
      return;
    }

    // Create a new window for printing
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to export PDF');
      return;
    }

    // Get current date
    const currentDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Build HTML content for print
    const printHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>CBC Analysis Report - ${currentDate}</title>
          <style>
            @media print {
              @page {
                margin: 1cm;
                size: A4;
              }
            }
            body {
              font-family: 'Arial', sans-serif;
              margin: 0;
              padding: 20px;
              color: #333;
              background: white;
            }
            .header {
              border-bottom: 3px solid #8B0000;
              padding-bottom: 15px;
              margin-bottom: 30px;
            }
            .header h1 {
              color: #8B0000;
              margin: 0 0 5px 0;
              font-size: 28px;
            }
            .header p {
              color: #666;
              margin: 0;
              font-size: 14px;
            }
            .section {
              margin-bottom: 30px;
              page-break-inside: avoid;
            }
            .section-title {
              color: #8B0000;
              font-size: 20px;
              font-weight: bold;
              margin-bottom: 15px;
              border-bottom: 2px solid #FFE4E1;
              padding-bottom: 8px;
            }
            .summary-grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 15px;
              margin-bottom: 20px;
            }
            .summary-item {
              padding: 12px;
              border: 1px solid #ddd;
              border-radius: 5px;
              background: #f9f9f9;
            }
            .summary-item strong {
              color: #8B0000;
              display: block;
              margin-bottom: 5px;
            }
            .parameters-table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 15px;
            }
            .parameters-table th {
              background: #8B0000;
              color: white;
              padding: 12px;
              text-align: left;
              font-weight: bold;
            }
            .parameters-table td {
              padding: 10px 12px;
              border-bottom: 1px solid #ddd;
            }
            .parameters-table tr:nth-child(even) {
              background: #f9f9f9;
            }
            .status-badge {
              display: inline-block;
              padding: 4px 10px;
              border-radius: 12px;
              font-size: 12px;
              font-weight: bold;
            }
            .status-normal { background: #d4edda; color: #155724; }
            .status-abnormal { background: #fff3cd; color: #856404; }
            .status-critical { background: #f8d7da; color: #721c24; }
            .conditions-list {
              list-style: none;
              padding: 0;
            }
            .conditions-list li {
              padding: 10px;
              margin-bottom: 8px;
              border-left: 4px solid #8B0000;
              background: #fff8f8;
            }
            .recommendations {
              background: #f0f8ff;
              padding: 15px;
              border-left: 4px solid #3B82F6;
              margin-top: 15px;
            }
            .recommendations h4 {
              color: #1e40af;
              margin-top: 0;
            }
            .recommendations ul {
              margin: 10px 0;
              padding-left: 20px;
            }
            .disclaimer {
              margin-top: 40px;
              padding: 15px;
              background: #fff3cd;
              border: 1px solid #ffc107;
              border-radius: 5px;
              font-size: 12px;
              color: #856404;
            }
            .footer {
              margin-top: 40px;
              padding-top: 20px;
              border-top: 1px solid #ddd;
              text-align: center;
              color: #666;
              font-size: 12px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Health Monitoring Hub - CBC Analysis Report</h1>
            <p>Generated on ${currentDate}</p>
          </div>

          <div class="section">
            <div class="section-title">Overall Summary</div>
            <div class="summary-grid">
              <div class="summary-item">
                <strong>Overall Status:</strong>
                <span class="status-badge status-${analysis.overallSeverity}">
                  ${analysis.overallSeverity.toUpperCase()}
                </span>
              </div>
              <div class="summary-item">
                <strong>Normal Parameters:</strong> ${analysis.normalCount}
              </div>
              <div class="summary-item">
                <strong>Abnormal Parameters:</strong> ${analysis.abnormalCount}
              </div>
              <div class="summary-item">
                <strong>Critical Parameters:</strong> ${analysis.criticalCount}
              </div>
            </div>
            ${analysis.summary ? `<p style="margin-top: 15px; line-height: 1.6;">${analysis.summary}</p>` : ''}
          </div>

          <div class="section">
            <div class="section-title">CBC Parameters Analysis</div>
            <table class="parameters-table">
              <thead>
                <tr>
                  <th>Parameter</th>
                  <th>Value</th>
                  <th>Reference Range</th>
                  <th>Status</th>
                  <th>Flag</th>
                </tr>
              </thead>
              <tbody>
                ${Object.entries(analysis.parameters)
                  .map(([key, param]) => `
                    <tr>
                      <td><strong>${param.label || key.toUpperCase()}</strong></td>
                      <td>${param.value} ${param.unit || ''}</td>
                      <td>${param.referenceRange.min} - ${param.referenceRange.max} ${param.unit || ''}</td>
                      <td>
                        <span class="status-badge status-${param.severity}">
                          ${param.severity.toUpperCase()}
                        </span>
                      </td>
                      <td><strong>${param.flag}</strong></td>
                    </tr>
                  `).join('')}
              </tbody>
            </table>
          </div>

          ${analysis.detectedConditions && analysis.detectedConditions.length > 0 ? `
          <div class="section">
            <div class="section-title">Detected Conditions</div>
            <ul class="conditions-list">
              ${analysis.detectedConditions.map(cond => `
                <li>
                  <strong>${cond.condition}</strong>
                  ${cond.severity ? ` - ${cond.severity.toUpperCase()}` : ''}
                  ${cond.description ? `<br><small>${cond.description}</small>` : ''}
                </li>
              `).join('')}
            </ul>
          </div>
          ` : ''}

          ${openAIResponse ? `
          <div class="section">
            <div class="section-title">AI-Powered Recommendations</div>
            ${openAIResponse.dietaryRecommendations && openAIResponse.dietaryRecommendations.length > 0 ? `
              <div class="recommendations">
                <h4>Dietary Recommendations</h4>
                <ul>
                  ${openAIResponse.dietaryRecommendations.map(rec => `<li>${rec}</li>`).join('')}
                </ul>
              </div>
            ` : ''}
            ${openAIResponse.lifestyleSuggestions && openAIResponse.lifestyleSuggestions.length > 0 ? `
              <div class="recommendations">
                <h4>Lifestyle Suggestions</h4>
                <ul>
                  ${openAIResponse.lifestyleSuggestions.map(sug => `<li>${sug}</li>`).join('')}
                </ul>
              </div>
            ` : ''}
            ${openAIResponse.possibleMedications && openAIResponse.possibleMedications.length > 0 ? `
              <div class="recommendations">
                <h4>Possible Medications (Informational Only)</h4>
                <ul>
                  ${openAIResponse.possibleMedications.map(med => `<li>${med}</li>`).join('')}
                </ul>
              </div>
            ` : ''}
          </div>
          ` : ''}

          <div class="disclaimer">
            <strong>⚠️ DISCLAIMER:</strong> This analysis is for informational and educational purposes only. 
            It is NOT a substitute for professional medical advice, diagnosis, or treatment. 
            Always seek the advice of your physician or other qualified health provider with any questions 
            you may have regarding a medical condition.
          </div>

          <div class="footer">
            <p>Health Monitoring Hub - AI-Powered CBC Analysis</p>
            <p>Report ID: ${reportId || 'N/A'} | Generated: ${currentDate}</p>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(printHTML);
    printWindow.document.close();

    // Wait for content to load, then trigger print
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
      // Close window after printing (optional)
      // printWindow.close();
    }, 250);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-[#fff8f8] to-[#FFE4E1] p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 md:mb-8">
          <button 
            onClick={onBack}
            className="flex items-center gap-2 text-[#8B0000] hover:text-[#B22222] mb-4 group transition-colors"
          >
            <i className="fas fa-arrow-left group-hover:-translate-x-1 transition-transform"></i>
            <span className="font-medium">Back to Dashboard</span>
          </button>
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-[#8B0000] mb-2">
                CBC Analysis Results
              </h1>
              <p className="text-gray-600">
                AI-powered analysis of your complete blood count report
        </p>
      </div>

            <div className="flex gap-3">
              <Button 
                variant="outline"
                onClick={handleExportPDF}
                className="border-[#8B0000] text-[#8B0000] hover:bg-[#FFE4E1]"
              >
                <i className="fas fa-download mr-2"></i>
                Export Report
              </Button>
              <Button 
                onClick={onUploadNew}
                className="bg-[#8B0000] hover:bg-[#B22222] text-white"
              >
                <i className="fas fa-plus mr-2"></i>
                New Analysis
              </Button>
        </div>
          </div>
        </div>

        {/* Clinical Disclaimer */}
        <Alert className="mb-6 border-amber-200 bg-amber-50">
          <i className="fas fa-exclamation-triangle text-amber-600 mt-1"></i>
          <AlertDescription className="text-amber-800">
            <strong>Important Disclaimer:</strong> This analysis is for informational purposes only. 
            Always consult with a qualified healthcare professional for medical advice and diagnosis.
          </AlertDescription>
        </Alert>

        {/* Loading State */}
        {loading && (
          <div className="space-y-4">
            <div className="skeleton-card" style={{ height: '120px' }}></div>
            <div className="skeleton-card" style={{ height: '400px' }}></div>
            <div className="text-center text-gray-600 py-8">
              <i className="fas fa-spinner fa-spin text-2xl text-[#8B0000] mb-2"></i>
              <p>Analyzing your CBC values...</p>
            </div>
              </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <Card className="border-red-200 bg-red-50 shadow-lg mb-6">
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
            <Card className="shadow-lg border-2 border-[#8B0000]/10">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-[#8B0000]">
                      <i className="fas fa-chart-line"></i>
                      Overall Assessment
                    </CardTitle>
                    <CardDescription>
                      Summary of your CBC analysis results
                    </CardDescription>
              </div>
                  <div className={`px-4 py-2 rounded-full font-semibold ${getSeverityColor(analysis.overallSeverity)}`}>
                    <i className={`${getSeverityIcon(analysis.overallSeverity)} mr-2`}></i>
                    {analysis.overallSeverity.toUpperCase()}
            </div>
          </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
                    <div className="text-2xl font-bold text-green-700">{analysis.normalCount}</div>
                    <div className="text-sm text-gray-600">Normal</div>
                  </div>
                  <div className="text-center p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                    <div className="text-2xl font-bold text-yellow-700">{analysis.abnormalCount}</div>
                    <div className="text-sm text-gray-600">Abnormal</div>
                  </div>
                  <div className="text-center p-4 bg-red-50 rounded-lg border border-red-200">
                    <div className="text-2xl font-bold text-red-700">{analysis.criticalCount}</div>
                    <div className="text-sm text-gray-600">Critical</div>
                  </div>
                  <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="text-2xl font-bold text-blue-700">{Object.keys(analysis.parameters).length}</div>
                    <div className="text-sm text-gray-600">Total Parameters</div>
                  </div>
                </div>
                
                {analysis.detectedConditions.length > 0 && (
                  <div className="mt-4">
                    <h4 className="font-semibold text-gray-900 mb-2">⚠️ Detected Conditions</h4>
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

            {/* ML Diagnosis (model output from Python service) */}
            {mlResult && (
              <Card className="shadow-lg border border-indigo-200">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-indigo-800">
                        <i className="fas fa-brain"></i>
                        ML Diagnosis
                      </CardTitle>
                      <CardDescription>
                        Output from trained CBC model (severity and top predictions)
                      </CardDescription>
                    </div>
                    <div className="px-3 py-1 rounded-full text-sm font-semibold bg-indigo-50 text-indigo-800 border border-indigo-200">
                      {mlResult.severity ? mlResult.severity.toUpperCase() : 'N/A'}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 rounded-lg bg-indigo-50 border border-indigo-200">
                      <h4 className="font-semibold text-indigo-800 mb-1">Model Severity</h4>
                      <p className="text-2xl font-bold text-indigo-900">
                        {mlResult.severity ? mlResult.severity.toUpperCase() : 'N/A'}
                      </p>
                      {typeof mlResult.confidence === 'number' && (
                        <p className="text-sm text-indigo-700 mt-1">
                          Confidence: {(mlResult.confidence * 100).toFixed(0)}%
                        </p>
                      )}
                    </div>
                    <div className="md:col-span-2 p-4 rounded-lg bg-white border border-gray-200">
                      <h4 className="font-semibold text-gray-900 mb-2">Top Model Predictions</h4>
                      {mlResult.predictions && Object.keys(mlResult.predictions).length > 0 ? (
                        <ul className="space-y-1">
                          {Object.entries(mlResult.predictions)
                            .sort((a, b) => b[1] - a[1])
                            .slice(0, 3)
                            .map(([label, prob], idx) => (
                              <li key={label} className="flex items-center justify-between text-sm">
                                <span className="text-gray-800">
                                  {idx + 1}. {label}
                                </span>
                                <span className="font-semibold text-indigo-700">
                                  {(prob * 100).toFixed(1)}%
                                </span>
                              </li>
                            ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-gray-600">
                          No prediction breakdown available for this analysis.
                        </p>
                      )}
                      {mlResult.note && (
                        <p className="text-xs text-gray-500 mt-2">
                          {mlResult.note}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Parameter Details */}
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <i className="fas fa-microscope text-[#8B0000]"></i>
                  Parameter Details
                </CardTitle>
                <CardDescription>
                  Detailed breakdown of each CBC parameter
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(analysis.parameters).map(([key, param]) => {
                    const range = param.referenceRange || {};
                    const min = range.min ?? 0;
                    const max = range.max ?? 0;
                    const val = parseFloat(param.value) || 0;
                    const span = max - min || 1;
                    const raw = ((val - min) / span) * 100;
                    const clampedWidth = Math.max(0, Math.min(100, raw));
                
                return (
                      <div 
                        key={key} 
                        className={`p-4 rounded-lg border ${
                          param.severity === 'critical' ? 'border-red-300 bg-red-50' :
                          param.severity === 'abnormal' || param.severity === 'mild' ? 'border-yellow-300 bg-yellow-50' :
                          'border-green-300 bg-green-50'
                        }`}
                      >
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-semibold text-gray-900 capitalize">{key}</span>
                          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                            param.flag === 'CRITICAL' ? 'bg-red-100 text-red-800' :
                            param.flag === 'HIGH' || param.flag === 'LOW' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                        {param.flag}
                          </span>
                        </div>
                        
                        <div className="text-center my-3">
                          <div className="text-2xl font-bold text-gray-900">{param.value}</div>
                          <div className="text-sm text-gray-600">{param.referenceRange.unit}</div>
                      </div>
                      
                        <div className="text-xs text-gray-600 mb-2">
                          Normal range: {param.referenceRange.min} - {param.referenceRange.max} {param.referenceRange.unit}
                        </div>
                        
                        <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                          <div 
                            className={`h-2 rounded-full ${
                              param.severity === 'critical' ? 'bg-red-500' :
                              param.severity === 'abnormal' ? 'bg-yellow-500' :
                              'bg-green-500'
                            }`}
                            style={{ width: `${clampedWidth}%` }}
                          ></div>
                        </div>
                        
                        <p className="text-sm text-gray-700 mt-2">{param.message}</p>
                  </div>
                );
              })}
            </div>
              </CardContent>
            </Card>

            {/* AI Recommendations Section */}
            <Card className="shadow-lg border-2 border-[#8B0000]/20">
              <CardHeader className="bg-gradient-to-r from-[#fff8f8] to-white">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-[#8B0000]">
                      <i className="fas fa-robot"></i>
                      AI-Powered Recommendations
                    </CardTitle>
                    <CardDescription>
                      Personalized suggestions based on your CBC results
                    </CardDescription>
                    </div>
                  <div className="px-3 py-1 bg-[#FFE4E1] text-[#8B0000] rounded-full text-sm font-semibold">
                    OpenAI Powered
                  </div>
              </div>
              </CardHeader>
              
              <CardContent className="p-6">
                {/* Loading State for OpenAI */}
                {openAILoading && (
                  <div className="text-center py-8">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#8B0000] mb-3"></div>
                    <p className="text-gray-600">Generating personalized recommendations...</p>
                </div>
              )}

                {/* OpenAI Response */}
                {openAIResponse && !openAILoading && (
                  <div className="space-y-6">
                    {/* Dietary Recommendations */}
                    <div className="bg-green-50 border border-green-200 rounded-xl p-5">
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

                    {/* Lifestyle Suggestions */}
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
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

                {/* Medicines (Informational Only) */}
                {openAIResponse.medications && openAIResponse.medications.length > 0 && (
                  <div className="bg-purple-50 border border-purple-200 rounded-xl p-5">
                    <h4 className="font-semibold text-purple-800 mb-3 flex items-center gap-2">
                      <i className="fas fa-pills"></i>
                      Medicines (Informational Only)
                    </h4>
                    <ul className="space-y-2">
                      {openAIResponse.medications.map((med, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <i className="fas fa-check text-purple-600 mt-1"></i>
                          <span className="text-gray-700">{med}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="text-xs text-purple-700 mt-2">
                      Always consult a qualified clinician before starting or stopping any medication.
                    </p>
                  </div>
                )}

                    {/* When to Consult Doctor */}
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
                      <h4 className="font-semibold text-amber-800 mb-3 flex items-center gap-2">
                        <i className="fas fa-user-md"></i>
                        When to Consult a Doctor
                      </h4>
                      <p className="text-gray-700">{openAIResponse.doctorConsult}</p>
                </div>

                    {/* Disclaimer */}
                    <div className="bg-red-50 border border-red-200 rounded-xl p-5">
                      <h4 className="font-semibold text-red-800 mb-3 flex items-center gap-2">
                        <i className="fas fa-exclamation-triangle"></i>
                        Important Medical Disclaimer
                      </h4>
                      <p className="text-red-700">{openAIResponse.disclaimer}</p>
              </div>
            </div>
          )}

                {/* Regenerate Button */}
                {openAIResponse && !openAILoading && (
                  <div className="mt-6 text-center">
                    <Button 
                      variant="outline"
                      onClick={() => fetchOpenAIRecommendations(analysis)}
                      className="border-[#8B0000] text-[#8B0000] hover:bg-[#FFE4E1]"
                    >
                      <i className="fas fa-sync-alt mr-2"></i>
                      Regenerate Recommendations
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Next Steps */}
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <i className="fas fa-calendar-check text-[#8B0000]"></i>
                  Next Steps & Follow-up
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-gradient-to-br from-blue-50 to-white rounded-xl border border-blue-200">
                    <h4 className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
                      <i className="fas fa-clock"></i>
                      Recommended Follow-up
                    </h4>
                    <p className="text-gray-700">
                      Based on your {analysis.overallSeverity} results, 
                      {analysis.overallSeverity === 'critical' 
                        ? ' consult a healthcare professional immediately.' 
                        : analysis.overallSeverity === 'abnormal'
                        ? ' schedule a doctor appointment within 2 weeks.'
                        : ' routine follow-up in 6-12 months is recommended.'
                      }
                    </p>
                  </div>
                  
                  <div className="p-4 bg-gradient-to-br from-green-50 to-white rounded-xl border border-green-200">
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

        {/* Raw Data Display (if no analysis yet) */}
        {!analysis && !loading && cbcData && (
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <i className="fas fa-list text-[#8B0000]"></i>
                Extracted CBC Values
              </CardTitle>
              <CardDescription>
                Values extracted from your uploaded report
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {Object.entries(cbcData).map(([key, value]) => (
                  <div key={key} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="font-semibold text-gray-900 capitalize mb-1">{key}</div>
                    <div className="text-xl font-bold text-[#8B0000]">{value}</div>
                    <div className="text-xs text-gray-600 mt-1">
                      {referenceRanges[key]?.unit || 'units'}
                </div>
              </div>
            ))}
          </div>
              
              <div className="mt-6 text-center">
                <Button 
                  onClick={handleAnalyze}
                  className="bg-[#8B0000] hover:bg-[#B22222] text-white shadow-lg"
                >
                  <i className="fas fa-brain mr-2"></i>
                  Analyze with AI
                </Button>
            </div>
            </CardContent>
          </Card>
        )}
        </div>
    </div>
  );
};

export default ResultsDisplay;