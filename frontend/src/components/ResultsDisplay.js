import React, { useState, useEffect } from 'react';
import axios from 'axios';

function ResultsDisplay({ reportId, cbcData, onBack, onAnalyze }) {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [gender, setGender] = useState('');

  useEffect(() => {
    if (reportId && cbcData) {
      // Auto-analyze when component loads
      handleAnalyze();
    }
  }, [reportId, cbcData]);

  const handleAnalyze = async () => {
    if (!cbcData) {
      setError('No CBC data available for analysis');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await axios.post('http://localhost:5000/api/analyze', {
        cbcData: cbcData,
        reportId: reportId,
        gender: gender || undefined
      });

      setAnalysis(response.data.analysis);
      console.log('Analysis completed:', response.data);
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'Analysis failed.';
      setError(errorMessage);
      console.error('Analysis error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return '#dc3545';
      case 'abnormal': return '#ffc107';
      case 'normal': return '#28a745';
      default: return '#6c757d';
    }
  };

  const getSeverityBadge = (severity) => {
    const color = getSeverityColor(severity);
    return (
      <span style={{ 
        backgroundColor: color, 
        color: 'white', 
        padding: '4px 12px', 
        borderRadius: '12px',
        fontSize: '14px',
        fontWeight: 'bold'
      }}>
        {severity.toUpperCase()}
      </span>
    );
  };

  return (
    <div className="results-container">
      <div className="results-header">
        <h2>Analysis Results</h2>
        {onBack && (
          <button onClick={onBack} className="btn-secondary">
            ← Back
          </button>
        )}
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {loading && (
        <div className="loading-message">
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
            <h3>Parameter Details</h3>
            <div className="parameters-grid">
              {Object.entries(analysis.ruleBased.parameters).map(([key, param]) => (
                <div 
                  key={key} 
                  className={`parameter-item ${param.severity}`}
                >
                  <div className="parameter-header">
                    <span className="parameter-name">{key.toUpperCase()}</span>
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

          {/* ML Results */}
          {analysis.ml && (
            <div className="ml-card">
              <h3>ML Analysis</h3>
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

          {/* Re-analyze with gender */}
          <div className="reanalyze-section">
            <label>
              Gender (optional, for better analysis):
              <select 
                value={gender} 
                onChange={(e) => setGender(e.target.value)}
                style={{ marginLeft: '10px', padding: '5px' }}
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

      {!analysis && !loading && !error && (
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

