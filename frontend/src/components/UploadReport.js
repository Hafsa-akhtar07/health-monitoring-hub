import React, { useState, useEffect, useRef } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import api from '../utils/api';

const defaultManualData = {
  hemoglobin: '',
  wbc: '',
  platelets: '',
  rbc: '',
  hematocrit: '',
  mcv: '',
  mch: '',
  mchc: '',
  neutrophils: '',
  lymphocytes: '',
  monocytes: '',
  eosinophils: '',
  basophils: ''
};

// Cleveland Clinic reference ranges (adults).
// WBC differentials are treated as percentages to match the ML model + most reports.
const cbcReferenceRanges = {
  hemoglobin: { min: 11.5, max: 17.0, unit: 'g/dL', mandatory: true, inhumanMin: 3, inhumanMax: 25 },
  wbc: { min: 4000, max: 10000, unit: 'cells/µL', mandatory: true, inhumanMin: 500, inhumanMax: 100000 },
  platelets: { min: 150000, max: 400000, unit: 'cells/µL', mandatory: true, inhumanMin: 10000, inhumanMax: 2000000 },
  rbc: { min: 4.0, max: 6.1, unit: 'million cells/µL', mandatory: true, inhumanMin: 1, inhumanMax: 10 },
  hematocrit: { min: 36, max: 55, unit: '%', mandatory: false, inhumanMin: 10, inhumanMax: 70 },
  mcv: { min: 80, max: 100, unit: 'fL', mandatory: false, inhumanMin: 50, inhumanMax: 150 },
  mch: { min: 27, max: 31, unit: 'pg', mandatory: false, inhumanMin: 15, inhumanMax: 50 },
  mchc: { min: 32, max: 36, unit: 'g/dL', mandatory: false, inhumanMin: 20, inhumanMax: 45 },
  rdw: { min: 12, max: 15, unit: '%', mandatory: false, inhumanMin: 8, inhumanMax: 25 },
  // WBC differential counts (%)
  neutrophils: { min: 40, max: 80, unit: '%', mandatory: false, inhumanMin: 0, inhumanMax: 100 },
  lymphocytes: { min: 20, max: 40, unit: '%', mandatory: false, inhumanMin: 0, inhumanMax: 100 },
  monocytes: { min: 2, max: 10, unit: '%', mandatory: false, inhumanMin: 0, inhumanMax: 100 },
  eosinophils: { min: 1, max: 6, unit: '%', mandatory: false, inhumanMin: 0, inhumanMax: 100 },
  basophils: { min: 0, max: 1, unit: '%', mandatory: false, inhumanMin: 0, inhumanMax: 100 }
};

const aiFeatures = [
  {
    icon: 'fa-robot',
    title: 'ML Diagnosis',
    shortDesc: 'Detects conditions like anemia, infection risks, and more using advanced machine learning',
    longDesc: 'Our ML models analyze your CBC parameters against thousands of clinical cases to identify potential conditions like anemia, infections, inflammatory disorders, and blood abnormalities. The system provides probability scores and explains the reasoning behind each detection.'
  },
  {
    icon: 'fa-chart-line',
    title: 'Trend Analysis',
    shortDesc: 'Tracks your health parameters over time with interactive visualizations',
    longDesc: 'Upload multiple reports to see how your CBC parameters change over weeks or months. Interactive graphs show trends, highlight concerning patterns, and predict future values. Perfect for monitoring chronic conditions or treatment effectiveness.'
  },
  {
    icon: 'fa-apple-alt',
    title: 'Personalized Tips',
    shortDesc: 'Diet and lifestyle recommendations based on your specific results',
    longDesc: 'Receive customized diet plans, exercise recommendations, and lifestyle modifications tailored to your CBC results. For example, if iron is low, get iron-rich food suggestions; if WBC is high, learn about immune-boosting strategies.'
  },
  {
    icon: 'fa-chart-simple',
    title: 'Severity Scoring',
    shortDesc: 'Priority-based health alerts and severity classifications',
    longDesc: 'Each abnormality is classified as Mild, Moderate, or Severe based on how far values deviate from normal ranges. Get immediate alerts for critical values and understand which issues need urgent attention vs routine follow-up.'
  }
];

const UploadReport = ({ onUploadSuccess, onBack, initialMode, initialState, onStateChange }) => {
  const [uploadMethod, setUploadMethod] = useState(initialMode || 'file');
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [extractedData, setExtractedData] = useState(null);
  const [error, setError] = useState(null);
  const [manualData, setManualData] = useState(defaultManualData);
  const [manualGender, setManualGender] = useState(initialState?.manualGender || null); // 'male' | 'female' | null
  const [expandedFeature, setExpandedFeature] = useState(null);
  
  const topRef = useRef(null);

  const getRangeForManualField = (field) => {
    const base = cbcReferenceRanges[field];
    if (!base) return null;
    if (field === 'hemoglobin') {
      if (manualGender === 'male') return { ...base, min: 13.0, max: 17.0 };
      if (manualGender === 'female') return { ...base, min: 11.5, max: 15.5 };
      return base;
    }
    if (field === 'rbc') {
      if (manualGender === 'male') return { ...base, min: 4.5, max: 6.1 };
      if (manualGender === 'female') return { ...base, min: 4.0, max: 5.4 };
      return base;
    }
    if (field === 'hematocrit') {
      if (manualGender === 'male') return { ...base, min: 40, max: 55 };
      if (manualGender === 'female') return { ...base, min: 36, max: 48 };
      return base;
    }
    return base;
  };

  // Scroll to top when component mounts
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Clear all form data function
  const clearAllData = () => {
    setSelectedFile(null);
    setExtractedData(null);
    setError(null);
    setManualData(defaultManualData);
    setOcrProgress(0);
    setIsProcessing(false);
    setExpandedFeature(null);
    
    if (onStateChange) {
      onStateChange({
        uploadMethod: 'file',
        extractedData: null,
        manualData: defaultManualData
      });
    }
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Handle page refresh detection
  useEffect(() => {
    const handleBeforeUnload = () => {
      sessionStorage.removeItem('uploadState');
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    // Check if page was refreshed
    if (performance.navigation && performance.navigation.type === 1) {
      clearAllData();
    }
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  useEffect(() => {
    if (initialState) {
      if (initialState.uploadMethod) setUploadMethod(initialState.uploadMethod);
      if (initialState.extractedData) setExtractedData(initialState.extractedData);
      if (initialState.manualData) setManualData(initialState.manualData);
      if (initialState.manualGender !== undefined) setManualGender(initialState.manualGender);
    }
  }, [initialState]);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      setSelectedFile(file);
      setError(null);
      handleFileUpload(file);
    } else {
      setError('Please upload an image file (JPG or PNG only)');
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      setSelectedFile(file);
      setError(null);
      handleFileUpload(file);
    } else {
      setError('Please upload an image file (JPG or PNG only)');
    }
  };

  const handleFileUpload = async (file) => {
    setIsProcessing(true);
    setOcrProgress(0);
    setError(null);
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    try {
      const formData = new FormData();
      formData.append('file', file);

      const progressInterval = setInterval(() => {
        setOcrProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      const response = await api.post('/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      clearInterval(progressInterval);
      setOcrProgress(100);

      if (response.data && response.data.extractedData) {
        const ocrData = response.data.extractedData;

        const extractGenderFromOcr = (data) => {
          const candidates = [];
          if (data && typeof data === 'object') {
            if (data.patient_info && typeof data.patient_info === 'object') {
              candidates.push(
                data.patient_info.sex,
                data.patient_info.gender,
                data.patient_info['Age / Sex'],
                data.patient_info.age_sex
              );
            }
            candidates.push(data.sex, data.gender);
            if (typeof data.all_text === 'string') candidates.push(data.all_text);
          }

          const joined = candidates
            .filter((v) => v !== undefined && v !== null)
            .map((v) => String(v))
            .join(' | ')
            .toLowerCase();

          if (/\b(female|woman|girl)\b/.test(joined) || /\/f\b/.test(joined) || /\bf\b/.test(joined)) return 'female';
          if (/\b(male|man|boy)\b/.test(joined) || /\/m\b/.test(joined) || /\bm\b/.test(joined)) return 'male';
          return null;
        };

        const normalizeDifferentialsToPercent = (valuesObj) => {
          const out = { ...valuesObj };
          const diffKeys = ['neutrophils', 'lymphocytes', 'monocytes', 'eosinophils', 'basophils'];
          const wbcRaw = out.wbc;
          const wbc = wbcRaw == null || wbcRaw === '' ? null : parseFloat(wbcRaw);
          const wbcAbs = wbc != null && !Number.isNaN(wbc) ? (wbc > 0 && wbc < 200 ? wbc * 1000 : wbc) : null;

          diffKeys.forEach((k) => {
            const raw = out[k];
            const v = raw == null || raw === '' ? null : parseFloat(raw);
            if (v == null || Number.isNaN(v)) return;

            // already percent
            if (v >= 0 && v <= 100) {
              out[k] = v;
              return;
            }

            // convert abs -> % if wbc present
            if (wbcAbs != null && wbcAbs > 0) {
              const diffAbs = v > 0 && v < 200 ? v * 1000 : v;
              const pct = (diffAbs / wbcAbs) * 100;
              if (pct >= 0 && pct <= 100) out[k] = Math.round(pct * 100) / 100;
            }
          });
          return out;
        };
        
        const cbcValues = {};
        const cbcParams = [
          'hemoglobin', 'wbc', 'platelets', 'rbc', 'hematocrit',
          'mcv', 'mch', 'mchc', 'rdw', 'neutrophils',
          'lymphocytes', 'monocytes', 'eosinophils', 'basophils'
        ];
        
        cbcParams.forEach(param => {
          if (ocrData[param] !== undefined && ocrData[param] !== null && !isNaN(ocrData[param])) {
            cbcValues[param] = ocrData[param];
          }
        });

        const gender = extractGenderFromOcr(ocrData);
        const normalizedValues = normalizeDifferentialsToPercent(cbcValues);
        
        const newExtracted = {
          fileName: file.name,
          date: new Date().toLocaleDateString(),
          gender,
          values: normalizedValues,
          allText: ocrData.all_text || '',
          totalDetections: ocrData.total_detections || 0,
          ocrResult: ocrData.ocr_result || ocrData.raw_ocr || [],
          warnings: response.data.warnings || []
        };
        
        setExtractedData(newExtracted);
        if (onStateChange) {
          onStateChange({
            uploadMethod,
            extractedData: newExtracted,
            manualData,
            manualGender
          });
        }
      } else {
        throw new Error('No data extracted from file');
      }
    } catch (err) {
      console.error('Upload error:', err);
      
      let errorMessage = 'OCR extraction failed. Please try manual entry.';
      
      if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.message.includes('Network Error')) {
        errorMessage = 'Network error. Please check your connection.';
      } else if (err.message.includes('timeout')) {
        errorMessage = 'OCR service timed out. Please try again.';
      }
      
      setError(errorMessage);
      setOcrProgress(0);
      
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('hmh:adminRefresh'));
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleManualInputChange = (field, value) => {
    setManualData(prev => {
      const updated = {
        ...prev,
        [field]: value
      };
      if (onStateChange) {
        onStateChange({
          uploadMethod,
          extractedData,
          manualData: updated,
          manualGender
        });
      }
      return updated;
    });
  };

  const checkValueStatus = (value, field) => {
    const range = getRangeForManualField(field);
    if (!range || !value) return 'unknown';
    const numValue = parseFloat(value);
    if (numValue < range.min) return 'low';
    if (numValue > range.max) return 'high';
    return 'normal';
  };

  const getStatusColor = (value, field) => {
    const status = checkValueStatus(value, field);
    switch (status) {
      case 'low': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'high': return 'text-red-600 bg-red-50 border-red-200';
      case 'normal': return 'text-green-600 bg-green-50 border-green-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusIcon = (value, field) => {
    const status = checkValueStatus(value, field);
    switch (status) {
      case 'low': return 'fas fa-arrow-down';
      case 'high': return 'fas fa-arrow-up';
      case 'normal': return 'fas fa-check';
      default: return 'fas fa-question';
    }
  };

  const validateInhumanValue = (value, field) => {
    const range = getRangeForManualField(field);
    if (!range || !value) return null;
    const numValue = parseFloat(value);
    if (numValue < range.inhumanMin) {
      return `Value too low (${value}). Minimum: ${range.inhumanMin} ${range.unit}`;
    }
    if (numValue > range.inhumanMax) {
      return `Value too high (${value}). Maximum: ${range.inhumanMax} ${range.unit}`;
    }
    return null;
  };

  const isManualFormValid = () => {
    const mandatoryFields = Object.entries(cbcReferenceRanges)
      .filter(([_, range]) => range.mandatory)
      .map(([field]) => field);
    
    for (const field of mandatoryFields) {
      const raw = (manualData[field] ?? '').toString().trim();
      if (raw === '') return false;
      const num = parseFloat(raw);
      if (Number.isNaN(num)) return false;
      if (validateInhumanValue(raw, field)) return false;
    }
    return true;
  };

  const handleManualSubmit = async () => {
    setError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    const mandatoryFields = Object.entries(cbcReferenceRanges)
      .filter(([_, range]) => range.mandatory)
      .map(([field]) => field);
    
    const missingFields = mandatoryFields.filter(field => !manualData[field] || manualData[field] === '');
    
    if (missingFields.length > 0) {
      setError(`Please fill in all mandatory fields: ${missingFields.map(f => f.charAt(0).toUpperCase() + f.slice(1)).join(', ')}`);
      return;
    }

    const inhumanErrors = [];
    Object.entries(manualData).forEach(([field, value]) => {
      if (value && value !== '') {
        const inhumanError = validateInhumanValue(value, field);
        if (inhumanError) {
          inhumanErrors.push(inhumanError);
        }
      }
    });

    if (inhumanErrors.length > 0) {
      setError(inhumanErrors.join(' '));
      return;
    }

    try {
      const response = await api.post('/reports', {
        cbcData: manualData,
        gender: manualGender
      });

      if (onUploadSuccess) {
        onUploadSuccess({
          reportId: response.data.reportId || Date.now().toString(),
          extractedData: manualData,
          filename: 'manual_entry',
          gender: manualGender
        });
      }
    } catch (err) {
      setError('Failed to save manual entry. Please try again.');
      console.error('Manual entry error:', err);
    }
  };

  const handleFileSubmit = () => {
    if (extractedData && onUploadSuccess) {
      onUploadSuccess({
        reportId: Date.now().toString(),
        extractedData: extractedData.values,
        filename: extractedData.fileName,
        gender: extractedData.gender || null
      });
    }
  };

  const handleReset = () => {
    if (window.confirm('Are you sure you want to clear all entered data?')) {
      clearAllData();
      setUploadMethod('file');
    }
  };

  return (
    <div ref={topRef} className="min-h-screen p-4 md:p-8 relative overflow-x-clip" style={{
      background: 'linear-gradient(180deg, #fff5f5 0%, #ffe0e0 10%, #ffcccc 20%, #ffb3b3 35%, #ff9999 50%, #ff8080 65%, #e06666 80%, #cc4d4d 90%, #b33b3b 100%)',
      backgroundAttachment: 'fixed'
    }}>
      <div className="max-w-6xl mx-auto relative z-10">
        {/* Header */}
        <div className="mb-6 md:mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-[#2c1212] mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>
                Upload & Analyze Your CBC Report
              </h1>
              <p className="text-[#4e2a2a] max-w-3xl font-medium">
                Upload an image of your Complete Blood Count (CBC) report. 
                Our advanced OCR technology will extract all values, and our AI will provide clear, 
                easy-to-understand insights.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button 
                onClick={handleReset}
                className="bg-white/80 backdrop-blur-sm text-[#8B0000] hover:bg-white hover:text-[#B22222] border border-[#8B0000]/30 shadow-md transition-all duration-300 hover:scale-105"
              >
                <i className="fas fa-redo-alt mr-2"></i>
                Reset Form
              </Button>
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center shadow-md">
                  <i className="fas fa-robot text-lg text-[#8B0000]"></i>
                </div>
                <span className="text-sm font-semibold text-[#4e2a2a]">AI-Powered Analysis</span>
              </div>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <Alert className="mb-6 border-red-300 bg-red-100/90 backdrop-blur-sm shadow-lg">
            <i className="fas fa-exclamation-circle text-red-600 mt-1"></i>
            <AlertDescription className="text-red-800">
              {error}
              {uploadMethod === 'file' && (
                <Button 
                  variant="outline" 
                  size="sm"
                  className="mt-2 border-red-400 text-red-700 hover:bg-red-200 ml-2"
                  onClick={() => {
                    setUploadMethod('manual');
                    setError(null);
                  }}
                >
                  <i className="fas fa-edit mr-2"></i>
                  Switch to Manual Entry
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Upload Methods Tabs */}
        <div className="mb-6 md:mb-8">
          <div className="flex flex-wrap gap-2 border-b border-white/30">
            <button
              onClick={() => {
                setUploadMethod('file');
                setError(null);
                clearAllData();
              }}
              className={`flex items-center gap-3 px-6 py-3 rounded-t-lg transition-all duration-300 ${
                uploadMethod === 'file'
                  ? 'bg-white/95 backdrop-blur-sm border-t border-x border-white/50 text-[#8B0000] font-semibold shadow-lg scale-105'
                  : 'text-[#4e2a2a] hover:text-[#8B0000] hover:bg-white/40 backdrop-blur-sm'
              }`}
            >
              <i className={`fas fa-file-upload ${uploadMethod === 'file' ? 'text-[#8B0000]' : 'text-[#8B0000]/60'}`}></i>
              <div className="text-left">
                <div className="font-medium">Upload File</div>
                <div className="text-xs text-gray-600">JPG, PNG</div>
              </div>
            </button>
            <button
              onClick={() => {
                setUploadMethod('manual');
                setError(null);
              }}
              className={`flex items-center gap-3 px-6 py-3 rounded-t-lg transition-all duration-300 ${
                uploadMethod === 'manual'
                  ? 'bg-white/95 backdrop-blur-sm border-t border-x border-white/50 text-[#8B0000] font-semibold shadow-lg scale-105'
                  : 'text-[#4e2a2a] hover:text-[#8B0000] hover:bg-white/40 backdrop-blur-sm'
              }`}
            >
              <i className={`fas fa-keyboard ${uploadMethod === 'manual' ? 'text-[#8B0000]' : 'text-[#8B0000]/60'}`}></i>
              <div className="text-left">
                <div className="font-medium">Manual Entry</div>
                <div className="text-xs text-gray-600">If OCR Fails</div>
              </div>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
          {/* Left Column - Upload Interface */}
          <div className="lg:col-span-2 space-y-6">
            {/* Upload Area */}
            {uploadMethod === 'file' && (
              <Card className="shadow-2xl hover:shadow-red-900/30 transition-all duration-500 border-0 bg-white/95 backdrop-blur-sm">
                <CardContent className="p-8">
                  <div 
                    className={`rounded-xl border-2 border-dashed transition-all duration-300 ${
                      isDragging ? 'border-[#8B0000] bg-[#fff8f8] scale-105' : 'border-gray-300 hover:border-[#8B0000]/50'
                    } p-12 text-center cursor-pointer`}
                    onClick={() => document.getElementById('file-input').click()}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                  >
                    <input
                      type="file"
                      id="file-input"
                      accept="image/jpeg,image/jpg,image/png"
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                    
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#8B0000] to-[#B22222] flex items-center justify-center mx-auto mb-6 shadow-xl transform transition hover:scale-110 duration-300">
                      <i className="fas fa-cloud-upload-alt text-3xl text-white"></i>
                    </div>
                    
                    <h3 className="text-xl font-semibold text-[#2c1212] mb-2">
                      {selectedFile ? 'File Selected!' : 'Drag & Drop Your Report'}
                    </h3>
                    <p className="text-[#4e2a2a] mb-4">
                      {selectedFile 
                        ? selectedFile.name
                        : 'Supported formats: JPG, PNG (Max 10MB)'
                      }
                    </p>
                    
                    {!selectedFile && (
                      <Button 
                        className="bg-gradient-to-r from-[#8B0000] to-[#B22222] hover:from-[#A52A2A] hover:to-[#8B0000] text-white shadow-lg shadow-red-900/50 hover:shadow-red-900/70 transition-all duration-300 hover:scale-105"
                      >
                        <i className="fas fa-folder-open mr-2"></i>
                        Browse Files
                      </Button>
                    )}
                    
                    {selectedFile && !isProcessing && !extractedData && (
                      <div className="flex gap-3 justify-center mt-4">
                        <Button 
                          variant="outline"
                          onClick={() => {
                            setSelectedFile(null);
                            setExtractedData(null);
                            setError(null);
                          }}
                          className="border-gray-400 text-[#4e2a2a] hover:border-[#8B0000] hover:text-[#8B0000] transition-all duration-300"
                        >
                          <i className="fas fa-times mr-2"></i>
                          Change File
                        </Button>
                        <Button 
                          onClick={() => handleFileUpload(selectedFile)}
                          className="bg-gradient-to-r from-[#8B0000] to-[#B22222] hover:from-[#A52A2A] hover:to-[#8B0000] text-white shadow-lg shadow-red-900/50 transition-all duration-300 hover:scale-105"
                          disabled={isProcessing}
                        >
                          {isProcessing ? 'Processing...' : 'Extract & Analyze'}
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* OCR Progress Bar */}
                  {isProcessing && (
                    <div className="mt-6 animate-fadeIn">
                      <div className="flex justify-between text-sm text-[#4e2a2a] mb-2 font-medium">
                        <span>Extracting data with OCR...</span>
                        <span>{ocrProgress}%</span>
                      </div>
                      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-[#8B0000] to-[#B22222] transition-all duration-500 rounded-full"
                          style={{ width: `${ocrProgress}%` }}
                        ></div>
                      </div>
                      <p className="text-xs text-[#4e2a2a] mt-2">
                        Our OCR technology is reading values from your report...
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Manual Entry */}
            {uploadMethod === 'manual' && (
              <Card className="shadow-2xl hover:shadow-red-900/30 transition-all duration-500 border-0 bg-white/95 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-[#2c1212]">
                    <i className="fas fa-keyboard text-[#8B0000]"></i>
                    Enter CBC Values Manually
                  </CardTitle>
                  <CardDescription className="text-[#4e2a2a]">
                    Enter your CBC values if OCR extraction failed or you prefer manual input
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="font-semibold text-[#2c1212]">
                        Sex (for correct reference ranges)
                        <span className="ml-2 text-xs font-normal text-gray-500">(Cleveland Clinic)</span>
                      </label>
                      <select
                        value={manualGender || ''}
                        onChange={(e) => {
                          const v = e.target.value || null;
                          setManualGender(v);
                          if (onStateChange) {
                            onStateChange({
                              uploadMethod,
                              extractedData,
                              manualData,
                              manualGender: v
                            });
                          }
                        }}
                        className="w-full px-4 py-2 border-2 rounded-lg bg-white focus:ring-2 focus:ring-[#8B0000] focus:border-transparent transition-all duration-300 border-gray-300 hover:border-[#8B0000]/50"
                      >
                        <option value="">Not specified</option>
                        <option value="female">Female</option>
                        <option value="male">Male</option>
                      </select>
                      <p className="text-xs text-gray-600">
                        Hb/RBC/Hct ranges change based on selected sex.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    {Object.entries(cbcReferenceRanges).map(([field, range]) => {
                      const displayRange = getRangeForManualField(field) || range;
                      const inhumanError = manualData[field] ? validateInhumanValue(manualData[field], field) : null;
                      const hasError = inhumanError !== null;
                      
                      return (
                        <div key={field} className="space-y-2 group">
                          <div className="flex justify-between items-center">
                            <label className="font-semibold text-[#2c1212] capitalize group-hover:text-[#8B0000] transition-colors">
                              {field}
                              {range.mandatory && <span className="ml-1 text-red-500">*</span>}
                              <span className="ml-2 text-xs text-gray-500 font-normal">({displayRange.unit})</span>
                            </label>
                            {manualData[field] && !hasError && (
                              <span className={`text-xs px-2 py-1 rounded-full shadow-sm ${getStatusColor(manualData[field], field)}`}>
                                <i className={`${getStatusIcon(manualData[field], field)} mr-1`}></i>
                                {checkValueStatus(manualData[field], field)}
                              </span>
                            )}
                          </div>
                          <input
                            type="number"
                            step={field === 'wbc' || field === 'platelets' ? "0.1" : "0.1"}
                            placeholder={`${displayRange.min} - ${displayRange.max}`}
                            value={manualData[field]}
                            onChange={(e) => handleManualInputChange(field, e.target.value)}
                            className={`w-full px-4 py-2 border-2 rounded-lg focus:ring-2 focus:ring-[#8B0000] focus:border-transparent transition-all duration-300 ${
                              hasError 
                                ? 'border-red-400 bg-red-50' 
                                : 'border-gray-300 hover:border-[#8B0000]/50'
                            }`}
                          />
                          {range.note && !hasError && manualData[field] && (
                            <div className="text-xs text-gray-500 italic">
                              <i className="fas fa-info-circle mr-1"></i>
                              {range.note}
                            </div>
                          )}
                          {hasError && (
                            <div className="text-xs text-red-700 bg-red-100 border border-red-300 rounded-lg p-2">
                              <i className="fas fa-exclamation-circle mr-1"></i>
                              {inhumanError}
                            </div>
                          )}
                          {!hasError && manualData[field] && (
                            <div className="text-xs text-gray-600 flex justify-between">
                              <span>Ref: {displayRange.min}-{displayRange.max} {displayRange.unit}</span>
                              <span className="font-medium">
                                {parseFloat(manualData[field]) < displayRange.min ? '⬇️ Below normal' : 
                                 parseFloat(manualData[field]) > displayRange.max ? '⬆️ Above normal' : '✅ Normal'}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  
                  <div className="mb-4 p-3 bg-blue-100/80 backdrop-blur-sm border border-blue-300 rounded-lg shadow-inner">
                    <p className="text-sm text-blue-900">
                      <i className="fas fa-info-circle mr-2"></i>
                      <strong>Note:</strong> Fields marked with <span className="text-red-600 font-bold">*</span> are mandatory.
                      {uploadMethod === 'manual' && ' WBC and Platelets are in cells/µL. Differentials are in %.'}
                    </p>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button 
                      onClick={handleManualSubmit}
                      className={`bg-gradient-to-r from-[#8B0000] to-[#B22222] hover:from-[#A52A2A] hover:to-[#8B0000] text-white shadow-lg shadow-red-900/50 transition-all duration-300 hover:scale-105 ${
                        !isManualFormValid() ? 'opacity-60 cursor-not-allowed hover:scale-100' : ''
                      }`}
                      disabled={!isManualFormValid()}
                      size="lg"
                    >
                      <i className="fas fa-brain mr-2"></i>
                      Analyze with AI
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => setUploadMethod('file')}
                      className="border-2 border-[#8B0000] text-[#8B0000] hover:bg-[#FFE4E1] hover:border-[#B22222] transition-all duration-300 hover:scale-105"
                    >
                      <i className="fas fa-file-upload mr-2"></i>
                      Try OCR Upload Instead
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* OCR Results Preview */}
            {extractedData && !isProcessing && (
              <Card className="shadow-2xl border border-green-300 bg-white/95 backdrop-blur-sm animate-fadeIn">
                <CardHeader className="bg-gradient-to-r from-green-100 to-green-50 border-b border-green-200">
                  <CardTitle className="flex items-center gap-2 text-green-800">
                    <i className="fas fa-check-circle"></i>
                    Data Extracted Successfully!
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-[#2c1212]">{extractedData.fileName}</h4>
                      <p className="text-sm text-[#4e2a2a]">Extracted on {extractedData.date}</p>
                    </div>
                    <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium shadow-md">
                      <i className="fas fa-robot mr-1"></i>
                      AI Ready
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {Object.entries(extractedData.values).map(([field, value]) => {
                      const range = cbcReferenceRanges[field];
                      return (
                        <div 
                          key={field}
                          className={`p-3 rounded-lg border shadow-sm transition-all hover:scale-105 duration-300 ${
                            getStatusColor(value, field)
                          }`}
                        >
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-xs font-semibold text-gray-700 capitalize">{field}</span>
                            <i className={`${getStatusIcon(value, field)} text-sm`}></i>
                          </div>
                          <div className="text-lg font-bold">{value}</div>
                          <div className="text-xs text-gray-600">{range?.unit || 'units'}</div>
                        </div>
                      );
                    })}
                  </div>
                  
                  <div className="mt-6 flex gap-3">
                    <Button 
                      onClick={handleFileSubmit}
                      className="bg-gradient-to-r from-[#8B0000] to-[#B22222] hover:from-[#A52A2A] hover:to-[#8B0000] text-white shadow-lg shadow-red-900/50 flex-1 transition-all duration-300 hover:scale-105"
                    >
                      <i className="fas fa-chart-line mr-2"></i>
                      Analyze with AI
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => {
                        setExtractedData(null);
                        setSelectedFile(null);
                      }}
                      className="border-2 border-gray-400 text-[#4e2a2a] hover:border-[#8B0000] hover:text-[#8B0000] transition-all duration-300 hover:scale-105"
                    >
                      <i className="fas fa-redo mr-2"></i>
                      Upload Another
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column - Features */}
          <div className="space-y-6">
            {/* Supported Formats */}
            <Card className="shadow-2xl hover:shadow-red-900/20 transition-all duration-500 border-0 bg-white/95 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-[#2c1212]">
                  <i className="fas fa-file-alt text-[#8B0000]"></i>
                  Supported Formats
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 hover:bg-gradient-to-r hover:from-[#FFE4E1] hover:to-transparent rounded-lg transition-all duration-300 group cursor-pointer">
                    <i className="fas fa-file-image text-green-600 text-xl group-hover:scale-110 transition-transform"></i>
                    <span className="font-semibold text-gray-700 group-hover:text-[#8B0000] transition-colors">JPG Images</span>
                    <span className="ml-auto text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full shadow-sm">Supported</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 hover:bg-gradient-to-r hover:from-[#FFE4E1] hover:to-transparent rounded-lg transition-all duration-300 group cursor-pointer">
                    <i className="fas fa-file-image text-blue-600 text-xl group-hover:scale-110 transition-transform"></i>
                    <span className="font-semibold text-gray-700 group-hover:text-[#8B0000] transition-colors">PNG Images</span>
                    <span className="ml-auto text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full shadow-sm">Supported</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* AI Features */}
            <Card className="shadow-2xl hover:shadow-red-900/20 transition-all duration-500 border-0 bg-white/95 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-[#2c1212]">
                  <i className="fas fa-magic text-[#8B0000]"></i>
                  AI Features
                </CardTitle>
                <CardDescription className="text-[#4e2a2a]">
                  Click on any feature to learn more
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {aiFeatures.map((feature, index) => (
                    <div key={index} className="group">
                      <div 
                        className={`p-4 rounded-xl cursor-pointer transition-all duration-300 ${
                          expandedFeature === index 
                            ? 'bg-gradient-to-r from-[#8B0000] to-[#B22222] text-white shadow-xl'
                            : 'bg-white border-2 border-gray-200 hover:border-[#8B0000] hover:shadow-lg'
                        }`}
                        onClick={() => setExpandedFeature(expandedFeature === index ? null : index)}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-300 ${
                            expandedFeature === index ? 'bg-white/20' : 'bg-gradient-to-br from-[#FFE4E1] to-[#fff8f8] group-hover:scale-110'
                          }`}>
                            <i className={`fas ${feature.icon} text-xl ${expandedFeature === index ? 'text-white' : 'text-[#8B0000]'}`}></i>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <h4 className={`font-bold text-lg ${expandedFeature === index ? 'text-white' : 'text-[#2c1212]'}`}>
                                {feature.title}
                              </h4>
                              <i className={`fas fa-chevron-down transition-transform duration-300 ${expandedFeature === index ? 'rotate-180' : ''} ${expandedFeature === index ? 'text-white' : 'text-[#8B0000]'}`}></i>
                            </div>
                            <p className={`text-sm mt-1 ${expandedFeature === index ? 'text-white/90' : 'text-gray-600'}`}>
                              {feature.shortDesc}
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      {expandedFeature === index && (
                        <div className="mt-2 p-4 bg-gradient-to-r from-[#FFF0EE] to-[#FFE4E1] rounded-xl shadow-inner animate-slideDown">
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-full bg-[#8B0000]/10 flex items-center justify-center flex-shrink-0">
                              <i className={`fas ${feature.icon} text-[#8B0000] text-sm`}></i>
                            </div>
                            <div>
                              <p className="text-sm text-[#4e2a2a] leading-relaxed">{feature.longDesc}</p>
                              <button 
                                className="mt-3 text-xs font-semibold text-[#8B0000] hover:text-[#B22222] transition-colors"
                                onClick={() => setExpandedFeature(null)}
                              >
                                <i className="fas fa-times-circle mr-1"></i>
                                Close
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Disclaimer */}
            <Alert className="border-amber-300 bg-amber-100/90 backdrop-blur-sm shadow-lg">
              <i className="fas fa-exclamation-triangle text-amber-700 mt-1"></i>
              <AlertDescription className="text-amber-800">
                <strong className="font-semibold">Medical Disclaimer:</strong> This tool helps you understand your reports. 
                Always consult with a healthcare professional for medical advice.
              </AlertDescription>
            </Alert>
          </div>
        </div>
      </div>

      {/* Animation keyframes */}
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out;
        }
        
        .animate-slideDown {
          animation: slideDown 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default UploadReport;