import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import axios from 'axios';

const UploadReport = ({ onUploadSuccess, onBack, initialMode }) => {
  const [uploadMethod, setUploadMethod] = useState(initialMode || 'file'); // 'file', 'camera', 'manual'
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [extractedData, setExtractedData] = useState(null);
  const [error, setError] = useState(null);
  const [manualData, setManualData] = useState({
    hemoglobin: '',
    wbc: '',
    platelets: '',
    rbc: '',
    hematocrit: '',
    mcv: '',
    mch: '',
    mchc: ''
  });

  const cbcReferenceRanges = {
    hemoglobin: { min: 13.5, max: 17.5, unit: 'g/dL', mandatory: true, inhumanMin: 3, inhumanMax: 25 },
    wbc: { min: 4.5, max: 11.0, unit: '×10³/µL', mandatory: true, inhumanMin: 0.5, inhumanMax: 100 },
    platelets: { min: 150, max: 450, unit: '×10³/µL', mandatory: true, inhumanMin: 10, inhumanMax: 2000 },
    rbc: { min: 4.5, max: 5.9, unit: '×10⁶/µL', mandatory: true, inhumanMin: 1, inhumanMax: 10 },
    hematocrit: { min: 41, max: 53, unit: '%', mandatory: false, inhumanMin: 10, inhumanMax: 70 },
    mcv: { min: 80, max: 100, unit: 'fL', mandatory: false, inhumanMin: 50, inhumanMax: 150 },
    mch: { min: 27, max: 33, unit: 'pg', mandatory: false, inhumanMin: 15, inhumanMax: 50 },
    mchc: { min: 32, max: 36, unit: 'g/dL', mandatory: false, inhumanMin: 20, inhumanMax: 45 }
  };

  useEffect(() => {
    if (initialMode) {
      setUploadMethod(initialMode);
    }
  }, [initialMode]);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file && (file.type === 'application/pdf' || file.type.startsWith('image/'))) {
      setSelectedFile(file);
      setError(null);
      handleFileUpload(file);
    } else {
      setError('Please upload a PDF or image file (JPG, PNG)');
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.type === 'application/pdf' || file.type.startsWith('image/'))) {
      setSelectedFile(file);
      setError(null);
      handleFileUpload(file);
    } else {
      setError('Please upload a PDF or image file (JPG, PNG)');
    }
  };

  const handleFileUpload = async (file) => {
    setIsProcessing(true);
    setOcrProgress(0);
    setError(null);
    
    try {
        const formData = new FormData();
        formData.append('file', file);

        // Simulate progress
        const progressInterval = setInterval(() => {
            setOcrProgress(prev => {
                if (prev >= 90) {
                    clearInterval(progressInterval);
                    return 90;
                }
                return prev + 10;
            });
        }, 200);

        const response = await axios.post('http://localhost:5000/api/upload', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });

        clearInterval(progressInterval);
        setOcrProgress(100);

        if (response.data && response.data.extractedData) {
            const ocrData = response.data.extractedData;
            
            // Extract CBC values if available (they should be at the root level)
            const cbcValues = {};
            const cbcParams = ['hemoglobin', 'wbc', 'platelets', 'rbc', 'hematocrit', 'mcv', 'mch', 'mchc', 'rdw'];
            cbcParams.forEach(param => {
                if (ocrData[param] !== undefined && ocrData[param] !== null && !isNaN(ocrData[param])) {
                    cbcValues[param] = ocrData[param].toString();
                }
            });
            
            // Display the extracted values
            setExtractedData({
                fileName: file.name,
                date: new Date().toLocaleDateString(),
                values: cbcValues, // Use extracted CBC values
                allText: ocrData.all_text || '',
                totalDetections: ocrData.total_detections || 0,
                ocrResult: ocrData.ocr_result || ocrData.raw_ocr || [],
                warnings: response.data.warnings || []
            });
            
            // If no CBC values were extracted but we have OCR text, show a helpful message
            if (Object.keys(cbcValues).length === 0 && ocrData.all_text) {
                console.log('⚠️ OCR extracted text but no CBC values parsed. Text:', ocrData.all_text.substring(0, 200));
            }
            
            console.log('✅ Successfully extracted:', { cbcValues, totalDetections: ocrData.total_detections });
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
    } finally {
        setIsProcessing(false);
    }
  };

  const handleManualInputChange = (field, value) => {
    setManualData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const checkValueStatus = (value, field) => {
    const range = cbcReferenceRanges[field];
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

  // Extract CBC values from OCR text
  const extractCBCValuesFromText = (text) => {
    const values = {};
    const textLower = text.toLowerCase();
    
    // Simple pattern matching for common CBC parameters
    const patterns = {
      hemoglobin: /(?:hemoglobin|haemoglobin|hb|hgb)[\s:]*(\d+\.?\d*)/i,
      wbc: /(?:wbc|white\s*blood\s*cells?|total\s*w\.?\s*b\.?\s*c\.?)[\s:]*(\d+\.?\d*)/i,
      platelets: /(?:platelets?|plt|platelet\s*count)[\s:]*(\d+\.?\d*)/i,
      rbc: /(?:rbc|red\s*blood\s*cells?|total\s*r\.?\s*b\.?\s*c\.?)[\s:]*(\d+\.?\d*)/i,
      hematocrit: /(?:hematocrit|haematocrit|hct|h\.?\s*c\.?\s*t\.?)[\s:]*(\d+\.?\d*)/i,
      mcv: /(?:mcv|m\.?\s*c\.?\s*v\.?)[\s:]*(\d+\.?\d*)/i,
      mch: /(?:mch|m\.?\s*c\.?\s*h\.?)[\s:]*(\d+\.?\d*)/i,
      mchc: /(?:mchc|m\.?\s*c\.?\s*h\.?\s*c\.?)[\s:]*(\d+\.?\d*)/i
    };
    
    for (const [key, pattern] of Object.entries(patterns)) {
      const match = text.match(pattern);
      if (match) {
        values[key] = parseFloat(match[1]);
      }
    }
    
    return values;
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
    const range = cbcReferenceRanges[field];
    if (!range || !value) return null;
    const numValue = parseFloat(value);
    if (numValue < range.inhumanMin) {
      return `Value too low (${value}). Minimum physiologically possible: ${range.inhumanMin} ${range.unit}. Please check your input.`;
    }
    if (numValue > range.inhumanMax) {
      return `Value too high (${value}). Maximum physiologically possible: ${range.inhumanMax} ${range.unit}. Please check your input.`;
    }
    return null;
  };

  const handleManualSubmit = async () => {
    setError(null);
    
    // Validate mandatory fields
    const mandatoryFields = Object.entries(cbcReferenceRanges)
      .filter(([_, range]) => range.mandatory)
      .map(([field]) => field);
    
    const missingFields = mandatoryFields.filter(field => !manualData[field] || manualData[field] === '');
    
    if (missingFields.length > 0) {
      setError(`Please fill in all mandatory fields: ${missingFields.map(f => f.charAt(0).toUpperCase() + f.slice(1)).join(', ')}`);
      return;
    }

    // Validate inhuman values
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
      const response = await axios.post('http://localhost:5000/api/reports', {
        cbcData: manualData
      });

      if (onUploadSuccess) {
        onUploadSuccess({
          reportId: response.data.reportId || Date.now().toString(),
          extractedData: manualData,
          filename: 'manual_entry'
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
        filename: extractedData.fileName
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-[#fff8f8] to-[#FFE4E1] p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6 md:mb-8">
          {onBack && (
            <button 
              onClick={onBack}
              className="flex items-center gap-2 text-[#8B0000] hover:text-[#B22222] mb-4 group transition-colors"
            >
              <i className="fas fa-arrow-left group-hover:-translate-x-1 transition-transform"></i>
              <span className="font-medium">Back to Dashboard</span>
            </button>
          )}
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-[#8B0000] mb-2">
                Upload & Analyze Your CBC Report
              </h1>
              <p className="text-gray-600 max-w-3xl">
                Upload an image or PDF of your Complete Blood Count (CBC) report. 
                Our advanced OCR technology will extract all values, and our AI will provide clear, 
                easy-to-understand insights.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-[#FFE4E1] flex items-center justify-center">
                <i className="fas fa-robot text-lg text-[#8B0000]"></i>
              </div>
              <span className="text-sm text-gray-600">AI-Powered Analysis</span>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <Alert className="mb-6 border-red-200 bg-red-50">
            <i className="fas fa-exclamation-circle text-red-600 mt-1"></i>
            <AlertDescription className="text-red-800">
              {error}
              {uploadMethod === 'file' && (
                <Button 
                  variant="outline" 
                  size="sm"
                  className="mt-2 border-red-300 text-red-700 hover:bg-red-100"
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
          <div className="flex flex-wrap gap-2 border-b border-gray-200">
            {[
              { id: 'file', icon: 'fa-file-upload', label: 'Upload File', desc: 'PDF, JPG, PNG' },
              { id: 'camera', icon: 'fa-camera', label: 'Take Photo', desc: 'Use Camera' },
              { id: 'manual', icon: 'fa-keyboard', label: 'Manual Entry', desc: 'If OCR Fails' }
            ].map(method => (
              <button
                key={method.id}
                onClick={() => {
                  setUploadMethod(method.id);
                  setError(null);
                }}
                className={`flex items-center gap-3 px-4 py-3 rounded-t-lg transition-all ${
                  uploadMethod === method.id
                    ? 'bg-white border-t border-x border-gray-200 text-[#8B0000] font-semibold shadow-sm'
                    : 'text-gray-600 hover:text-[#8B0000] hover:bg-white/50'
                }`}
              >
                <i className={`fas ${method.icon} ${uploadMethod === method.id ? 'text-[#8B0000]' : 'text-gray-400'}`}></i>
                <div className="text-left">
                  <div className="font-medium">{method.label}</div>
                  <div className="text-xs text-gray-500">{method.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
          {/* Left Column - Upload Interface */}
          <div className="lg:col-span-2 space-y-6">
            {/* Upload Area */}
            {uploadMethod === 'file' && (
              <Card className="shadow-xl shadow-[#DC143C]/10 border-2 border-dashed border-[#8B0000]/20 hover:border-[#8B0000]/40 transition-all duration-300">
                <CardContent className="p-8">
                  <div 
                    className={`upload-dropzone rounded-xl border-2 border-dashed ${
                      isDragging ? 'border-[#8B0000] bg-[#fff8f8]' : 'border-gray-300'
                    } p-12 text-center transition-all cursor-pointer`}
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
                      accept=".pdf,.jpg,.jpeg,.png"
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                    
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#FFE4E1] to-[#fff8f8] flex items-center justify-center mx-auto mb-6">
                      <i className="fas fa-cloud-upload-alt text-3xl text-[#8B0000]"></i>
                    </div>
                    
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                      {selectedFile ? 'File Selected!' : 'Drag & Drop Your Report'}
                    </h3>
                    <p className="text-gray-600 mb-4">
                      {selectedFile 
                        ? selectedFile.name
                        : 'Supported formats: PDF, JPG, PNG (Max 10MB)'
                      }
                    </p>
                    
                    {!selectedFile && (
                      <Button 
                        className="bg-[#8B0000] hover:bg-[#B22222] text-white shadow-lg shadow-[#8B0000]/30"
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
                          className="border-gray-300"
                        >
                          <i className="fas fa-times mr-2"></i>
                          Change File
                        </Button>
                        <Button 
                          onClick={() => handleFileUpload(selectedFile)}
                          className="bg-[#8B0000] hover:bg-[#B22222] text-white"
                          disabled={isProcessing}
                        >
                          {isProcessing ? 'Processing...' : 'Extract & Analyze'}
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* OCR Progress Bar */}
                  {isProcessing && (
                    <div className="mt-6">
                      <div className="flex justify-between text-sm text-gray-600 mb-2">
                        <span>Extracting data with OCR...</span>
                        <span>{ocrProgress}%</span>
                      </div>
                      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-[#8B0000] to-[#B22222] transition-all duration-300"
                          style={{ width: `${ocrProgress}%` }}
                        ></div>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        Our OCR technology is reading values from your report...
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Camera Upload */}
            {uploadMethod === 'camera' && (
              <Card className="shadow-xl shadow-[#DC143C]/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <i className="fas fa-camera text-[#8B0000]"></i>
                    Take Photo of Your Report
                  </CardTitle>
                  <CardDescription>
                    Use your camera to capture a clear photo of your CBC report
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center">
                    <div className="w-32 h-32 rounded-full bg-gradient-to-br from-[#FFE4E1] to-[#fff8f8] flex items-center justify-center mx-auto mb-6">
                      <i className="fas fa-camera-retro text-4xl text-[#8B0000]"></i>
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                      Camera Access Required
                    </h3>
                    <p className="text-gray-600 mb-6">
                      Please allow camera access to take a photo of your report.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                      <Button 
                        className="bg-[#8B0000] hover:bg-[#B22222] text-white"
                        onClick={() => {
                          // In production, this would open camera
                          alert('Camera feature would open here. For now, please use file upload.');
                        }}
                      >
                        <i className="fas fa-camera mr-2"></i>
                        Open Camera
                      </Button>
                      <Button 
                        variant="outline"
                        onClick={() => setUploadMethod('file')}
                      >
                        <i className="fas fa-file-upload mr-2"></i>
                        Upload File Instead
                      </Button>
                    </div>
                  </div>
                  <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex items-start gap-3">
                      <i className="fas fa-lightbulb text-amber-600 mt=1"></i>
                      <div>
                        <h4 className="font-semibold text-amber-800 mb-1">Tips for Best Results:</h4>
                        <ul className="text-sm text-amber-700 space-y-1">
                          <li>• Ensure good lighting and no shadows</li>
                          <li>• Keep the report flat and in focus</li>
                          <li>• Include all sections of the report</li>
                          <li>• Avoid glare on the paper</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Manual Entry */}
            {uploadMethod === 'manual' && (
              <Card className="shadow-xl shadow-[#DC143C]/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <i className="fas fa-keyboard text-[#8B0000]"></i>
                    Enter CBC Values Manually
                  </CardTitle>
                  <CardDescription>
                    Enter your CBC values if OCR extraction failed or you prefer manual input
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    {Object.entries(cbcReferenceRanges).map(([field, range]) => {
                      const inhumanError = manualData[field] ? validateInhumanValue(manualData[field], field) : null;
                      const hasError = inhumanError !== null;
                      
                      return (
                        <div key={field} className="space-y-2">
                          <div className="flex justify-between items-center">
                            <label className="font-medium text-gray-700 capitalize">
                              {field}
                              {range.mandatory && (
                                <span className="ml-1 text-red-500">*</span>
                              )}
                              <span className="ml-2 text-xs text-gray-500">
                                ({range.unit})
                              </span>
                            </label>
                            {manualData[field] && !hasError && (
                              <span className={`text-xs px-2 py-1 rounded-full ${
                                getStatusColor(manualData[field], field)
                              }`}>
                                <i className={`${getStatusIcon(manualData[field], field)} mr-1`}></i>
                                {checkValueStatus(manualData[field], field)}
                              </span>
                            )}
                            {hasError && (
                              <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-800 border border-red-200">
                                <i className="fas fa-exclamation-triangle mr-1"></i>
                                Invalid
                              </span>
                            )}
                          </div>
                          <input
                            type="number"
                            step="0.1"
                            placeholder={`${range.min} - ${range.max}`}
                            value={manualData[field]}
                            onChange={(e) => handleManualInputChange(field, e.target.value)}
                            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#8B0000] focus:border-transparent transition-all ${
                              hasError 
                                ? 'border-red-300 bg-red-50' 
                                : 'border-gray-300'
                            }`}
                            required={range.mandatory}
                          />
                          {hasError && (
                            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">
                              <i className="fas fa-exclamation-circle mr-1"></i>
                              {inhumanError}
                            </div>
                          )}
                          {!hasError && (
                            <div className="text-xs text-gray-500 flex justify-between">
                              <span>Ref: {range.min}-{range.max}</span>
                              {manualData[field] && (
                                <span>
                                  {parseFloat(manualData[field]) < range.min ? 'Below normal' : 
                                   parseFloat(manualData[field]) > range.max ? 'Above normal' : 
                                   'Normal'}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-800">
                      <i className="fas fa-info-circle mr-2"></i>
                      <strong>Note:</strong> Fields marked with <span className="text-red-500">*</span> are mandatory. 
                      Values outside physiologically possible ranges will be flagged.
                    </p>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button 
                      onClick={handleManualSubmit}
                      className="bg-[#8B0000] hover:bg-[#B22222] text-white shadow-lg"
                      size="lg"
                    >
                      <i className="fas fa-brain mr-2"></i>
                      Analyze Manual Entry
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => setUploadMethod('file')}
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
              <Card className="shadow-lg border border-green-200">
                <CardHeader className="bg-green-50 border-b border-green-200">
                  <CardTitle className="flex items-center gap-2 text-green-800">
                    <i className="fas fa-check-circle"></i>
                    Data Extracted Successfully!
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-gray-900">{extractedData.fileName}</h4>
                      <p className="text-sm text-gray-600">Extracted on {extractedData.date}</p>
                    </div>
                    <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                      <i className="fas fa-robot mr-1"></i>
                      AI Ready
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {Object.entries(extractedData.values).map(([field, value]) => (
                      <div 
                        key={field}
                        className={`p-3 rounded-lg border ${
                          getStatusColor(value, field)
                        }`}
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs font-medium text-gray-700 capitalize">
                            {field}
                          </span>
                          <i className={`${getStatusIcon(value, field)} text-sm`}></i>
                        </div>
                        <div className="text-lg font-bold">{value}</div>
                        <div className="text-xs text-gray-500">
                          {cbcReferenceRanges[field]?.unit}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="mt-6 flex gap-3">
                    <Button 
                      onClick={handleFileSubmit}
                      className="bg-[#8B0000] hover:bg-[#B22222] text-white flex-1"
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
                    >
                      <i className="fas fa-redo mr-2"></i>
                      Upload Another
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column - Instructions & Features */}
          <div className="space-y-6">
            {/* How It Works */}
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <i className="fas fa-info-circle text-[#8B0000]"></i>
                  How It Works
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { icon: 'fa-upload', title: 'Upload Report', desc: 'Upload your CBC report as PDF or image' },
                    { icon: 'fa-search', title: 'OCR Extraction', desc: 'Our AI extracts all values automatically' },
                    { icon: 'fa-brain', title: 'AI Analysis', desc: 'ML models analyze and detect abnormalities' },
                    { icon: 'fa-chart-line', title: 'Get Insights', desc: 'Receive clear explanations & trends' }
                  ].map((step, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#FFE4E1] flex items-center justify-center flex-shrink-0">
                        <i className={`fas ${step.icon} text-[#8B0000]`}></i>
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900">{step.title}</h4>
                        <p className="text-sm text-gray-600">{step.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Supported Formats */}
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <i className="fas fa-file-alt text-[#8B0000]"></i>
                  Supported Formats
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { format: 'PDF Reports', icon: 'fa-file-pdf', color: 'text-red-500' },
                    { format: 'JPG Images', icon: 'fa-file-image', color: 'text-green-500' },
                    { format: 'PNG Images', icon: 'fa-file-image', color: 'text-blue-500' },
                    { format: 'Camera Photos', icon: 'fa-camera', color: 'text-purple-500' }
                  ].map((item, index) => (
                    <div key={index} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg transition-colors">
                      <i className={`fas ${item.icon} ${item.color} text-lg`}></i>
                      <span className="font-medium">{item.format}</span>
                      <span className="ml-auto text-xs text-gray-500 px-2 py-1 bg-gray-100 rounded">
                        Supported
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* AI Features Preview */}
            <Card className="shadow-lg bg-gradient-to-br from-[#fff8f8] to-white">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <i className="fas fa-magic text-[#8B0000]"></i>
                  AI Features
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-3 bg-white rounded-lg border border-gray-200">
                    <div className="flex items-center gap-2 mb-2">
                      <i className="fas fa-robot text-[#8B0000]"></i>
                      <h4 className="font-semibold">ML Diagnosis</h4>
                    </div>
                    <p className="text-sm text-gray-600">
                      Detects conditions like anemia, infection risks, and more
                    </p>
                  </div>
                  
                  <div className="p-3 bg-white rounded-lg border border-gray-200">
                    <div className="flex items-center gap-2 mb-2">
                      <i className="fas fa-chart-line text-[#8B0000]"></i>
                      <h4 className="font-semibold">Trend Analysis</h4>
                    </div>
                    <p className="text-sm text-gray-600">
                      Tracks your health parameters over time
                    </p>
                  </div>
                  
                  <div className="p-3 bg-white rounded-lg border border-gray-200">
                    <div className="flex items-center gap-2 mb-2">
                      <i className="fas fa-apple-alt text-[#8B0000]"></i>
                      <h4 className="font-semibold">Personalized Tips</h4>
                    </div>
                    <p className="text-sm text-gray-600">
                      Diet and lifestyle recommendations based on your results
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Disclaimer */}
            <Alert className="border-amber-200 bg-amber-50">
              <i className="fas fa-exclamation-triangle text-amber-600 mt-1"></i>
              <AlertDescription className="text-amber-800">
                <strong>Note:</strong> This tool helps you understand your reports. 
                Always consult with a healthcare professional for medical advice.
              </AlertDescription>
            </Alert>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UploadReport;