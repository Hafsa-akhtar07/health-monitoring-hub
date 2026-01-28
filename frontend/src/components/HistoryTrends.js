import React, { useState } from 'react';
import { 
  LineChart, Line, BarChart, Bar, AreaChart, Area, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ScatterChart, Scatter, ComposedChart
} from 'recharts';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';

const HistoryTrends = ({ onBack, onNavigate }) => {
  const [timeRange, setTimeRange] = useState('6m');
  const [selectedParameter, setSelectedParameter] = useState('all');

  // Sample Data Tables - Based on your project documents
  const reportsData = [
    { id: 1, date: '2024-03-15', type: 'CBC', fileName: 'CBC_Mar_2024.pdf', status: 'Normal', hemoglobin: 14.2, wbc: 7.2, platelets: 250, rbc: 4.8, notes: 'All values within normal range' },
    { id: 2, date: '2024-02-10', type: 'Lipid', fileName: 'Lipid_Feb_2024.pdf', status: 'Mild', hemoglobin: 13.8, wbc: 6.8, platelets: 265, rbc: 4.7, notes: 'Slightly elevated cholesterol' },
    { id: 3, date: '2024-01-05', type: 'CBC', fileName: 'CBC_Jan_2024.pdf', status: 'Normal', hemoglobin: 14.5, wbc: 7.5, platelets: 240, rbc: 4.9, notes: 'Good recovery from previous' },
    { id: 4, date: '2023-12-12', type: 'CBC', fileName: 'CBC_Dec_2023.pdf', status: 'Critical', hemoglobin: 11.2, wbc: 8.9, platelets: 180, rbc: 3.8, notes: 'Anemia detected, low hemoglobin' },
    { id: 5, date: '2023-11-08', type: 'CBC', fileName: 'CBC_Nov_2023.pdf', status: 'Mild', hemoglobin: 12.8, wbc: 7.1, platelets: 210, rbc: 4.2, notes: 'Slight improvement needed' },
    { id: 6, date: '2023-10-15', type: 'Liver', fileName: 'Liver_Oct_2023.pdf', status: 'Normal', hemoglobin: 13.5, wbc: 6.9, platelets: 220, rbc: 4.5, notes: 'Liver function normal' },
    { id: 7, date: '2023-09-20', type: 'CBC', fileName: 'CBC_Sep_2023.pdf', status: 'Mild', hemoglobin: 12.5, wbc: 7.8, platelets: 195, rbc: 4.0, notes: 'Monitor platelet count' },
    { id: 8, date: '2023-08-25', type: 'CBC', fileName: 'CBC_Aug_2023.pdf', status: 'Normal', hemoglobin: 14.0, wbc: 6.5, platelets: 255, rbc: 4.6, notes: 'All parameters normal' },
    { id: 9, date: '2023-07-30', type: 'CBC', fileName: 'CBC_Jul_2023.pdf', status: 'Critical', hemoglobin: 10.8, wbc: 9.2, platelets: 160, rbc: 3.5, notes: 'Severe anemia, iron deficiency' },
    { id: 10, date: '2023-06-18', type: 'CBC', fileName: 'CBC_Jun_2023.pdf', status: 'Mild', hemoglobin: 13.0, wbc: 7.0, platelets: 230, rbc: 4.3, notes: 'Borderline hemoglobin' }
  ];

  // Detailed Time Series Data for Graphs
  const detailedTimeSeries = [
    { date: 'Jan 2023', hemoglobin: 14.0, wbc: 6.5, platelets: 255, rbc: 4.6, hematocrit: 42, mcv: 88, mch: 30, mchc: 34, lymphocytes: 2.1, neutrophils: 4.0, monocytes: 0.5 },
    { date: 'Feb 2023', hemoglobin: 13.8, wbc: 6.8, platelets: 265, rbc: 4.7, hematocrit: 41, mcv: 87, mch: 29, mchc: 33, lymphocytes: 2.2, neutrophils: 4.1, monocytes: 0.5 },
    { date: 'Mar 2023', hemoglobin: 14.2, wbc: 7.2, platelets: 250, rbc: 4.8, hematocrit: 43, mcv: 89, mch: 31, mchc: 34, lymphocytes: 2.3, neutrophils: 4.2, monocytes: 0.6 },
    { date: 'Apr 2023', hemoglobin: 13.9, wbc: 7.1, platelets: 255, rbc: 4.7, hematocrit: 42, mcv: 88, mch: 30, mchc: 34, lymphocytes: 2.2, neutrophils: 4.1, monocytes: 0.6 },
    { date: 'May 2023', hemoglobin: 14.8, wbc: 6.9, platelets: 270, rbc: 5.0, hematocrit: 45, mcv: 90, mch: 32, mchc: 35, lymphocytes: 2.1, neutrophils: 4.0, monocytes: 0.5 },
    { date: 'Jun 2023', hemoglobin: 13.0, wbc: 7.0, platelets: 230, rbc: 4.3, hematocrit: 40, mcv: 85, mch: 28, mchc: 32, lymphocytes: 2.4, neutrophils: 4.0, monocytes: 0.6 },
    { date: 'Jul 2023', hemoglobin: 10.8, wbc: 9.2, platelets: 160, rbc: 3.5, hematocrit: 35, mcv: 80, mch: 26, mchc: 31, lymphocytes: 3.0, neutrophils: 5.5, monocytes: 0.7 },
    { date: 'Aug 2023', hemoglobin: 14.0, wbc: 6.5, platelets: 255, rbc: 4.6, hematocrit: 42, mcv: 88, mch: 30, mchc: 34, lymphocytes: 2.1, neutrophils: 4.0, monocytes: 0.5 },
    { date: 'Sep 2023', hemoglobin: 12.5, wbc: 7.8, platelets: 195, rbc: 4.0, hematocrit: 38, mcv: 82, mch: 27, mchc: 32, lymphocytes: 2.8, neutrophils: 4.3, monocytes: 0.7 },
    { date: 'Oct 2023', hemoglobin: 13.5, wbc: 6.9, platelets: 220, rbc: 4.5, hematocrit: 41, mcv: 86, mch: 29, mchc: 33, lymphocytes: 2.2, neutrophils: 4.0, monocytes: 0.6 },
    { date: 'Nov 2023', hemoglobin: 12.8, wbc: 7.1, platelets: 210, rbc: 4.2, hematocrit: 39, mcv: 84, mch: 28, mchc: 32, lymphocytes: 2.4, neutrophils: 4.1, monocytes: 0.6 },
    { date: 'Dec 2023', hemoglobin: 11.2, wbc: 8.9, platelets: 180, rbc: 3.8, hematocrit: 36, mcv: 81, mch: 27, mchc: 31, lymphocytes: 3.2, neutrophils: 5.0, monocytes: 0.7 },
    { date: 'Jan 2024', hemoglobin: 14.5, wbc: 7.5, platelets: 240, rbc: 4.9, hematocrit: 44, mcv: 89, mch: 31, mchc: 34, lymphocytes: 2.4, neutrophils: 4.5, monocytes: 0.6 },
    { date: 'Feb 2024', hemoglobin: 13.8, wbc: 6.8, platelets: 265, rbc: 4.7, hematocrit: 41, mcv: 87, mch: 29, mchc: 33, lymphocytes: 2.2, neutrophils: 4.1, monocytes: 0.5 },
    { date: 'Mar 2024', hemoglobin: 14.2, wbc: 7.2, platelets: 250, rbc: 4.8, hematocrit: 43, mcv: 89, mch: 31, mchc: 34, lymphocytes: 2.3, neutrophils: 4.2, monocytes: 0.6 }
  ];

  // Monthly Average Data
  const monthlyAverages = [
    { month: 'Jan', hemoglobin: 14.3, wbc: 7.0, platelets: 248, abnormalities: 2 },
    { month: 'Feb', hemoglobin: 13.8, wbc: 6.8, platelets: 265, abnormalities: 1 },
    { month: 'Mar', hemoglobin: 14.2, wbc: 7.2, platelets: 250, abnormalities: 0 },
    { month: 'Apr', hemoglobin: 13.9, wbc: 7.1, platelets: 255, abnormalities: 0 },
    { month: 'May', hemoglobin: 14.8, wbc: 6.9, platelets: 270, abnormalities: 0 },
    { month: 'Jun', hemoglobin: 13.0, wbc: 7.0, platelets: 230, abnormalities: 1 },
    { month: 'Jul', hemoglobin: 10.8, wbc: 9.2, platelets: 160, abnormalities: 3 },
    { month: 'Aug', hemoglobin: 14.0, wbc: 6.5, platelets: 255, abnormalities: 0 },
    { month: 'Sep', hemoglobin: 12.5, wbc: 7.8, platelets: 195, abnormalities: 2 },
    { month: 'Oct', hemoglobin: 13.5, wbc: 6.9, platelets: 220, abnormalities: 1 },
    { month: 'Nov', hemoglobin: 12.8, wbc: 7.1, platelets: 210, abnormalities: 1 },
    { month: 'Dec', hemoglobin: 11.2, wbc: 8.9, platelets: 180, abnormalities: 3 }
  ];

  // Parameter Comparison Data
  const parameterCorrelation = [
    { hemoglobin: 11.2, platelets: 180, rbc: 3.8, status: 'Critical' },
    { hemoglobin: 12.5, platelets: 195, rbc: 4.0, status: 'Mild' },
    { hemoglobin: 12.8, platelets: 210, rbc: 4.2, status: 'Mild' },
    { hemoglobin: 13.0, platelets: 230, rbc: 4.3, status: 'Mild' },
    { hemoglobin: 13.5, platelets: 220, rbc: 4.5, status: 'Normal' },
    { hemoglobin: 13.8, platelets: 265, rbc: 4.7, status: 'Normal' },
    { hemoglobin: 13.9, platelets: 255, rbc: 4.7, status: 'Normal' },
    { hemoglobin: 14.0, platelets: 255, rbc: 4.6, status: 'Normal' },
    { hemoglobin: 14.2, platelets: 250, rbc: 4.8, status: 'Normal' },
    { hemoglobin: 14.5, platelets: 240, rbc: 4.9, status: 'Normal' },
    { hemoglobin: 14.8, platelets: 270, rbc: 5.0, status: 'Normal' }
  ];

  // Filter data based on time range
  const filteredData = detailedTimeSeries.slice(-getDataPoints());

  function getDataPoints() {
    switch(timeRange) {
      case '3m': return 3;
      case '6m': return 6;
      case '1y': return 12;
      case 'all': return detailedTimeSeries.length;
      default: return 6;
    }
  }

  const getStatusColor = (status) => {
    switch(status) {
      case 'Normal': return 'bg-green-100 text-green-800 border-green-200';
      case 'Mild': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'Critical': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status) => {
    switch(status) {
      case 'Normal': return 'fas fa-check-circle';
      case 'Mild': return 'fas fa-exclamation-triangle';
      case 'Critical': return 'fas fa-times-circle';
      default: return 'fas fa-question-circle';
    }
  };

  // Function to export data
  const handleExportData = () => {
    alert('Data export would be triggered here (CSV/PDF format)');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-[#fff8f8] to-[#FFE4E1] p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
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
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-[#8B0000] mb-2">
                Health History & Trends
              </h1>
              <p className="text-gray-600">
                Track your CBC parameters over time and identify patterns in your health journey
              </p>
            </div>
            <Button 
              onClick={handleExportData}
              variant="outline"
              className="border-[#8B0000] text-[#8B0000] hover:bg-[#FFE4E1]"
            >
              <i className="fas fa-download mr-2"></i>
              Export Data
            </Button>
          </div>

          {/* Time Range Selector */}
          <div className="flex flex-wrap gap-2 mb-6">
            {[
              { id: '3m', label: 'Last 3 Months' },
              { id: '6m', label: 'Last 6 Months' },
              { id: '1y', label: 'Last Year' },
              { id: 'all', label: 'All Time' }
            ].map(range => (
              <Button
                key={range.id}
                variant={timeRange === range.id ? 'default' : 'outline'}
                onClick={() => setTimeRange(range.id)}
                className={timeRange === range.id ? 'bg-[#8B0000] hover:bg-[#B22222]' : ''}
              >
                {range.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Left Column - Key Metrics */}
          <div className="space-y-6">
            {/* Overall Health Score */}
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <i className="fas fa-heartbeat text-[#8B0000]"></i>
                  Overall Health Score
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <div className="text-5xl font-bold text-[#8B0000] mb-2">82/100</div>
                  <div className="w-full h-4 bg-gray-200 rounded-full overflow-hidden mb-3">
                    <div className="h-full bg-gradient-to-r from-green-400 via-[#8B0000] to-[#B22222]" style={{ width: '82%' }}></div>
                  </div>
                  <p className="text-sm text-gray-600">
                    Based on {reportsData.length} reports over 15 months
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Key Statistics */}
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <i className="fas fa-chart-bar text-[#8B0000]"></i>
                  Key Statistics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { label: 'Total Reports', value: reportsData.length, icon: 'fa-file-medical', color: 'text-blue-500' },
                  { label: 'Average Hemoglobin', value: '13.8 g/dL', icon: 'fa-tint', color: 'text-red-500' },
                  { label: 'Normal Reports', value: '60%', icon: 'fa-check-circle', color: 'text-green-500' },
                  { label: 'Improvement Trend', value: '+15%', icon: 'fa-chart-line', color: 'text-[#8B0000]' }
                ].map((stat, index) => (
                  <div key={index} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors">
                    <div className="flex items-center gap-3">
                      <i className={`fas ${stat.icon} ${stat.color} text-lg`}></i>
                      <span className="font-medium">{stat.label}</span>
                    </div>
                    <span className="font-bold text-gray-900">{stat.value}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Middle Column - Main Chart */}
          <div className="lg:col-span-2">
            <Card className="shadow-lg h-full">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <i className="fas fa-chart-line text-[#8B0000]"></i>
                    Comprehensive Health Trends
                  </CardTitle>
                  <CardDescription>
                    Interactive visualization of all CBC parameters over time
                  </CardDescription>
                </div>
                <select 
                  value={selectedParameter}
                  onChange={(e) => setSelectedParameter(e.target.value)}
                  className="px-3 py-1.5 border border-gray-300 rounded-md text-sm bg-white focus:ring-2 focus:ring-[#8B0000] focus:border-transparent"
                >
                  <option value="all">All Parameters</option>
                  <option value="hemoglobin">Hemoglobin</option>
                  <option value="wbc">White Blood Cells</option>
                  <option value="platelets">Platelets</option>
                  <option value="rbc">Red Blood Cells</option>
                </select>
              </CardHeader>
              <CardContent>
                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={filteredData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis 
                        dataKey="date" 
                        stroke="#666" 
                        angle={-45}
                        textAnchor="end"
                        height={60}
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis 
                        stroke="#666"
                        tick={{ fontSize: 12 }}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'white', 
                          border: '1px solid #E5E7EB',
                          borderRadius: '8px',
                          boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                        }}
                      />
                      <Legend />
                      <Area 
                        type="monotone" 
                        dataKey="hemoglobin" 
                        fill="#ffcccc" 
                        stroke="#8B0000" 
                        strokeWidth={2}
                        fillOpacity={0.3}
                        name="Hemoglobin (g/dL)"
                      />
                      <Line 
                        type="monotone" 
                        dataKey="wbc" 
                        stroke="#3B82F6" 
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        name="WBC (×10³/µL)"
                      />
                      <Bar 
                        dataKey="platelets" 
                        fill="#10B981" 
                        fillOpacity={0.6}
                        name="Platelets (×10³/µL)"
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Tabbed Interface */}
        <Tabs defaultValue="table" className="mb-8">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="table">
              <i className="fas fa-table mr-2"></i>
              Data Table
            </TabsTrigger>
            <TabsTrigger value="charts">
              <i className="fas fa-chart-pie mr-2"></i>
              Detailed Charts
            </TabsTrigger>
            <TabsTrigger value="insights">
              <i className="fas fa-lightbulb mr-2"></i>
              AI Insights
            </TabsTrigger>
          </TabsList>

          {/* Data Table Tab */}
          <TabsContent value="table">
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle>Complete Report History</CardTitle>
                <CardDescription>
                  All your CBC reports with detailed parameters
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Date</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Type</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Hemoglobin</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">WBC</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Platelets</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {reportsData.map(report => (
                        <tr key={report.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 text-sm text-gray-900">{report.date}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{report.type}</td>
                          <td className="px-4 py-3 text-sm">
                            <span className={`font-semibold ${
                              report.hemoglobin < 13.5 ? 'text-blue-600' : 
                              report.hemoglobin > 17.5 ? 'text-red-600' : 
                              'text-green-600'
                            }`}>
                              {report.hemoglobin} g/dL
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <span className={`font-semibold ${
                              report.wbc < 4.5 ? 'text-blue-600' : 
                              report.wbc > 11.0 ? 'text-red-600' : 
                              'text-green-600'
                            }`}>
                              {report.wbc} ×10³/µL
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <span className={`font-semibold ${
                              report.platelets < 150 ? 'text-blue-600' : 
                              report.platelets > 450 ? 'text-red-600' : 
                              'text-green-600'
                            }`}>
                              {report.platelets} ×10³/µL
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${getStatusColor(report.status)}`}>
                              <i className={`${getStatusIcon(report.status)} mr-1`}></i>
                              {report.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 max-w-xs">{report.notes}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Detailed Charts Tab */}
          <TabsContent value="charts">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Monthly Averages Bar Chart */}
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <i className="fas fa-chart-bar text-[#8B0000]"></i>
                    Monthly Averages
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={monthlyAverages}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                        <XAxis dataKey="month" stroke="#666" />
                        <YAxis stroke="#666" />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="hemoglobin" fill="#8B0000" name="Hemoglobin" />
                        <Bar dataKey="abnormalities" fill="#EF4444" name="Abnormalities" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Parameter Correlation Scatter Plot */}
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <i className="fas fa-project-diagram text-[#8B0000]"></i>
                    Parameter Correlation
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                        <XAxis 
                          type="number" 
                          dataKey="hemoglobin" 
                          name="Hemoglobin"
                          unit="g/dL"
                          stroke="#666"
                        />
                        <YAxis 
                          type="number" 
                          dataKey="platelets" 
                          name="Platelets"
                          unit="×10³/µL"
                          stroke="#666"
                        />
                        <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                        <Legend />
                        <Scatter 
                          name="Normal" 
                          data={parameterCorrelation.filter(d => d.status === 'Normal')} 
                          fill="#10B981"
                        />
                        <Scatter 
                          name="Mild" 
                          data={parameterCorrelation.filter(d => d.status === 'Mild')} 
                          fill="#F59E0B"
                        />
                        <Scatter 
                          name="Critical" 
                          data={parameterCorrelation.filter(d => d.status === 'Critical')} 
                          fill="#EF4444"
                        />
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* WBC Differential Chart */}
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <i className="fas fa-microscope text-[#8B0000]"></i>
                    WBC Differential
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={detailedTimeSeries.slice(-6)}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                        <XAxis dataKey="date" stroke="#666" />
                        <YAxis stroke="#666" />
                        <Tooltip />
                        <Legend />
                        <Area 
                          type="monotone" 
                          dataKey="lymphocytes" 
                          stackId="1"
                          stroke="#3B82F6" 
                          fill="#3B82F6" 
                          name="Lymphocytes"
                        />
                        <Area 
                          type="monotone" 
                          dataKey="neutrophils" 
                          stackId="1"
                          stroke="#10B981" 
                          fill="#10B981" 
                          name="Neutrophils"
                        />
                        <Area 
                          type="monotone" 
                          dataKey="monocytes" 
                          stackId="1"
                          stroke="#8B5CF6" 
                          fill="#8B5CF6" 
                          name="Monocytes"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* RBC Indices Chart */}
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <i className="fas fa-circle text-[#8B0000]"></i>
                    RBC Indices Trends
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={detailedTimeSeries.slice(-8)}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                        <XAxis dataKey="date" stroke="#666" />
                        <YAxis stroke="#666" />
                        <Tooltip />
                        <Legend />
                        <Line 
                          type="monotone" 
                          dataKey="mcv" 
                          stroke="#8B0000" 
                          strokeWidth={2}
                          dot={{ r: 4 }}
                          name="MCV (fL)"
                        />
                        <Line 
                          type="monotone" 
                          dataKey="mch" 
                          stroke="#3B82F6" 
                          strokeWidth={2}
                          dot={{ r: 4 }}
                          name="MCH (pg)"
                        />
                        <Line 
                          type="monotone" 
                          dataKey="mchc" 
                          stroke="#10B981" 
                          strokeWidth={2}
                          dot={{ r: 4 }}
                          name="MCHC (g/dL)"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* AI Insights Tab */}
          <TabsContent value="insights">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* AI Analysis */}
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <i className="fas fa-brain text-[#8B0000]"></i>
                    AI Health Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {[
                    {
                      title: 'Improvement Detected',
                      description: 'Hemoglobin levels have improved by 25% over the last 6 months',
                      icon: 'fa-arrow-up',
                      color: 'text-green-600 bg-green-50'
                    },
                    {
                      title: 'Stable Pattern',
                      description: 'Platelet counts remain stable within normal range',
                      icon: 'fa-check',
                      color: 'text-blue-600 bg-blue-50'
                    },
                    {
                      title: 'Watch List',
                      description: 'Monitor WBC levels which show seasonal variations',
                      icon: 'fa-eye',
                      color: 'text-yellow-600 bg-yellow-50'
                    },
                    {
                      title: 'Correlation Found',
                      description: 'Hemoglobin and RBC counts show strong positive correlation',
                      icon: 'fa-link',
                      color: 'text-purple-600 bg-purple-50'
                    }
                  ].map((insight, index) => (
                    <div key={index} className={`p-4 rounded-lg border ${insight.color.split(' ')[1]}`}>
                      <div className="flex items-center gap-3 mb-2">
                        <div className={`w-10 h-10 rounded-full ${insight.color.split(' ')[1]} flex items-center justify-center`}>
                          <i className={`fas ${insight.icon} ${insight.color.split(' ')[0]}`}></i>
                        </div>
                        <h4 className="font-semibold text-gray-900">{insight.title}</h4>
                      </div>
                      <p className="text-sm text-gray-600">{insight.description}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Prediction & Recommendations */}
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <i className="fas fa-chart-line text-[#8B0000]"></i>
                    Predictions & Forecast
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-4 bg-gradient-to-r from-[#fff8f8] to-white rounded-lg border border-[#ffcccc]">
                      <h4 className="font-semibold text-[#8B0000] mb-2">
                        <i className="fas fa-calendar-alt mr-2"></i>
                        3-Month Forecast
                      </h4>
                      <p className="text-sm text-gray-600 mb-3">
                        Based on historical data, here's what to expect:
                      </p>
                      <ul className="space-y-2 text-sm">
                        <li className="flex items-center gap-2">
                          <i className="fas fa-check text-green-600"></i>
                          <span>Hemoglobin: Stable around 14.0-14.5 g/dL</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <i className="fas fa-check text-green-600"></i>
                          <span>WBC: Normal range (6.5-7.5 ×10³/µL)</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <i className="fas fa-exclamation-triangle text-yellow-600"></i>
                          <span>Platelets: Monitor for seasonal variations</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default HistoryTrends;

