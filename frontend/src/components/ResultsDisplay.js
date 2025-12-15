import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';

function ResultsDisplay({ reportId, cbcData, onBack, onAnalyze }) {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [gender, setGender] = useState('');
  const hasAnalyzed = useRef(false);

  const handleAnalyze = useCallback(async () => {
    if (!cbcData) {
      setError('No CBC data available for analysis');
      console.error('No cbcData provided to ResultsDisplay');
      return;
    }

    if (loading) {
      console.log('Analysis already in progress, skipping...');
      return;
    }

    console.log('Starting analysis with data:', cbcData);
    setLoading(true);
    setError(null);

    try {
      const response = await axios.post('http://localhost:5000/api/analyze', {
        cbcData: cbcData,
        reportId: reportId,
        gender: gender || undefined
      });

      console.log('Analysis API response:', response.data);
      if (response.data && response.data.analysis) {
        setAnalysis(response.data.analysis);
        console.log('Analysis completed successfully');
        hasAnalyzed.current = true;
      } else {
        throw new Error('Invalid response format from analysis API');
      }
    } catch (err) {
      console.error('Analysis error details:', err);
      console.error('Error response:', err.response);
      const errorMessage = err.response?.data?.message || err.message || 'Analysis failed.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [cbcData, reportId, gender, loading]);

  useEffect(() => {
    console.log('ResultsDisplay - reportId:', reportId);
    console.log('ResultsDisplay - cbcData:', cbcData);
    
    // Reset hasAnalyzed when data changes
    if (cbcData) {
      hasAnalyzed.current = false;
    }
  }, [reportId, cbcData]);

  useEffect(() => {
    if (reportId && cbcData && !hasAnalyzed.current && !loading) {
      // Auto-analyze when component loads with new data
      console.log('Auto-analyzing with new data...');
      handleAnalyze();
    } else if (!cbcData && reportId) {
      console.warn('Missing data - reportId:', reportId, 'cbcData:', cbcData);
      setError('No CBC data received. Please try uploading again.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId, cbcData]);

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return '#dc3545';
      case 'abnormal': return '#ffc107';
      case 'normal': return '#28a745';
      default: return '#6c757d';
    }
  };

  const getSeverityBadge = (severity) => {
    return (
      <span className={`parameter-flag ${severity}`}>
        {severity.toUpperCase()}
      </span>
    );
  };

  const handleExportPDF = () => {
    window.print();
  };

  const getTooltipText = (paramName) => {
    const tooltips = {
      'hemoglobin': 'Hemoglobin carries oxygen in your blood. Low levels may indicate anemia.',
      'rbc': 'Red Blood Cells transport oxygen. Abnormal counts can indicate various conditions.',
      'wbc': 'White Blood Cells fight infections. High levels may indicate infection or inflammation.',
      'platelets': 'Platelets help with blood clotting. Low levels increase bleeding risk.',
      'hematocrit': 'Hematocrit is the percentage of red blood cells in your blood.',
      'mcv': 'Mean Corpuscular Volume measures average red blood cell size.',
      'mch': 'Mean Corpuscular Hemoglobin measures average hemoglobin per red blood cell.',
      'mchc': 'Mean Corpuscular Hemoglobin Concentration measures hemoglobin concentration.'
    };
    return tooltips[paramName.toLowerCase()] || 'Medical parameter in your CBC report.';
  };

  const getNextCheckDate = (severity) => {
    const days = severity === 'critical' ? 7 : severity === 'abnormal' ? 30 : 90;
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toLocaleDateString();
  };

  // Safety check - if no data at all, show error
  if (!cbcData && !reportId) {
    return (
      <div className="results-container">
        <div className="error-message">
          No data available. Please upload a report or enter values manually.
        </div>
        {onBack && (
          <button onClick={onBack} className="btn-primary" style={{ marginTop: '1rem' }}>
            ← Go Back
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="results-container">
      <div className="results-header">
        <div>
          <h2>Analysis Results</h2>
          <div className="report-meta">
            <span className="meta-item">
              📅 {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}
            </span>
          </div>
        </div>
        {onBack && (
          <button onClick={onBack} className="btn-secondary">
            ← Back
          </button>
        )}
      </div>

      {/* Clinical Disclaimer */}
      <div className="clinical-disclaimer">
        <strong>⚠️ Important Clinical Disclaimer</strong>
        <p>
          Insights are AI-assisted and for awareness only — not a replacement for medical advice. 
          Please consult with a qualified healthcare professional for proper diagnosis and treatment.
        </p>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {loading && (
        <div className="loading-message">
          <div className="skeleton-loader">
            <div className="skeleton-card" style={{ height: '100px' }}></div>
          </div>
          Analyzing CBC values...
        </div>
      )}

      {analysis && (
        <div className="analysis-results">
          {/* Overall Summary */}
          <div className="summary-card">
            <h3>Overall Assessment</h3>
            <div className="severity-display">
              {getSeverityBadge(analysis.overallSeverity)}
            </div>
            <p className="summary-message">{analysis.summary.summaryMessage}</p>
            <div className="summary-stats">
              <div className="stat">
                <span className="stat-label">Total Parameters:</span>
                <span className="stat-value">{analysis.summary.totalParameters}</span>
              </div>
              <div className="stat">
                <span className="stat-label">Normal:</span>
                <span className="stat-value normal">{analysis.summary.normalCount}</span>
              </div>
              <div className="stat">
                <span className="stat-label">Abnormal:</span>
                <span className="stat-value abnormal">{analysis.summary.abnormalCount}</span>
              </div>
              <div className="stat">
                <span className="stat-label">Critical:</span>
                <span className="stat-value critical">{analysis.summary.criticalCount}</span>
              </div>
            </div>
          </div>

          {/* Parameter Details */}
          <div className="parameters-card">
            <h3>🧬 Parameter Details</h3>
            <div className="parameters-grid">
              {Object.entries(analysis.ruleBased.parameters).map(([key, param]) => (
                <div 
                  key={key} 
                  className={`parameter-item ${param.severity}`}
                >
                  <div className="parameter-header">
                    <span className="parameter-name tooltip">
                      {key.toUpperCase()}
                      <span className="tooltiptext">{getTooltipText(key)}</span>
                    </span>
                    <span className={`parameter-flag ${param.flag.toLowerCase()}`}>
                      {param.flag}
                    </span>
                  </div>
                  <div className="parameter-value">
                    {param.value} {param.referenceRange.unit}
                  </div>
                  <div className="parameter-range">
                    Range: {param.referenceRange.min} - {param.referenceRange.max} {param.referenceRange.unit}
                  </div>
                  <div className="parameter-message">
                    {param.message}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Detailed Analysis for Each Parameter */}
          <div className="parameters-card" style={{ marginTop: '2rem' }}>
            <h3>📊 Detailed Analysis for Each Parameter</h3>
            <p className="section-subtitle">Comprehensive breakdown of each CBC parameter</p>
            <div className="parameters-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
              {Object.entries(analysis.ruleBased.parameters).map(([key, param]) => {
                const paramName = key.charAt(0).toUpperCase() + key.slice(1);
                const isInRange = param.value >= param.referenceRange.min && param.value <= param.referenceRange.max;
                const isLow = param.value < param.referenceRange.min;
                const isHigh = param.value > param.referenceRange.max;
                const deviation = isLow 
                  ? ((param.referenceRange.min - param.value) / param.referenceRange.min * 100).toFixed(1)
                  : isHigh
                  ? ((param.value - param.referenceRange.max) / param.referenceRange.max * 100).toFixed(1)
                  : 0;
                
                return (
                  <div 
                    key={key} 
                    className={`parameter-item ${param.severity}`}
                    style={{ 
                      borderLeft: `4px solid ${getSeverityColor(param.severity)}`,
                      padding: '1.5rem',
                      marginBottom: '1rem'
                    }}
                  >
                    <div className="parameter-header" style={{ marginBottom: '1rem' }}>
                      <span className="parameter-name" style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>
                        {paramName}
                      </span>
                      <span className={`parameter-flag ${param.flag.toLowerCase()}`}>
                        {param.flag}
                      </span>
                    </div>
                    
                    <div style={{ display: 'grid', gap: '0.75rem', fontSize: '0.9rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid #e5e7eb' }}>
                        <span style={{ color: '#6b7280' }}>Current Value:</span>
                        <span style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>
                          {param.value} {param.referenceRange.unit}
                        </span>
                      </div>
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#6b7280' }}>Reference Range:</span>
                        <span>
                          {param.referenceRange.min} - {param.referenceRange.max} {param.referenceRange.unit}
                        </span>
                      </div>
                      
                      {!isInRange && (
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#6b7280' }}>Deviation:</span>
                          <span style={{ color: isLow ? '#3b82f6' : '#ef4444', fontWeight: '600' }}>
                            {deviation}% {isLow ? 'below' : 'above'} normal
                          </span>
                        </div>
                      )}
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#6b7280' }}>Status:</span>
                        <span style={{ 
                          padding: '0.25rem 0.75rem',
                          borderRadius: '9999px',
                          fontSize: '0.75rem',
                          fontWeight: '600',
                          backgroundColor: isInRange ? '#d1fae5' : isLow ? '#dbeafe' : '#fee2e2',
                          color: isInRange ? '#065f46' : isLow ? '#1e40af' : '#991b1b'
                        }}>
                          {isInRange ? 'Normal' : isLow ? 'Low' : 'High'}
                        </span>
                      </div>
                      
                      <div style={{ paddingTop: '0.75rem', borderTop: '1px solid #e5e7eb', marginTop: '0.5rem' }}>
                        <div style={{ color: '#6b7280', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                          Interpretation:
                        </div>
                        <div style={{ color: '#374151', lineHeight: '1.5' }}>
                          {param.message}
                        </div>
                      </div>
                      
                      <div style={{ paddingTop: '0.5rem', fontSize: '0.75rem', color: '#9ca3af' }}>
                        <div style={{ marginBottom: '0.25rem' }}>
                          <strong>Clinical Significance:</strong>
                        </div>
                        <div style={{ lineHeight: '1.4' }}>
                          {getTooltipText(key)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Possible Conditions */}
          {analysis.conditions && analysis.conditions.length > 0 && (
            <div className="conditions-card">
              <h3>🧬 Possible Conditions</h3>
              <p className="section-subtitle">Based on ML analysis and risk indicators</p>
              <div className="conditions-list">
                {analysis.conditions.map((condition, index) => (
                  <div key={index} className={`condition-item ${condition.severity}`}>
                    <div className="condition-header">
                      <h4>{condition.condition}</h4>
                      <span className={`parameter-flag ${condition.severity}`}>
                        {condition.severity.toUpperCase()}
                      </span>
                    </div>
                    <p className="condition-description">{condition.description}</p>
                    {condition.possibleCauses && condition.possibleCauses.length > 0 && (
                      <div className="possible-causes">
                        <strong>Possible Causes:</strong>
                        <ul>
                          {condition.possibleCauses.map((cause, i) => (
                            <li key={i}>{cause}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <div className="condition-confidence">
                      Confidence: {(condition.confidence * 100).toFixed(0)}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Diet and Medication Suggestions */}
          {analysis.suggestions && (
            <div className="suggestions-card">
              <h3>💡 Recommendations</h3>
              
              {analysis.suggestions.dietaryRecommendations && analysis.suggestions.dietaryRecommendations.length > 0 && (
                <div className="suggestion-section">
                  <h4>🍎 Dietary Recommendations</h4>
                  <ul className="suggestion-list">
                    {analysis.suggestions.dietaryRecommendations.map((rec, index) => (
                      <li key={index}>{rec}</li>
                    ))}
                  </ul>
                </div>
              )}

              {analysis.suggestions.lifestyleSuggestions && analysis.suggestions.lifestyleSuggestions.length > 0 && (
                <div className="suggestion-section">
                  <h4>🏃 Lifestyle Suggestions</h4>
                  <ul className="suggestion-list">
                    {analysis.suggestions.lifestyleSuggestions.map((suggestion, index) => (
                      <li key={index}>{suggestion}</li>
                    ))}
                  </ul>
                </div>
              )}

              {analysis.suggestions.possibleMedications && analysis.suggestions.possibleMedications.length > 0 && (
                <div className="suggestion-section">
                  <h4>💊 Possible Medications (Informational Only)</h4>
                  <div className="medications-list">
                    {analysis.suggestions.possibleMedications.map((med, index) => (
                      <div key={index} className="medication-item">
                        <strong>{med.name}</strong>
                        <p className="med-purpose">{med.purpose}</p>
                        {med.note && <p className="med-note">ℹ️ {med.note}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {analysis.suggestions.whenToConsultDoctor && (
                <div className="suggestion-section">
                  <h4>👨‍⚕️ When to Consult a Doctor</h4>
                  <p>{analysis.suggestions.whenToConsultDoctor}</p>
                </div>
              )}

              {analysis.suggestions.disclaimer && (
                <div className="disclaimer-box">
                  <strong>⚠️ Important Disclaimer:</strong>
                  <p>{analysis.suggestions.disclaimer}</p>
                </div>
              )}

              {analysis.suggestions.note && (
                <p className="suggestion-note">{analysis.suggestions.note}</p>
              )}

              {/* Reference Links */}
              <div className="reference-links">
                <h4>📎 Reference Sources</h4>
                <ul>
                  <li>
                    <a href="https://www.mayoclinic.org/tests-procedures/complete-blood-count/about/pac-20384961" target="_blank" rel="noopener noreferrer">
                      ↗ Mayo Clinic - Complete Blood Count Guide
                    </a>
                  </li>
                  <li>
                    <a href="https://www.healthline.com/health/complete-blood-count" target="_blank" rel="noopener noreferrer">
                      ↗ Healthline - Understanding CBC Results
                    </a>
                  </li>
                  <li>
                    <a href="https://medlineplus.gov/lab-tests/complete-blood-count-cbc/" target="_blank" rel="noopener noreferrer">
                      ↗ MedlinePlus - CBC Test Information
                    </a>
                  </li>
                </ul>
              </div>

              {/* Next Check Reminder */}
              <div className="next-check-reminder">
                <span className="reminder-icon">📌</span>
                <div className="reminder-content">
                  <h4>Next Check Reminder</h4>
                  <p>
                    Based on your current severity level ({analysis.overallSeverity}), 
                    we recommend your next CBC test around <strong>{getNextCheckDate(analysis.overallSeverity)}</strong>.
                    {analysis.overallSeverity === 'critical' && ' Please consult a doctor immediately.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ML Results */}
          {analysis.ml && (
            <div className="ml-card">
              <h3>
                <span className="ai-badge">✨ AI Severity Detection</span>
              </h3>
              <div className="ml-confidence">
                <span>Confidence: {(analysis.ml.confidence * 100).toFixed(0)}%</span>
              </div>
              {analysis.ml.predictions && (
                <div className="ml-predictions">
                  <div className="prediction-item">
                    <span>Normal: {(analysis.ml.predictions.normal * 100).toFixed(0)}%</span>
                  </div>
                  <div className="prediction-item">
                    <span>Mild: {(analysis.ml.predictions.mild * 100).toFixed(0)}%</span>
                  </div>
                  <div className="prediction-item">
                    <span>Critical: {(analysis.ml.predictions.critical * 100).toFixed(0)}%</span>
                  </div>
                </div>
              )}
              {analysis.ml.note && (
                <p className="ml-note">{analysis.ml.note}</p>
              )}
            </div>
          )}

          {/* Export Actions */}
          <div className="export-actions">
            <button onClick={handleExportPDF} className="btn-export">
              📄 Export as PDF
            </button>
            <button className="btn-secondary">
              🔗 Share with Doctor
            </button>
          </div>

          {/* Re-analyze with gender */}
          <div className="reanalyze-section">
            <label>
              Gender (optional, for better analysis):
              <select 
                value={gender} 
                onChange={(e) => setGender(e.target.value)}
              >
                <option value="">Select...</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </label>
            <button 
              onClick={handleAnalyze} 
              className="btn-primary"
              disabled={loading}
            >
              Re-analyze
            </button>
          </div>
        </div>
      )}

      {/* Show extracted data even if analysis hasn't completed */}
      {cbcData && !analysis && !loading && (
        <div className="summary-card">
          <h3>📋 Extracted CBC Values</h3>
          <p className="summary-message">The following values were extracted from your report:</p>
          <div className="parameters-grid">
            {Object.entries(cbcData).filter(([key]) => 
              !['extractionMethod', 'confidence', 'extractedAt'].includes(key)
            ).map(([key, value]) => (
              <div key={key} className="parameter-item">
                <div className="parameter-header">
                  <span className="parameter-name">{key.toUpperCase()}</span>
                </div>
                <div className="parameter-value">
                  {value} {key === 'hemoglobin' || key === 'mchc' ? 'g/dL' : 
                           key === 'rbc' ? 'million cells/μL' :
                           key === 'wbc' || key === 'platelets' ? 'cells/μL' :
                           key === 'hematocrit' || key === 'rdw' ? '%' :
                           key === 'mcv' ? 'fL' : key === 'mch' ? 'pg' : ''}
                </div>
              </div>
            ))}
          </div>
          {error && (
            <div className="error-message" style={{ marginTop: '1rem' }}>
              {error}
            </div>
          )}
          <button onClick={handleAnalyze} className="btn-primary" style={{ marginTop: '1rem' }}>
            Analyze Now
          </button>
        </div>
      )}

      {!analysis && !loading && !error && !cbcData && (
        <div className="no-data">
          <p>No analysis data available. Click "Analyze" to start.</p>
          <button onClick={handleAnalyze} className="btn-primary">
            Analyze Now
          </button>
        </div>
      )}
    </div>
  );
}

export default ResultsDisplay;

