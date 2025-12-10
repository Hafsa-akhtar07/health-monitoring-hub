import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

function HistoryGraph({ userId = null }) {
  const [trendData, setTrendData] = useState([]);
  const [selectedParameter, setSelectedParameter] = useState('hemoglobin');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const parameters = [
    { value: 'hemoglobin', label: 'Hemoglobin (g/dL)' },
    { value: 'rbc', label: 'RBC (million cells/μL)' },
    { value: 'wbc', label: 'WBC (cells/μL)' },
    { value: 'platelets', label: 'Platelets (cells/μL)' },
    { value: 'hematocrit', label: 'Hematocrit (%)' }
  ];

  useEffect(() => {
    fetchTrendData();
  }, [selectedParameter, userId]);

  const fetchTrendData = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = { parameter: selectedParameter };
      if (userId) params.userId = userId;

      const response = await axios.get('http://localhost:5000/api/history/trends', { params });
      setTrendData(response.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load trend data');
      console.error('Trend data error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Format data for chart
  const chartData = trendData.map(item => ({
    date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    value: item.value,
    severity: item.severity
  }));

  const getColorForSeverity = (severity) => {
    switch (severity) {
      case 'critical': return '#ef4444';
      case 'abnormal': return '#f59e0b';
      case 'normal': return '#10b981';
      default: return '#2563eb';
    }
  };

  return (
    <div className="history-graph-container">
      <div className="graph-header">
        <h3>Patient History Trends</h3>
        <select
          value={selectedParameter}
          onChange={(e) => setSelectedParameter(e.target.value)}
          className="parameter-select"
        >
          {parameters.map(param => (
            <option key={param.value} value={param.value}>
              {param.label}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {loading ? (
        <div className="loading-message">Loading trend data...</div>
      ) : chartData.length === 0 ? (
        <div className="no-data">
          <p>No historical data available for {parameters.find(p => p.value === selectedParameter)?.label}</p>
          <p className="hint">Upload more reports to see trends over time</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="date"
              stroke="#64748b"
              style={{ fontSize: '12px' }}
            />
            <YAxis
              stroke="#64748b"
              style={{ fontSize: '12px' }}
              label={{ value: parameters.find(p => p.value === selectedParameter)?.label, angle: -90, position: 'insideLeft' }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '10px'
              }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#2563eb"
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
              name={parameters.find(p => p.value === selectedParameter)?.label}
            />
          </LineChart>
        </ResponsiveContainer>
      )}

      {chartData.length > 0 && (
        <div className="graph-stats">
          <div className="stat-item">
            <span className="stat-label">Data Points:</span>
            <span className="stat-value">{chartData.length}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Latest Value:</span>
            <span className="stat-value">{chartData[chartData.length - 1]?.value}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">First Record:</span>
            <span className="stat-value">{chartData[0]?.date}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default HistoryGraph;

