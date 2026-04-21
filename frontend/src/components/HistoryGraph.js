import React, { useState, useEffect, useRef } from 'react';
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
  ResponsiveContainer,
  ComposedChart,
  Area
} from 'recharts';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import html2canvas from 'html2canvas';

const DIFF_KEYS = new Set(['neutrophils', 'lymphocytes', 'monocytes', 'eosinophils', 'basophils']);

function trendToNum(v) {
  const n = v === null || v === undefined || v === '' ? NaN : parseFloat(v);
  return Number.isNaN(n) ? null : n;
}

function normalizeTrendScalar(param, raw, wbcNormalizedForReport) {
  const v = trendToNum(raw);
  if (v == null || v < 0) return raw;

  if (param === 'wbc' && v > 0 && v < 200) return v * 1000;
  if (param === 'platelets' && v > 0 && v < 5000) return v * 1000;

  if (DIFF_KEYS.has(param)) {
    if (v >= 0 && v <= 100) return v;
    const wbc = trendToNum(wbcNormalizedForReport);
    if (wbc != null && wbc > 0) {
      const diffAbs = v > 0 && v < 200 ? v * 1000 : v;
      const pct = (diffAbs / wbc) * 100;
      if (pct >= 0 && pct <= 100) return Math.round(pct * 100) / 100;
    }
    return v;
  }

  return v;
}

function formatTrendDisplayValue(param, raw) {
  const v = trendToNum(raw);
  if (v == null) return '—';
  if (param === 'wbc' || param === 'platelets') return Math.round(v).toLocaleString('en-US');
  if (param === 'hemoglobin' || param === 'mch' || param === 'mchc' || param === 'rbc') return v.toFixed(2);
  if (param === 'mcv' || param === 'hematocrit' || param === 'rdw') return v.toFixed(1);
  if (DIFF_KEYS.has(param)) return v.toFixed(1);
  return String(raw);
}

function HistoryGraph({ userId = null, onNavigate }) {
  const [reports, setReports] = useState([]);
  const [selectedParameters, setSelectedParameters] = useState(['hemoglobin', 'wbc', 'platelets']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [allData, setAllData] = useState({});
  const [viewMode, setViewMode] = useState('table');
  const [chartType, setChartType] = useState('line');
  const [isExporting, setIsExporting] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const chartContainerRef = useRef(null);

  const parameters = [
    { value: 'hemoglobin', label: 'Hemoglobin', unit: 'g/dL', color: '#FF0000', group: 'RBC' },
    { value: 'rbc', label: 'RBC', unit: 'million cells/µL', color: '#FF8C00', group: 'RBC' },
    { value: 'wbc', label: 'WBC', unit: 'cells/µL', color: '#00CED1', group: 'WBC' },
    { value: 'platelets', label: 'Platelets', unit: 'cells/µL', color: '#FFD700', group: 'Platelets' },
    { value: 'hematocrit', label: 'Hematocrit', unit: '%', color: '#9932CC', group: 'RBC' },
    { value: 'mcv', label: 'MCV', unit: 'fL', color: '#FF4500', group: 'Indices' },
    { value: 'mch', label: 'MCH', unit: 'pg', color: '#00BFFF', group: 'Indices' },
    { value: 'mchc', label: 'MCHC', unit: 'g/dL', color: '#FF1493', group: 'Indices' },
    { value: 'neutrophils', label: 'Neutrophils', unit: '%', color: '#32CD32', group: 'Differential' },
    { value: 'lymphocytes', label: 'Lymphocytes', unit: '%', color: '#FFA500', group: 'Differential' },
    { value: 'monocytes', label: 'Monocytes', unit: '%', color: '#8B4513', group: 'Differential' },
    { value: 'eosinophils', label: 'Eosinophils', unit: '%', color: '#20B2AA', group: 'Differential' },
    { value: 'basophils', label: 'Basophils', unit: '%', color: '#9400D3', group: 'Differential' },
    { value: 'rdw', label: 'RDW', unit: '%', color: '#DC143C', group: 'Indices' }
  ];

  const groupColors = {
    'RBC': '#FF0000',
    'WBC': '#00CED1',
    'Platelets': '#FFD700',
    'Indices': '#FF4500',
    'Differential': '#32CD32'
  };

  useEffect(() => {
    fetchReports();
    fetchAllTrendData();
  }, [userId]);

  const fetchReports = async () => {
    setLoading(true);
    try {
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
        const params = { parameter: param.value };
        return api.get('/history/trends', { params })
          .then(res => ({ param: param.value, data: res.data.data }))
          .catch(err => ({ param: param.value, data: [] }));
      });

      const results = await Promise.all(dataPromises);
      const rawMap = {};
      results.forEach((result) => {
        rawMap[result.param] = Array.isArray(result.data) ? result.data.map((row) => ({ ...row })) : [];
      });

      const wbcRows = (rawMap.wbc || []).map((row) => ({
        ...row,
        value: normalizeTrendScalar('wbc', row.value, null)
      }));
      const wbcByReportId = {};
      wbcRows.forEach((row) => {
        if (row.reportId != null) wbcByReportId[row.reportId] = row.value;
      });

      const dataMap = { wbc: wbcRows };
      parameters.forEach((p) => {
        if (p.value === 'wbc') return;
        const rows = rawMap[p.value] || [];
        dataMap[p.value] = rows.map((row) => ({
          ...row,
          value: normalizeTrendScalar(p.value, row.value, wbcByReportId[row.reportId])
        }));
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

  const getMergedChartData = () => {
    if (selectedParameters.length === 0) return [];

    const dateMap = {};
    
    selectedParameters.forEach(paramValue => {
      const paramData = allData[paramValue] || [];
      paramData.forEach(item => {
        const dateKey = new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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
    
    const ranges = {
      hemoglobin: { min: 11.5, max: 17.0 },
      rbc: { min: 4.0, max: 6.1 },
      wbc: { min: 4000, max: 10000 },
      platelets: { min: 150000, max: 400000 },
      hematocrit: { min: 36, max: 55 },
      mcv: { min: 80, max: 100 },
      mch: { min: 27, max: 31 },
      mchc: { min: 32, max: 36 },
      neutrophils: { min: 40, max: 80 },
      lymphocytes: { min: 20, max: 40 },
      monocytes: { min: 2, max: 10 },
      eosinophils: { min: 1, max: 6 },
      basophils: { min: 0, max: 1 },
      rdw: { min: 12, max: 15 }
    };
    
    const range = ranges[param];
    if (!range) return 'text-gray-600';
    
    const numValue = parseFloat(value);
    if (numValue < range.min) return 'text-blue-600';
    if (numValue > range.max) return 'text-red-600';
    return 'text-green-600';
  };

  const chartData = getMergedChartData();

  const exportGraph = async () => {
    if (!chartContainerRef.current) {
      alert('No chart to export');
      return;
    }

    setIsExporting(true);
    
    try {
      const chartCard = chartContainerRef.current.closest('.shadow-2xl');
      const elementToCapture = chartCard || chartContainerRef.current;
      
      const originalOverflow = elementToCapture.style.overflow;
      elementToCapture.style.overflow = 'visible';
      
      const canvas = await html2canvas(elementToCapture, {
        scale: 3,
        backgroundColor: '#ffffff',
        logging: false,
        useCORS: true,
        allowTaint: false,
      });
      
      elementToCapture.style.overflow = originalOverflow;
      
      const link = document.createElement('a');
      link.download = `cbc_trends_${new Date().toISOString().split('T')[0]}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export graph. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  // Share via WhatsApp - Fixed to open WhatsApp directly
  const shareViaWhatsApp = async () => {
    setIsSharing(true);
    setShowShareMenu(false);
    
    try {
      // Generate text summary first
      const summaryText = generateShareableText();
      const encodedText = encodeURIComponent(summaryText);
      
      // Open WhatsApp with just the text (more reliable)
      // Use wa.me for mobile and web.whatsapp.com for desktop
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      
      if (isMobile) {
        // For mobile - opens WhatsApp app directly
        window.location.href = `https://wa.me/?text=${encodedText}`;
      } else {
        // For desktop - opens WhatsApp Web
        window.open(`https://web.whatsapp.com/send?text=${encodedText}`, '_blank');
      }
      
      // Also offer to download screenshot separately
      setTimeout(() => {
        alert('💡 Tip: Take a screenshot of the graph to share along with the text summary!');
      }, 1000);
      
    } catch (error) {
      console.error('WhatsApp share failed:', error);
      alert('Failed to open WhatsApp. Please make sure WhatsApp is installed.');
    } finally {
      setIsSharing(false);
    }
  };

  // Share via Email - Fixed to include attachment
  const shareViaEmail = async () => {
    setIsSharing(true);
    setShowShareMenu(false);
    
    try {
      // Capture the graph as image
      const chartCard = chartContainerRef.current.closest('.shadow-2xl');
      const elementToCapture = chartCard || chartContainerRef.current;
      
      const canvas = await html2canvas(elementToCapture, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false,
        useCORS: true,
      });
      
      const imageDataUrl = canvas.toDataURL('image/png');
      const summaryText = generateShareableText();
      
      // Create email subject and body
      const subject = encodeURIComponent('My CBC Health Trends Report');
      
      // Create a simple text body (works better across email clients)
      const emailBody = encodeURIComponent(
        `Hello,\n\n` +
        `Please find attached my CBC health trends report.\n\n` +
        `${summaryText}\n\n` +
        `---\n` +
        `Generated from Health Monitoring Hub on ${new Date().toLocaleString()}\n` +
        `Disclaimer: This is for informational purposes only. Please consult a healthcare professional for medical advice.`
      );
      
      // Download the image first
      const link = document.createElement('a');
      link.download = `cbc_trends_${new Date().toISOString().split('T')[0]}.png`;
      link.href = imageDataUrl;
      link.click();
      
      // Then open email client
      setTimeout(() => {
        window.location.href = `mailto:?subject=${subject}&body=${emailBody}`;
        
        // Show instruction after email opens
        setTimeout(() => {
          alert('📧 Email client opened!\n\nPlease attach the downloaded image (cbc_trends_*.png) to this email before sending.');
        }, 500);
      }, 500);
      
    } catch (error) {
      console.error('Email share failed:', error);
      alert('Failed to prepare email. Please try again.');
    } finally {
      setIsSharing(false);
    }
  };

  // Generate shareable text summary
  const generateShareableText = () => {
    const date = new Date().toLocaleDateString();
    let text = `📊 CBC HEALTH REPORT - ${date}\n\n`;
    text += `📈 Selected Parameters: ${selectedParameters.map(p => parameters.find(param => param.value === p)?.label).join(', ')}\n`;
    text += `📅 Total Reports: ${chartData.length}\n`;
    
    if (chartData.length > 0) {
      text += `📆 Date Range: ${chartData[0]?.date} to ${chartData[chartData.length - 1]?.date}\n\n`;
    }
    
    text += `📋 PARAMETER SUMMARY:\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    
    selectedParameters.forEach(paramValue => {
      const analysis = getParameterAnalysis(paramValue);
      if (analysis) {
        let arrow = '';
        if (analysis.trend === 'increasing') arrow = '📈';
        else if (analysis.trend === 'decreasing') arrow = '📉';
        else arrow = '➡️';
        
        text += `${arrow} ${analysis.param}\n`;
        text += `   Latest: ${analysis.lastValue} ${analysis.unit}\n`;
        text += `   Status: ${analysis.status.toUpperCase()}\n`;
        text += `   Trend: ${analysis.combinedDescription}\n`;
        text += `   Average: ${analysis.avgValue} ${analysis.unit}\n\n`;
      }
    });
    
    text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `Generated by Health Monitoring Hub\n`;
    text += `*This is an automated report for informational purposes only.*`;
    
    return text;
  };

  const getParameterAnalysis = (paramValue) => {
    const paramData = allData[paramValue] || [];
    if (paramData.length < 2) return null;

    const param = parameters.find(p => p.value === paramValue);
    const firstValue = trendToNum(paramData[0].value);
    const lastValue = trendToNum(paramData[paramData.length - 1].value);
    if (firstValue == null || lastValue == null) return null;

    const avgValue =
      paramData.reduce((sum, item) => sum + (trendToNum(item.value) ?? 0), 0) / paramData.length;

    const ranges = {
      hemoglobin: { min: 11.5, max: 17.0 },
      rbc: { min: 4.0, max: 6.1 },
      wbc: { min: 4000, max: 10000 },
      platelets: { min: 150000, max: 400000 },
      hematocrit: { min: 36, max: 55 },
      mcv: { min: 80, max: 100 },
      mch: { min: 27, max: 31 },
      mchc: { min: 32, max: 36 },
      neutrophils: { min: 40, max: 80 },
      lymphocytes: { min: 20, max: 40 },
      monocytes: { min: 2, max: 10 },
      eosinophils: { min: 1, max: 6 },
      basophils: { min: 0, max: 1 },
      rdw: { min: 12, max: 15 }
    };

    const range = ranges[paramValue];
    const isInRange = range && lastValue >= range.min && lastValue <= range.max;
    const status = !range ? 'normal' : isInRange ? 'normal' : lastValue < range.min ? 'low' : 'high';

    let trend;
    if (paramValue === 'wbc') {
      const delta = lastValue - firstValue;
      trend = Math.abs(delta) < 150 ? 'stable' : delta > 0 ? 'increasing' : 'decreasing';
    } else if (paramValue === 'platelets') {
      const delta = lastValue - firstValue;
      trend = Math.abs(delta) < 8000 ? 'stable' : delta > 0 ? 'increasing' : 'decreasing';
    } else {
      const denom = Math.abs(firstValue) > 1e-9 ? firstValue : 1;
      const pct = ((lastValue - firstValue) / denom) * 100;
      trend = Math.abs(pct) < 1 ? 'stable' : pct > 0 ? 'increasing' : 'decreasing';
    }

    let combinedDescription = '';
    if (status === 'low') {
      combinedDescription = trend === 'decreasing' ? 'Low and decreasing' :
                           trend === 'increasing' ? 'Low but improving' : 'Low and stable';
    } else if (status === 'high') {
      combinedDescription = trend === 'increasing' ? 'High and increasing' :
                           trend === 'decreasing' ? 'High but improving' : 'High and stable';
    } else {
      combinedDescription = trend === 'increasing' ? 'Normal and increasing' :
                           trend === 'decreasing' ? 'Normal but decreasing' : 'Normal and stable';
    }

    const firstFmt = formatTrendDisplayValue(paramValue, firstValue);
    const lastFmt = formatTrendDisplayValue(paramValue, lastValue);

    return {
      param: param?.label || paramValue,
      unit: param?.unit || '',
      color: param?.color || '#FF0000',
      trend,
      avgValue: formatTrendDisplayValue(paramValue, avgValue),
      lastValue: lastFmt,
      firstValue: firstFmt,
      firstToLatest: `First: ${firstFmt} → Latest: ${lastFmt} ${param?.unit || ''}`.trim(),
      status,
      combinedDescription,
      dataPoints: paramData.length
    };
  };

  const handleParameterToggle = (paramValue) => {
    setSelectedParameters(prev => {
      if (prev.includes(paramValue)) {
        if (prev.length > 1) {
          return prev.filter(p => p !== paramValue);
        }
        return prev;
      } else {
        return [...prev, paramValue];
      }
    });
  };

  const handleSelectGroup = (group) => {
    const groupParams = parameters.filter(p => p.group === group).map(p => p.value);
    setSelectedParameters(groupParams);
  };

  const handleSelectAll = () => {
    setSelectedParameters(parameters.map(p => p.value));
  };

  const handleClearAll = () => {
    setSelectedParameters(['hemoglobin']);
  };

  const groupedParameters = parameters.reduce((acc, param) => {
    if (!acc[param.group]) acc[param.group] = [];
    acc[param.group].push(param);
    return acc;
  }, {});

  return (
    <div className="min-h-screen p-4 md:p-8 relative overflow-x-clip" style={{
      background: 'linear-gradient(180deg, #fff5f5 0%, #ffe0e0 10%, #ffcccc 20%, #ffb3b3 35%, #ff9999 50%, #ff8080 65%, #e06666 80%, #cc4d4d 90%, #b33b3b 100%)',
      backgroundAttachment: 'fixed'
    }}>
      <div className="max-w-7xl mx-auto relative z-10">
        {/* Header */}
        <div className="mb-6 md:mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-[#2c1212] mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>
            History & Trends
          </h1>
          <p className="text-[#4e2a2a] font-medium max-w-3xl">
            View your complete health history, track trends over time, and analyze patterns across all 14 CBC parameters.
          </p>
        </div>

        {/* View Mode Toggle */}
        <div className="mb-6 flex flex-wrap gap-3 sm:gap-4 items-stretch">
          <Button
            variant={viewMode === 'table' ? 'default' : 'outline'}
            onClick={() => setViewMode('table')}
            className={viewMode === 'table' 
              ? 'bg-gradient-to-r from-[#8B0000] to-[#B22222] text-white shadow-lg shadow-red-900/50 transition-all duration-300 hover:scale-105' 
              : 'border-[#8B0000] text-[#8B0000] hover:bg-white/80 transition-all duration-300 hover:scale-105'
            }
          >
            <i className="fas fa-table mr-2"></i>
            Data Table
          </Button>
          <Button
            variant={viewMode === 'graph' ? 'default' : 'outline'}
            onClick={() => setViewMode('graph')}
            className={viewMode === 'graph' 
              ? 'bg-gradient-to-r from-[#8B0000] to-[#B22222] text-white shadow-lg shadow-red-900/50 transition-all duration-300 hover:scale-105' 
              : 'border-[#8B0000] text-[#8B0000] hover:bg-white/80 transition-all duration-300 hover:scale-105'
            }
          >
            <i className="fas fa-chart-line mr-2"></i>
            Trends & Graphs
          </Button>
          
          {viewMode === 'graph' && chartData.length > 0 && (
            <div className="relative">
              <Button
                variant="default"
                onClick={() => setShowShareMenu(!showShareMenu)}
                disabled={isSharing}
                className="bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-900/50 transition-all duration-300 hover:scale-105"
              >
                {isSharing ? (
                  <>
                    <i className="fas fa-spinner fa-spin mr-2"></i>
                    Sharing...
                  </>
                ) : (
                  <>
                    <i className="fas fa-share-alt mr-2"></i>
                    Share Report
                  </>
                )}
              </Button>
              
              {/* Share Menu Dropdown */}
              {showShareMenu && !isSharing && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowShareMenu(false)}></div>
                  <div className="absolute top-full mt-2 right-0 bg-white rounded-lg shadow-xl border border-gray-200 z-50 min-w-[220px] overflow-hidden">
                    <div className="py-2">
                      <button
                        onClick={shareViaWhatsApp}
                        className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 transition-colors duration-200"
                      >
                        <i className="fab fa-whatsapp text-green-600 text-xl"></i>
                        <div>
                          <div className="font-semibold text-gray-800">WhatsApp</div>
                          <div className="text-xs text-gray-500">Share via WhatsApp</div>
                        </div>
                      </button>
                      <button
                        onClick={shareViaEmail}
                        className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 transition-colors duration-200 border-t border-gray-100"
                      >
                        <i className="fas fa-envelope text-blue-600 text-xl"></i>
                        <div>
                          <div className="font-semibold text-gray-800">Email</div>
                          <div className="text-xs text-gray-500">Send as email</div>
                        </div>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
          
          {viewMode === 'graph' && chartData.length > 0 && (
            <Button
              variant="default"
              onClick={exportGraph}
              disabled={isExporting}
              className="bg-gradient-to-r from-green-600 to-green-700 text-white shadow-lg shadow-green-900/50 transition-all duration-300 hover:scale-105"
            >
              {isExporting ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-2"></i>
                  Exporting...
                </>
              ) : (
                <>
                  <i className="fas fa-download mr-2"></i>
                  Export Graph
                </>
              )}
            </Button>
          )}
          
          {onNavigate && (
            <Button
              variant="outline"
              onClick={() => onNavigate('upload', { resetUploadState: true })}
              className="border-[#8B0000] text-[#8B0000] hover:bg-white/80 transition-all duration-300 sm:hover:scale-105 w-full sm:w-auto md:ml-auto"
            >
              <i className="fas fa-plus mr-2"></i>
              Add New Report
            </Button>
          )}
        </div>

        {/* Chart Type Selector for Graph View */}
        {viewMode === 'graph' && selectedParameters.length > 0 && (
          <div className="mb-4 flex gap-2">
            <Button
              size="sm"
              variant={chartType === 'line' ? 'default' : 'outline'}
              onClick={() => setChartType('line')}
              className={chartType === 'line' 
                ? 'bg-gradient-to-r from-[#8B0000] to-[#B22222] text-white' 
                : 'border-[#8B0000] text-[#8B0000]'
              }
            >
              <i className="fas fa-chart-line mr-1"></i> Line Chart
            </Button>
            <Button
              size="sm"
              variant={chartType === 'area' ? 'default' : 'outline'}
              onClick={() => setChartType('area')}
              className={chartType === 'area' 
                ? 'bg-gradient-to-r from-[#8B0000] to-[#B22222] text-white' 
                : 'border-[#8B0000] text-[#8B0000]'
              }
            >
              <i className="fas fa-chart-area mr-1"></i> Area Chart
            </Button>
          </div>
        )}

        {error && (
          <Alert className="mb-6 border-red-300 bg-red-100/90 backdrop-blur-sm shadow-lg">
            <i className="fas fa-exclamation-circle text-red-600 mt-1"></i>
            <AlertDescription className="text-red-800">{error}</AlertDescription>
          </Alert>
        )}

        {/* Table View */}
        {viewMode === 'table' && (
          <Card className="shadow-2xl hover:shadow-red-900/20 transition-all duration-500 border-0 bg-white/95 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[#2c1212]">
                <i className="fas fa-table text-[#8B0000]"></i>
                All Reports History
              </CardTitle>
              <CardDescription className="text-[#4e2a2a]">
                Complete list of your CBC reports with all 14 parameters
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-12">
                  <i className="fas fa-spinner fa-spin text-3xl text-[#8B0000] mb-4"></i>
                  <p className="text-[#4e2a2a]">Loading reports...</p>
                </div>
              ) : reports.length === 0 ? (
                <div className="text-center py-12">
                  <i className="fas fa-inbox text-4xl text-gray-400 mb-4"></i>
                  <p className="text-[#4e2a2a] mb-2">No reports found</p>
                  <p className="text-sm text-gray-500 mb-4">Upload your first report to get started</p>
                  {onNavigate && (
                    <Button onClick={() => onNavigate('upload', { resetUploadState: true })} className="bg-gradient-to-r from-[#8B0000] to-[#B22222] text-white">
                      <i className="fas fa-upload mr-2"></i>
                      Upload Report
                    </Button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gradient-to-r from-[#FFE4E1] to-[#fff8f8]">
                        <th className="px-3 py-3 text-left text-sm font-semibold text-[#2c1212]">Date</th>
                        {parameters.map(param => (
                          <th key={param.value} className="px-3 py-3 text-left text-sm font-semibold text-[#2c1212]">{param.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {reports.map((report, index) => {
                        const cbcData = typeof report.cbcData === 'string' 
                          ? JSON.parse(report.cbcData) 
                          : report.cbcData;
                        
                        return (
                          <tr key={report.id} className={`border-b border-gray-100 hover:bg-gradient-to-r hover:from-[#FFE4E1] hover:to-transparent transition-all duration-300 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                            <td className="px-3 py-3 text-sm text-gray-900 font-medium">
                              {formatDate(report.createdAt)}
                            </td>
                            {parameters.map(param => (
                              <td key={param.value} className={`px-3 py-3 text-sm ${getStatusColor(cbcData?.[param.value], param.value)}`}>
                                {cbcData?.[param.value] || '—'}
                              </td>
                            ))}
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
            <Card className="shadow-2xl hover:shadow-red-900/20 transition-all duration-500 border-0 bg-white/95 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-[#2c1212]">
                  <i className="fas fa-sliders-h text-[#8B0000]"></i>
                  Select Parameters to Compare
                </CardTitle>
                <CardDescription className="text-[#4e2a2a]">
                  Select parameters to compare their trends. Use group buttons for quick selection.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={handleSelectAll} className="border-[#8B0000] text-[#8B0000] hover:bg-white/80">
                    <i className="fas fa-check-double mr-1"></i> All
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleClearAll} className="border-[#8B0000] text-[#8B0000] hover:bg-white/80">
                    <i className="fas fa-times mr-1"></i> Clear
                  </Button>
                  {Object.keys(groupedParameters).map(group => (
                    <Button 
                      key={group} 
                      size="sm" 
                      variant="outline" 
                      onClick={() => handleSelectGroup(group)}
                      className="border-[#8B0000] text-[#8B0000] hover:bg-white/80"
                      style={{ borderLeftColor: groupColors[group], borderLeftWidth: '3px' }}
                    >
                      <i className="fas fa-layer-group mr-1"></i> {group}
                    </Button>
                  ))}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
                  {parameters.map(param => (
                    <label
                      key={param.value}
                      className={`flex items-center p-2 rounded-lg border-2 cursor-pointer transition-all duration-300 ${
                        selectedParameters.includes(param.value)
                          ? 'bg-gradient-to-r from-[#FFE4E1] to-[#fff8f8] border-[#8B0000] text-[#8B0000] font-semibold shadow-md'
                          : 'bg-white border-gray-200 text-gray-700 hover:border-[#8B0000] hover:shadow-md'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedParameters.includes(param.value)}
                        onChange={() => handleParameterToggle(param.value)}
                        className="mr-2 text-[#8B0000] focus:ring-[#8B0000] rounded"
                      />
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: param.color }}></div>
                        <span className="text-xs font-medium">{param.label}</span>
                      </div>
                    </label>
                  ))}
                </div>
                
                {selectedParameters.length > 0 && (
                  <div className="mt-3 p-3 bg-blue-50/80 backdrop-blur-sm rounded-lg">
                    <p className="text-sm text-blue-800">
                      <i className="fas fa-chart-line mr-2"></i>
                      Showing <strong>{selectedParameters.length}</strong> parameter{selectedParameters.length > 1 ? 's' : ''}: {' '}
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
              </CardContent>
            </Card>

            {/* Graph */}
            {selectedParameters.length > 0 && (
              <Card className="shadow-2xl hover:shadow-red-900/20 transition-all duration-500 border-0 bg-white/95 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-[#2c1212]">
                    <i className="fas fa-chart-line text-[#8B0000]"></i>
                    Trend Analysis
                  </CardTitle>
                  <CardDescription className="text-[#4e2a2a]">
                    {chartType === 'line' ? 'Line chart showing trends over time' : 'Area chart showing cumulative trends'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div ref={chartContainerRef}>
                    {chartData.length === 0 ? (
                      <div className="text-center py-12">
                        <i className="fas fa-chart-line text-4xl text-gray-400 mb-4"></i>
                        <p className="text-[#4e2a2a] mb-2">No trend data available</p>
                        <p className="text-sm text-gray-500 mb-4">Upload more reports to see trends</p>
                        {onNavigate && (
                          <Button onClick={() => onNavigate('upload', { resetUploadState: true })} className="bg-gradient-to-r from-[#8B0000] to-[#B22222] text-white">
                            <i className="fas fa-upload mr-2"></i>
                            Upload Report
                          </Button>
                        )}
                      </div>
                    ) : (
                      <>
                        <div className="h-[260px] sm:h-[340px] md:h-[450px] mb-6 w-full min-w-0">
                          <ResponsiveContainer width="100%" height="100%">
                            {chartType === 'line' ? (
                              <LineChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                                <XAxis 
                                  dataKey="date" 
                                  stroke="#666"
                                  tick={{ fontSize: 11 }}
                                  interval={Math.floor(chartData.length / 8)}
                                />
                                <YAxis 
                                  stroke="#666"
                                  tick={{ fontSize: 11 }}
                                  width={50}
                                />
                                <Tooltip 
                                  contentStyle={{
                                    backgroundColor: 'white',
                                    border: '1px solid #E5E7EB',
                                    borderRadius: '8px',
                                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                                  }}
                                />
                                <Legend 
                                  wrapperStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                                  verticalAlign="top"
                                  height={36}
                                />
                                {selectedParameters.map(paramValue => {
                                  const param = parameters.find(p => p.value === paramValue);
                                  return (
                                    <Line
                                      key={paramValue}
                                      type="monotone"
                                      dataKey={paramValue}
                                      stroke={param?.color || '#FF0000'}
                                      strokeWidth={3}
                                      dot={{ r: 5, fill: param?.color || '#FF0000', strokeWidth: 2, stroke: '#fff' }}
                                      activeDot={{ r: 7, stroke: param?.color, strokeWidth: 2 }}
                                      name={`${param?.label} (${param?.unit})`}
                                    />
                                  );
                                })}
                              </LineChart>
                            ) : (
                              <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                                <XAxis 
                                  dataKey="date" 
                                  stroke="#666"
                                  tick={{ fontSize: 11 }}
                                  interval={Math.floor(chartData.length / 8)}
                                />
                                <YAxis 
                                  stroke="#666"
                                  tick={{ fontSize: 11 }}
                                  width={50}
                                />
                                <Tooltip 
                                  contentStyle={{
                                    backgroundColor: 'white',
                                    border: '1px solid #E5E7EB',
                                    borderRadius: '8px',
                                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                                  }}
                                />
                                <Legend 
                                  wrapperStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                                  verticalAlign="top"
                                  height={36}
                                />
                                {selectedParameters.map(paramValue => {
                                  const param = parameters.find(p => p.value === paramValue);
                                  return (
                                    <Area
                                      key={paramValue}
                                      type="monotone"
                                      dataKey={paramValue}
                                      stroke={param?.color || '#FF0000'}
                                      fill={param?.color || '#FF0000'}
                                      fillOpacity={0.2}
                                      strokeWidth={3}
                                      name={`${param?.label} (${param?.unit})`}
                                    />
                                  );
                                })}
                              </ComposedChart>
                            )}
                          </ResponsiveContainer>
                        </div>

                        {/* Parameter Summaries with Bold Big Arrows */}
                        <div className="mt-6">
                          <h4 className="text-lg font-semibold text-[#2c1212] flex items-center gap-2 mb-4">
                            <i className="fas fa-list-check text-[#8B0000]"></i>
                            Parameter Summary
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {selectedParameters.map(paramValue => {
                              const analysis = getParameterAnalysis(paramValue);
                              if (!analysis) return null;
                              
                              let trendArrow, arrowBgColor, arrowColor;
                              if (analysis.trend === 'increasing') {
                                trendArrow = '↑';
                                arrowBgColor = '#dcfce7';
                                arrowColor = '#16a34a';
                              } else if (analysis.trend === 'decreasing') {
                                trendArrow = '↓';
                                arrowBgColor = '#fee2e2';
                                arrowColor = '#dc2626';
                              } else {
                                trendArrow = '→';
                                arrowBgColor = '#dbeafe';
                                arrowColor = '#2563eb';
                              }
                              
                              return (
                                <div 
                                  key={paramValue}
                                  className="p-4 bg-white rounded-xl border-2 hover:shadow-lg transition-all duration-300 hover:scale-105 relative"
                                  style={{ borderLeftColor: analysis.color, borderLeftWidth: '4px' }}
                                >
                                  <div 
                                    className="absolute top-3 right-3 w-12 h-12 rounded-full flex items-center justify-center shadow-md"
                                    style={{ backgroundColor: arrowBgColor }}
                                  >
                                    <span 
                                      className="text-4xl font-black leading-none"
                                      style={{ color: arrowColor }}
                                    >
                                      {trendArrow}
                                    </span>
                                  </div>
                                  
                                  <div className="flex items-center gap-2 mb-3">
                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: analysis.color }}></div>
                                    <span className="font-bold text-gray-900 text-base">{analysis.param}</span>
                                  </div>
                                  <div className="space-y-2 text-sm">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                                        analysis.status === 'normal' ? 'bg-green-100 text-green-800' :
                                        analysis.status === 'low' ? 'bg-blue-100 text-blue-800' :
                                        'bg-red-100 text-red-800'
                                      }`}>
                                        {analysis.status.charAt(0).toUpperCase() + analysis.status.slice(1)}
                                      </span>
                                      <span className="text-gray-700 text-xs font-medium">
                                        Latest: <strong className="text-base">{analysis.lastValue}</strong> {analysis.unit}
                                      </span>
                                    </div>
                                    <div className="text-gray-500 text-xs">
                                      Avg: {analysis.avgValue} {analysis.unit}
                                    </div>
                                    <div className="text-gray-400 text-xs border-t pt-2 mt-1">
                                      {analysis.firstToLatest}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Stats */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                          <div className="p-4 bg-gradient-to-r from-[#FFF0EE] to-[#FFE4E1] rounded-xl">
                            <div className="text-sm text-[#4e2a2a] mb-1">Total Data Points</div>
                            <div className="text-2xl font-bold text-[#8B0000]">{chartData.length}</div>
                          </div>
                          <div className="p-4 bg-gradient-to-r from-[#FFF0EE] to-[#FFE4E1] rounded-xl">
                            <div className="text-sm text-[#4e2a2a] mb-1">Selected Parameters</div>
                            <div className="text-lg font-semibold text-[#8B0000]">
                              {selectedParameters.length} parameter{selectedParameters.length > 1 ? 's' : ''}
                            </div>
                          </div>
                          <div className="p-4 bg-gradient-to-r from-[#FFF0EE] to-[#FFE4E1] rounded-xl">
                            <div className="text-sm text-[#4e2a2a] mb-1">Date Range</div>
                            <div className="text-sm font-semibold text-[#8B0000]">
                              {chartData[0]?.date} - {chartData[chartData.length - 1]?.date}
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
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