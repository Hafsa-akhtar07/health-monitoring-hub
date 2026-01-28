import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';

function HistoryGraph({ userId = null, onNavigate }) {
  const [reports, setReports] = useState([]);
  const [selectedParameters, setSelectedParameters] = useState(['hemoglobin']); // Multiple parameters can be selected
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [allData, setAllData] = useState({});
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'graph'

  // Color scheme: Using distinct, accessible colors for medical parameters
  // Red tones for critical parameters (hemoglobin, hematocrit - blood-related)
  // Green/Blue for cell counts (RBC, WBC, platelets)
  // Purple/Pink for indices (MCV, MCH, MCHC)
  const parameters = [
    { value: 'hemoglobin', label: 'Hemoglobin', unit: 'g/dL', color: '#8B0000' }, // Dark red - blood protein
    { value: 'rbc', label: 'RBC', unit: '×10⁶/µL', color: '#10b981' }, // Green - red blood cells
    { value: 'wbc', label: 'WBC', unit: '×10³/µL', color: '#3B82F6' }, // Blue - white blood cells
    { value: 'platelets', label: 'Platelets', unit: '×10³/µL', color: '#8b5cf6' }, // Purple - platelets
    { value: 'hematocrit', label: 'Hematocrit', unit: '%', color: '#ef4444' }, // Red - blood volume
    { value: 'mcv', label: 'MCV', unit: 'fL', color: '#f59e0b' }, // Orange - cell size
    { value: 'mch', label: 'MCH', unit: 'pg', color: '#EC4899' }, // Pink - hemoglobin per cell
    { value: 'mchc', label: 'MCHC', unit: 'g/dL', color: '#14B8A6' } // Teal - concentration
  ];

  useEffect(() => {
    fetchReports();
    fetchAllTrendData();
  }, [userId]);

  const fetchReports = async () => {
    setLoading(true);
    try {
      // No need to send userId - backend uses authenticated user from token
      const response = await api.get('/history');
      setReports(response.data.reports || []);
    } catch (err) {
      console.error('Fetch reports error:', err);
      setError('Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllTrendData = async () => {
    setError(null);
    try {
      const dataPromises = parameters.map(param => {
        // No need to send userId - backend uses authenticated user from token
        const params = { parameter: param.value };
        return api.get('/history/trends', { params })
          .then(res => ({ param: param.value, data: res.data.data }))
          .catch(err => ({ param: param.value, data: [] }));
      });

      const results = await Promise.all(dataPromises);
      const dataMap = {};
      results.forEach(result => {
        dataMap[result.param] = result.data;
      });
      setAllData(dataMap);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load trend data');
      console.error('Trend data error:', err);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  // Merge multiple parameters data for comparison chart
  const getMergedChartData = () => {
    if (selectedParameters.length === 0) return [];

    // Create a map to merge all selected parameters by date
    const dateMap = {};
    
    selectedParameters.forEach(paramValue => {
      const paramData = allData[paramValue] || [];
      paramData.forEach(item => {
        const dateKey = new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        if (!dateMap[dateKey]) {
          dateMap[dateKey] = { date: dateKey, fullDate: item.date };
        }
        dateMap[dateKey][paramValue] = item.value;
      });
    });

    return Object.values(dateMap).sort((a, b) => new Date(a.fullDate) - new Date(b.fullDate));
  };

  const getStatusColor = (value, param) => {
    const paramInfo = parameters.find(p => p.value === param);
    if (!paramInfo || !value) return 'text-gray-600';
    
    // Reference ranges (simplified)
    const ranges = {
      hemoglobin: { min: 13.5, max: 17.5 },
      rbc: { min: 4.5, max: 5.9 },
      wbc: { min: 4.5, max: 11.0 },
      platelets: { min: 150, max: 450 },
      hematocrit: { min: 41, max: 53 },
      mcv: { min: 80, max: 100 },
      mch: { min: 27, max: 33 },
      mchc: { min: 32, max: 36 }
    };
    
    const range = ranges[param];
    if (!range) return 'text-gray-600';
    
    const numValue = parseFloat(value);
    if (numValue < range.min) return 'text-blue-600';
    if (numValue > range.max) return 'text-red-600';
    return 'text-green-600';
  };

  const chartData = getMergedChartData();

  const handleParameterToggle = (paramValue) => {
    setSelectedParameters(prev => {
      if (prev.includes(paramValue)) {
        // Remove if already selected (but keep at least one)
        if (prev.length > 1) {
          return prev.filter(p => p !== paramValue);
        }
        return prev; // Keep at least one selected
      } else {
        // Add to selection
        return [...prev, paramValue];
      }
    });
  };

  const calculateTrend = () => {
    if (selectedParameters.length === 0 || chartData.length < 2) return null;
    
    // Calculate trend for the first selected parameter
    const firstParam = selectedParameters[0];
    const paramData = allData[firstParam] || [];
    if (paramData.length < 2) return null;
    
    const firstValue = paramData[0].value;
    const lastValue = paramData[paramData.length - 1].value;
    const change = ((lastValue - firstValue) / firstValue) * 100;
    const paramLabel = parameters.find(p => p.value === firstParam)?.label || 'Parameter';
    
    let message = '';
    if (Math.abs(change) < 1) {
      message = `Your ${paramLabel} has remained stable over the last ${paramData.length} tests.`;
    } else if (change > 0) {
      message = `Your ${paramLabel} has improved by ${Math.abs(change).toFixed(1)}% over the last ${paramData.length} tests — keep it up!`;
    } else {
      message = `Your ${paramLabel} has decreased by ${Math.abs(change).toFixed(1)}% over the last ${paramData.length} tests. Consider consulting your doctor.`;
    }

    // Add comparison info if multiple parameters are selected
    if (selectedParameters.length > 1) {
      const otherParams = selectedParameters.slice(1).map(p => parameters.find(param => param.value === p)?.label).join(', ');
      message += ` Comparing with ${otherParams} to analyze correlations.`;
    }
    
    return {
      message,
      type: Math.abs(change) < 1 ? 'stable' : change > 0 ? 'improving' : 'declining',
      color: Math.abs(change) < 1 ? 'bg-blue-50 border-blue-200 text-blue-800' : change > 0 ? 'bg-green-50 border-green-200 text-green-800' : 'bg-amber-50 border-amber-200 text-amber-800'
    };
  };

  const trendInfo = calculateTrend();

  // Calculate detailed analysis for each selected parameter
  const getParameterAnalysis = (paramValue) => {
    const paramData = allData[paramValue] || [];
    if (paramData.length < 2) return null;

    const param = parameters.find(p => p.value === paramValue);
    const firstValue = paramData[0].value;
    const lastValue = paramData[paramData.length - 1].value;
    const change = ((lastValue - firstValue) / firstValue) * 100;
    const avgValue = paramData.reduce((sum, item) => sum + item.value, 0) / paramData.length;
    const minValue = Math.min(...paramData.map(item => item.value));
    const maxValue = Math.max(...paramData.map(item => item.value));
    
    // Reference ranges
    const ranges = {
      hemoglobin: { min: 13.5, max: 17.5, normal: 'Normal range: 13.5-17.5 g/dL' },
      rbc: { min: 4.5, max: 5.9, normal: 'Normal range: 4.5-5.9 ×10⁶/µL' },
      wbc: { min: 4.5, max: 11.0, normal: 'Normal range: 4.5-11.0 ×10³/µL' },
      platelets: { min: 150, max: 450, normal: 'Normal range: 150-450 ×10³/µL' },
      hematocrit: { min: 41, max: 53, normal: 'Normal range: 41-53%' },
      mcv: { min: 80, max: 100, normal: 'Normal range: 80-100 fL' },
      mch: { min: 27, max: 33, normal: 'Normal range: 27-33 pg' },
      mchc: { min: 32, max: 36, normal: 'Normal range: 32-36 g/dL' }
    };

    const range = ranges[paramValue];
    const isInRange = lastValue >= range.min && lastValue <= range.max;
    const status = isInRange ? 'normal' : lastValue < range.min ? 'low' : 'high';
    
    // Determine trend - only consider it "stable" if change is very small (< 1%)
    const trend = Math.abs(change) < 1 ? 'stable' : change > 0 ? 'increasing' : 'decreasing';
    
    // Combine status and trend for better description
    let combinedDescription = '';
    if (status === 'low') {
      combinedDescription = trend === 'decreasing' ? 'Low and decreasing' : 
                           trend === 'increasing' ? 'Low but improving' : 
                           'Low and stable';
    } else if (status === 'high') {
      combinedDescription = trend === 'increasing' ? 'High and increasing' : 
                           trend === 'decreasing' ? 'High but improving' : 
                           'High and stable';
    } else {
      combinedDescription = trend === 'increasing' ? 'Normal and increasing' : 
                           trend === 'decreasing' ? 'Normal but decreasing' : 
                           'Normal and stable';
    }

    return {
      param: param?.label || paramValue,
      unit: param?.unit || '',
      color: param?.color || '#8B0000',
      trend,
      change: change.toFixed(1),
      avgValue: avgValue.toFixed(2),
      minValue: minValue.toFixed(2),
      maxValue: maxValue.toFixed(2),
      lastValue: lastValue.toFixed(2),
      status,
      combinedDescription,
      range: range.normal,
      dataPoints: paramData.length
    };
  };

  // Get comparison insights
  const getComparisonInsights = () => {
    if (selectedParameters.length < 2) return null;

    const insights = [];
    const paramAnalyses = selectedParameters.map(p => getParameterAnalysis(p)).filter(Boolean);

    // Check for correlations
    if (selectedParameters.includes('hemoglobin') && selectedParameters.includes('hematocrit')) {
      insights.push({
        type: 'correlation',
        title: 'Hemoglobin & Hematocrit Correlation',
        description: 'These parameters are closely related. Hemoglobin is the protein in red blood cells, and hematocrit is the percentage of red blood cells in blood. They typically move together - if one increases, the other usually does too.',
        icon: 'fa-link'
      });
    }

    if (selectedParameters.includes('hemoglobin') && selectedParameters.includes('rbc')) {
      insights.push({
        type: 'correlation',
        title: 'Hemoglobin & RBC Relationship',
        description: 'Red blood cells carry hemoglobin. When RBC count is normal but hemoglobin is low, it may indicate smaller or paler red blood cells (microcytic/hypochromic anemia).',
        icon: 'fa-microscope'
      });
    }

    if (selectedParameters.includes('mcv') && selectedParameters.includes('mch')) {
      insights.push({
        type: 'correlation',
        title: 'MCV & MCH Analysis',
        description: 'MCV (Mean Cell Volume) and MCH (Mean Cell Hemoglobin) help classify anemia types. Low values suggest iron deficiency, while high values may indicate B12/folate deficiency.',
        icon: 'fa-chart-area'
      });
    }

    if (selectedParameters.includes('wbc') && selectedParameters.includes('platelets')) {
      insights.push({
        type: 'correlation',
        title: 'WBC & Platelets Monitoring',
        description: 'Both are important for immune function and clotting. Changes in both together may indicate infection, inflammation, or bone marrow issues.',
        icon: 'fa-shield-alt'
      });
    }

    // Check for opposite trends
    const trends = paramAnalyses.map(a => a.trend);
    if (trends.includes('increasing') && trends.includes('decreasing')) {
      insights.push({
        type: 'warning',
        title: 'Opposite Trends Detected',
        description: 'Some parameters are increasing while others are decreasing. This may indicate a complex health condition requiring medical attention.',
        icon: 'fa-exclamation-triangle'
      });
    }

    // Check if all are stable
    if (trends.every(t => t === 'stable')) {
      insights.push({
        type: 'positive',
        title: 'Stable Parameters',
        description: 'All selected parameters are showing stable trends, which is generally a positive sign of consistent health.',
        icon: 'fa-check-circle'
      });
    }

    return insights;
  };

    return (
    <div className="min-h-screen bg-gradient-to-br from-white via-[#fff8f8] to-[#FFE4E1] p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 md:mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-[#8B0000] mb-2">
            History & Trends
          </h1>
          <p className="text-gray-600 max-w-3xl">
            View your complete health history, track trends over time, and analyze patterns in your CBC reports.
          </p>
        </div>

        {/* View Mode Toggle */}
        <div className="mb-6 flex gap-4">
          <Button
            variant={viewMode === 'table' ? 'default' : 'outline'}
            onClick={() => setViewMode('table')}
            className={viewMode === 'table' ? 'bg-[#8B0000] hover:bg-[#B22222] text-white' : ''}
          >
            <i className="fas fa-table mr-2"></i>
            Data Table
          </Button>
          <Button
            variant={viewMode === 'graph' ? 'default' : 'outline'}
            onClick={() => setViewMode('graph')}
            className={viewMode === 'graph' ? 'bg-[#8B0000] hover:bg-[#B22222] text-white' : ''}
          >
            <i className="fas fa-chart-line mr-2"></i>
            Trends & Graphs
          </Button>
          {onNavigate && (
            <Button
              variant="outline"
              onClick={() => onNavigate('upload')}
              className="ml-auto"
            >
              <i className="fas fa-plus mr-2"></i>
              Add New Report
            </Button>
          )}
        </div>

        {error && (
          <Alert className="mb-6 border-red-200 bg-red-50">
            <i className="fas fa-exclamation-circle text-red-600 mt-1"></i>
            <AlertDescription className="text-red-800">{error}</AlertDescription>
          </Alert>
        )}

        {/* Table View */}
        {viewMode === 'table' && (
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <i className="fas fa-table text-[#8B0000]"></i>
                All Reports History
              </CardTitle>
              <CardDescription>
                Complete list of your CBC reports with all parameters
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-12">
                  <i className="fas fa-spinner fa-spin text-3xl text-[#8B0000] mb-4"></i>
                  <p className="text-gray-600">Loading reports...</p>
                </div>
              ) : reports.length === 0 ? (
                <div className="text-center py-12">
                  <i className="fas fa-inbox text-4xl text-gray-400 mb-4"></i>
                  <p className="text-gray-600 mb-2">No reports found</p>
                  <p className="text-sm text-gray-500 mb-4">Upload your first report to get started</p>
                  {onNavigate && (
                    <Button onClick={() => onNavigate('upload')} className="bg-[#8B0000] hover:bg-[#B22222] text-white">
                      <i className="fas fa-upload mr-2"></i>
                      Upload Report
                    </Button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Date</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Hemoglobin</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">RBC</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">WBC</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Platelets</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Hematocrit</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">MCV</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">MCH</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">MCHC</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reports.map((report, index) => {
                        const cbcData = typeof report.cbcData === 'string' 
                          ? JSON.parse(report.cbcData) 
                          : report.cbcData;
                        const severity = report.analysis?.severity || 'normal';

  return (
                          <tr 
                            key={report.id} 
                            className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                              index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                            }`}
                          >
                            <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                              {formatDate(report.createdAt)}
                            </td>
                            <td className={`px-4 py-3 text-sm ${getStatusColor(cbcData?.hemoglobin, 'hemoglobin')}`}>
                              {cbcData?.hemoglobin || '—'}
                            </td>
                            <td className={`px-4 py-3 text-sm ${getStatusColor(cbcData?.rbc, 'rbc')}`}>
                              {cbcData?.rbc || '—'}
                            </td>
                            <td className={`px-4 py-3 text-sm ${getStatusColor(cbcData?.wbc, 'wbc')}`}>
                              {cbcData?.wbc || '—'}
                            </td>
                            <td className={`px-4 py-3 text-sm ${getStatusColor(cbcData?.platelets, 'platelets')}`}>
                              {cbcData?.platelets || '—'}
                            </td>
                            <td className={`px-4 py-3 text-sm ${getStatusColor(cbcData?.hematocrit, 'hematocrit')}`}>
                              {cbcData?.hematocrit || '—'}
                            </td>
                            <td className={`px-4 py-3 text-sm ${getStatusColor(cbcData?.mcv, 'mcv')}`}>
                              {cbcData?.mcv || '—'}
                            </td>
                            <td className={`px-4 py-3 text-sm ${getStatusColor(cbcData?.mch, 'mch')}`}>
                              {cbcData?.mch || '—'}
                            </td>
                            <td className={`px-4 py-3 text-sm ${getStatusColor(cbcData?.mchc, 'mchc')}`}>
                              {cbcData?.mchc || '—'}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                severity === 'critical' ? 'bg-red-100 text-red-800' :
                                severity === 'abnormal' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-green-100 text-green-800'
                              }`}>
                                {severity || 'Normal'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Graph View */}
        {viewMode === 'graph' && (
          <div className="space-y-6">
            {/* Parameter Selection */}
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <i className="fas fa-sliders-h text-[#8B0000]"></i>
                  Select Parameters to Compare
                </CardTitle>
                <CardDescription>
                  Select multiple parameters to compare their trends and identify correlations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {parameters.map(param => (
                      <label
                        key={param.value}
                        className={`flex items-center p-3 rounded-lg border-2 cursor-pointer transition-all ${
                          selectedParameters.includes(param.value)
                            ? 'bg-[#FFE4E1] border-[#8B0000] text-[#8B0000] font-semibold'
                            : 'bg-white border-gray-300 text-gray-700 hover:border-[#8B0000] hover:text-[#8B0000]'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedParameters.includes(param.value)}
                          onChange={() => handleParameterToggle(param.value)}
                          className="mr-2 text-[#8B0000] focus:ring-[#8B0000] rounded"
                        />
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: param.color }}
                          ></div>
                          <span>{param.label}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                  {selectedParameters.length > 0 && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-800">
                        <i className="fas fa-info-circle mr-2"></i>
                        Comparing <strong>{selectedParameters.length}</strong> parameter{selectedParameters.length > 1 ? 's' : ''}: {' '}
                        {selectedParameters.map((param, idx) => (
                          <span key={param}>
                            <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ backgroundColor: parameters.find(p => p.value === param)?.color }}></span>
                            {parameters.find(p => p.value === param)?.label}
                            {idx < selectedParameters.length - 1 ? ', ' : ''}
                          </span>
                        ))}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Graph */}
            {selectedParameters.length > 0 && (
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <i className="fas fa-chart-line text-[#8B0000]"></i>
                    Trend Analysis: {selectedParameters.map(p => parameters.find(param => param.value === p)?.label).join(' vs ')}
                  </CardTitle>
                  <CardDescription>
                    Comparing {selectedParameters.length} parameter{selectedParameters.length > 1 ? 's' : ''} to analyze trends and correlations
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {chartData.length === 0 ? (
                    <div className="text-center py-12">
                      <i className="fas fa-chart-line text-4xl text-gray-400 mb-4"></i>
                      <p className="text-gray-600 mb-2">No trend data available</p>
                      <p className="text-sm text-gray-500 mb-4">Upload more reports to see trends</p>
                      {onNavigate && (
                        <Button onClick={() => onNavigate('upload')} className="bg-[#8B0000] hover:bg-[#B22222] text-white">
                          <i className="fas fa-upload mr-2"></i>
                          Upload Report
                        </Button>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="h-[400px] mb-6">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                            <XAxis 
                              dataKey="date" 
                              stroke="#666"
                              style={{ fontSize: '12px' }}
                            />
                            <YAxis 
                              stroke="#666"
                              style={{ fontSize: '12px' }}
                              label={{ 
                                value: 'Values', 
                                angle: -90, 
                                position: 'insideLeft' 
                              }}
                            />
                            <Tooltip 
                              contentStyle={{
                                backgroundColor: '#fff',
                                border: '1px solid #E5E7EB',
                                borderRadius: '8px',
                                padding: '10px'
                              }}
                            />
                            <Legend />
                            {selectedParameters.map(paramValue => {
                              const param = parameters.find(p => p.value === paramValue);
                              return (
                                <Line
                                  key={paramValue}
                                  type="monotone"
                                  dataKey={paramValue}
                                  stroke={param?.color || '#8B0000'}
                                  strokeWidth={2}
                                  dot={{ r: 4, fill: param?.color || '#8B0000' }}
                                  activeDot={{ r: 6 }}
                                  name={`${param?.label} (${param?.unit})`}
                                />
                              );
                            })}
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
          
          {/* Trend Interpretation */}
          {trendInfo && (
                        <Alert className={`${trendInfo.color} border`}>
                          <i className={`fas fa-${trendInfo.type === 'improving' ? 'arrow-up' : trendInfo.type === 'declining' ? 'arrow-down' : 'minus'} mt-1`}></i>
                          <AlertDescription>
                            <strong>Overall Trend:</strong> {trendInfo.message}
                          </AlertDescription>
                        </Alert>
                      )}

                      {/* Simple Comparison Summary */}
                      {selectedParameters.length > 0 && (
                        <div className="mt-6">
                          <h4 className="text-lg font-semibold text-gray-800 flex items-center gap-2 mb-4">
                            <i className="fas fa-list-check text-[#8B0000]"></i>
                            Comparison Summary
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {selectedParameters.map(paramValue => {
                              const analysis = getParameterAnalysis(paramValue);
                              if (!analysis) return null;
                              
                              const param = parameters.find(p => p.value === paramValue);
                              
                              // Determine icon and color based on combined status
                              let trendIcon, trendColor;
                              if (analysis.status === 'low') {
                                trendIcon = analysis.trend === 'decreasing' ? 'arrow-down' : 
                                           analysis.trend === 'increasing' ? 'arrow-up' : 'minus';
                                trendColor = analysis.trend === 'decreasing' ? 'text-red-600' : 
                                            analysis.trend === 'increasing' ? 'text-green-600' : 'text-blue-600';
                              } else if (analysis.status === 'high') {
                                trendIcon = analysis.trend === 'increasing' ? 'arrow-up' : 
                                           analysis.trend === 'decreasing' ? 'arrow-down' : 'minus';
                                trendColor = analysis.trend === 'increasing' ? 'text-red-600' : 
                                            analysis.trend === 'decreasing' ? 'text-green-600' : 'text-yellow-600';
                              } else {
                                trendIcon = analysis.trend === 'increasing' ? 'arrow-up' : 
                                           analysis.trend === 'decreasing' ? 'arrow-down' : 'minus';
                                trendColor = analysis.trend === 'increasing' ? 'text-green-600' : 
                                            analysis.trend === 'decreasing' ? 'text-yellow-600' : 'text-blue-600';
                              }
                              
                              return (
                                <div 
                                  key={paramValue}
                                  className="p-4 bg-white border-2 rounded-lg"
                                  style={{ borderLeftColor: analysis.color, borderLeftWidth: '4px' }}
                                >
                                  <div className="flex items-center gap-2 mb-2">
                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: analysis.color }}></div>
                                    <span className="font-semibold text-gray-900">{analysis.param}</span>
                                  </div>
                                  <div className="space-y-1 text-sm">
                                    <div className="flex items-center gap-2">
                                      <i className={`fas fa-${trendIcon} ${trendColor}`}></i>
                                      <span className="text-gray-700">
                                        <strong className={trendColor}>{analysis.combinedDescription}</strong>
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                        analysis.status === 'normal' ? 'bg-green-100 text-green-800' :
                                        analysis.status === 'low' ? 'bg-blue-100 text-blue-800' :
                                        'bg-red-100 text-red-800'
                                      }`}>
                                        {analysis.status.charAt(0).toUpperCase() + analysis.status.slice(1)}
                                      </span>
                                      <span className="text-gray-600 text-xs">
                                        ({analysis.lastValue} {analysis.unit})
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Comparison Insights */}
                      {getComparisonInsights() && getComparisonInsights().length > 0 && (
                        <div className="mt-6 space-y-3">
                          <h4 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                            <i className="fas fa-lightbulb text-[#8B0000]"></i>
                            What This Comparison Tells You
                          </h4>
                          {getComparisonInsights().map((insight, idx) => (
                            <Alert 
                              key={idx}
                              className={`border ${
                                insight.type === 'correlation' ? 'bg-blue-50 border-blue-200 text-blue-800' :
                                insight.type === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-800' :
                                'bg-green-50 border-green-200 text-green-800'
                              }`}
                            >
                              <i className={`fas ${insight.icon} mt-1`}></i>
                              <AlertDescription>
                                <strong>{insight.title}:</strong> {insight.description}
                              </AlertDescription>
                            </Alert>
                          ))}
                        </div>
                      )}

                      {/* Stats */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                        <div className="p-4 bg-gray-50 rounded-lg">
                          <div className="text-sm text-gray-600 mb-1">Data Points</div>
                          <div className="text-2xl font-bold text-[#8B0000]">{chartData.length}</div>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-lg">
                          <div className="text-sm text-gray-600 mb-1">Selected Parameters</div>
                          <div className="text-lg font-semibold text-gray-800">
                            {selectedParameters.length} parameter{selectedParameters.length > 1 ? 's' : ''}
                          </div>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-lg">
                          <div className="text-sm text-gray-600 mb-1">First Record</div>
                          <div className="text-lg font-semibold text-gray-800">{chartData[0]?.date}</div>
          </div>
          </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}
        </div>
    </div>
  );
}

export default HistoryGraph;
