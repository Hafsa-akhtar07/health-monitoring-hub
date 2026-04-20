import React from 'react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';

const Dashboard = ({ onNavigate }) => {
  return (
    <div className="min-h-screen p-6 md:p-8 relative overflow-hidden" style={{
      background: 'linear-gradient(180deg, #fff5f5 0%, #ffe0e0 10%, #ffcccc 20%, #ffb3b3 35%, #ff9999 50%, #ff8080 65%, #e06666 80%, #cc4d4d 90%, #b33b3b 100%)',
      backgroundAttachment: 'fixed'
    }}>
      {/* Decorative background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-white/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-white/10 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-white/5 rounded-full blur-2xl"></div>
      </div>

      <div className="max-w-6xl mx-auto relative z-10">
        {/* Welcome Header with enhanced styling */}
        <div className="text-center mb-12 animate-fadeIn">
          <div className="inline-flex items-center justify-center gap-3 mb-4">
            <div className="w-14 h-14 bg-gradient-to-br from-[#8B0000] to-[#B22222] rounded-2xl flex items-center justify-center shadow-xl shadow-red-900/40 transform transition hover:scale-110 duration-300">
              <i className="fas fa-heartbeat text-2xl text-white"></i>
            </div>
            <div className="w-14 h-14 bg-gradient-to-br from-[#B22222] to-[#CD5C5C] rounded-2xl flex items-center justify-center shadow-xl shadow-red-900/40 transform transition hover:scale-110 duration-300">
              <i className="fas fa-chart-line text-2xl text-white"></i>
            </div>
          </div>
          <h1 className="text-5xl md:text-6xl font-bold text-[#2c1212] mb-3" style={{ fontFamily: "'Playfair Display', serif", textShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
            Health Monitoring Hub
          </h1>
          <p className="text-lg md:text-xl text-[#4e2a2a] max-w-2xl mx-auto font-medium">
            Your intelligent CBC companion — Upload reports or enter values manually for instant health insights
          </p>
          <div className="flex justify-center gap-3 mt-4 flex-wrap">
            <span className="bg-white/80 backdrop-blur-sm px-4 py-1.5 rounded-full text-sm font-semibold text-[#8B0000] shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105">
              <i className="fas fa-microchip mr-2"></i>AI-Powered OCR
            </span>
            <span className="bg-white/80 backdrop-blur-sm px-4 py-1.5 rounded-full text-sm font-semibold text-[#8B0000] shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105">
              <i className="fas fa-shield-alt mr-2"></i>Secure & Private
            </span>
            <span className="bg-white/80 backdrop-blur-sm px-4 py-1.5 rounded-full text-sm font-semibold text-[#8B0000] shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105">
              <i className="fas fa-chart-line mr-2"></i>Track Trends
            </span>
          </div>
        </div>

        {/* Upload and Manual Entry Options - Enhanced Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
          {/* Upload Report Card */}
          <Card className="group relative overflow-hidden shadow-2xl hover:shadow-red-900/40 transition-all duration-500 border-0 bg-white/95 backdrop-blur-sm hover:scale-105">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#8B0000] to-[#FF6B6B]"></div>
            <CardContent className="p-8 text-center">
              <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-[#8B0000] to-[#B22222] flex items-center justify-center mx-auto mb-6 shadow-xl transform transition-all duration-500 group-hover:scale-110 group-hover:rotate-3 group-hover:shadow-2xl">
                <i className="fas fa-cloud-upload-alt text-4xl text-white"></i>
              </div>
              <h2 className="text-2xl font-bold text-[#8B0000] mb-3">
                Upload Report
              </h2>
              <p className="text-gray-600 mb-4">
                Upload an image of your CBC report. Our OCR technology will extract all values automatically with high accuracy.
              </p>
              <div className="bg-gray-50 rounded-lg p-3 mb-6 text-left text-sm shadow-inner">
                <div className="flex items-center gap-2 mb-1">
                  <i className="fas fa-check-circle text-[#8B0000] text-xs"></i>
                  <span className="text-gray-600">Supports JPG, PNG</span>
                </div>
                <div className="flex items-center gap-2">
                  <i className="fas fa-robot text-[#8B0000] text-xs"></i>
                  <span className="text-gray-600">Auto-extracts 10+ CBC parameters</span>
                </div>
              </div>
              <Button 
                size="lg" 
                onClick={() => onNavigate('upload')}
                className="bg-gradient-to-r from-[#8B0000] to-[#B22222] hover:from-[#A52A2A] hover:to-[#8B0000] text-white shadow-lg shadow-red-900/50 hover:shadow-red-900/70 w-full transform transition-all duration-300 hover:scale-105 active:scale-95"
              >
                <i className="fas fa-cloud-upload-alt mr-2"></i>
                Upload Report
              </Button>
            </CardContent>
          </Card>

          {/* Manual Entry Card */}
          <Card className="group relative overflow-hidden shadow-2xl hover:shadow-red-900/40 transition-all duration-500 border-0 bg-white/95 backdrop-blur-sm hover:scale-105">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#B22222] to-[#FFA07A]"></div>
            <CardContent className="p-8 text-center">
              <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-[#B22222] to-[#CD5C5C] flex items-center justify-center mx-auto mb-6 shadow-xl transform transition-all duration-500 group-hover:scale-110 group-hover:-rotate-3 group-hover:shadow-2xl">
                <i className="fas fa-keyboard text-4xl text-white"></i>
              </div>
              <h2 className="text-2xl font-bold text-[#8B0000] mb-3">
                Manual Entry
              </h2>
              <p className="text-gray-600 mb-4">
                Enter your CBC values manually if OCR extraction fails or you prefer to type them in directly.
              </p>
              <div className="bg-gray-50 rounded-lg p-3 mb-6 text-left text-sm shadow-inner">
                <div className="flex items-center gap-2 mb-1">
                  <i className="fas fa-sliders-h text-[#8B0000] text-xs"></i>
                  <span className="text-gray-600">Custom range validation</span>
                </div>
                <div className="flex items-center gap-2">
                  <i className="fas fa-save text-[#8B0000] text-xs"></i>
                  <span className="text-gray-600">Save multiple entries over time</span>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="lg"
                onClick={() => onNavigate('manual')}
                className="border-2 border-[#8B0000] text-[#8B0000] hover:bg-[#FFE4E1] hover:border-[#B22222] w-full transform transition-all duration-300 hover:scale-105 active:scale-95 shadow-md hover:shadow-lg"
              >
                <i className="fas fa-edit mr-2"></i>
                Enter Manually
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* How to Use Instructions Box */}
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-2xl p-8 mb-8 border border-[#FFD1CF] hover:shadow-red-900/20 transition-all duration-500">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-[#8B0000] to-[#B22222] rounded-xl flex items-center justify-center shadow-lg transform transition hover:scale-110 duration-300">
              <i className="fas fa-list-check text-2xl text-white"></i>
            </div>
            <h3 className="text-2xl font-bold text-[#8B0000]">How to Use — Quick Guide</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Step 1 */}
            <div className="text-center group/step">
              <div className="w-14 h-14 bg-gradient-to-br from-[#8B0000] to-[#B22222] rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg transform transition-all duration-300 group-hover/step:scale-110 group-hover/step:shadow-xl">
                <span className="text-white font-bold text-xl">1</span>
              </div>
              <h4 className="font-bold text-gray-800 mb-2 group-hover/step:text-[#8B0000] transition-colors">Choose Method</h4>
              <p className="text-sm text-gray-600">Select "Upload Report" or "Manual Entry" based on your preference</p>
            </div>
            
            {/* Step 2 */}
            <div className="text-center group/step">
              <div className="w-14 h-14 bg-gradient-to-br from-[#8B0000] to-[#B22222] rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg transform transition-all duration-300 group-hover/step:scale-110 group-hover/step:shadow-xl">
                <span className="text-white font-bold text-xl">2</span>
              </div>
              <h4 className="font-bold text-gray-800 mb-2 group-hover/step:text-[#8B0000] transition-colors">Upload or Fill</h4>
              <p className="text-sm text-gray-600">Upload your CBC report image or enter values manually</p>
            </div>
            
            {/* Step 3 */}
            <div className="text-center group/step">
              <div className="w-14 h-14 bg-gradient-to-br from-[#8B0000] to-[#B22222] rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg transform transition-all duration-300 group-hover/step:scale-110 group-hover/step:shadow-xl">
                <span className="text-white font-bold text-xl">3</span>
              </div>
              <h4 className="font-bold text-gray-800 mb-2 group-hover/step:text-[#8B0000] transition-colors">Review Data</h4>
              <p className="text-sm text-gray-600">Verify extracted values and make any necessary corrections</p>
            </div>
            
            {/* Step 4 */}
            <div className="text-center group/step">
              <div className="w-14 h-14 bg-gradient-to-br from-[#8B0000] to-[#B22222] rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg transform transition-all duration-300 group-hover/step:scale-110 group-hover/step:shadow-xl">
                <span className="text-white font-bold text-xl">4</span>
              </div>
              <h4 className="font-bold text-gray-800 mb-2 group-hover/step:text-[#8B0000] transition-colors">Get Insights</h4>
              <p className="text-sm text-gray-600">View your analysis, track trends, and monitor your health journey</p>
            </div>
          </div>
          
          <div className="mt-6 bg-gradient-to-r from-[#FFF0EE] to-[#FFE4E1] p-4 rounded-xl shadow-inner">
            <div className="flex items-center gap-3">
              <i className="fas fa-lightbulb text-xl text-[#B22222] animate-pulse"></i>
              <span className="text-sm text-gray-700"><span className="font-semibold text-[#8B0000]">Pro Tip:</span> For best OCR accuracy, use clear, well-lit photos of your CBC report. Supported formats: JPG, PNG.</span>
            </div>
          </div>
        </div>

        

        {/* Testimonial */}
        <div className="bg-white/70 backdrop-blur-sm rounded-xl p-5 border-l-4 border-[#DC143C] shadow-lg hover:shadow-xl transition-all duration-500 hover:scale-[1.02]">
          <div className="flex items-start gap-3">
            <i className="fas fa-quote-left text-2xl text-[#8B0000]"></i>
            <div>
              <p className="text-gray-700 italic">"This dashboard transformed how I monitor my blood work. The OCR is incredibly accurate and the trend tracking helps me stay on top of my health between doctor visits."</p>
              <p className="text-sm font-semibold text-[#8B0000] mt-2">— Sarah Johnson, Verified User</p>
            </div>
          </div>
        </div>
      </div>

      {/* Animation keyframes */}
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-fadeIn {
          animation: fadeIn 0.6s ease-out;
        }
        
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.6;
          }
        }
        
        .animate-pulse {
          animation: pulse 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default Dashboard;