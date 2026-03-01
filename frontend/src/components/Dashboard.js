import React from 'react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';

const Dashboard = ({ onNavigate }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-[#fff8f8] to-[#FFE4E1] p-6 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Welcome Header */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-[#8B0000] mb-2">
            Welcome to Your Health Dashboard
          </h1>
          <p className="text-lg text-gray-600">
            Upload your CBC report or enter values manually to get started.
          </p>
        </div>

        {/* Upload and Manual Entry Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Upload Report Card */}
          <Card className="shadow-xl shadow-[#DC143C]/20 border-2 border-[#8B0000]/20 hover:border-[#8B0000]/40 transition-all">
            <CardContent className="p-8 text-center">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#8B0000] to-[#B22222] flex items-center justify-center mx-auto mb-6">
                <i className="fas fa-cloud-upload-alt text-3xl text-white"></i>
              </div>
              <h2 className="text-2xl font-bold text-[#8B0000] mb-3">
                Upload Report
              </h2>
              <p className="text-gray-600 mb-6">
                Upload an image or PDF of your CBC report. Our OCR technology will extract all values automatically.
              </p>
              <Button 
                size="lg" 
                onClick={() => onNavigate('upload')}
                className="bg-[#8B0000] hover:bg-[#B22222] text-white shadow-lg shadow-[#8B0000]/30 w-full"
              >
                <i className="fas fa-cloud-upload-alt mr-2"></i>
                Upload Report
              </Button>
            </CardContent>
          </Card>

          {/* Manual Entry Card */}
          <Card className="shadow-xl shadow-[#DC143C]/20 border-2 border-[#8B0000]/20 hover:border-[#8B0000]/40 transition-all">
            <CardContent className="p-8 text-center">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#8B0000] to-[#B22222] flex items-center justify-center mx-auto mb-6">
                <i className="fas fa-keyboard text-3xl text-white"></i>
              </div>
              <h2 className="text-2xl font-bold text-[#8B0000] mb-3">
                Manual Entry
              </h2>
              <p className="text-gray-600 mb-6">
                Enter your CBC values manually if OCR extraction fails or you prefer to type them in.
              </p>
              <Button 
                variant="outline" 
                size="lg"
                onClick={() => onNavigate('manual')}
                className="border-[#8B0000] text-[#8B0000] hover:bg-[#FFE4E1] w-full"
              >
                <i className="fas fa-edit mr-2"></i>
                Enter Manually
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
