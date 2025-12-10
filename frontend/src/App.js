   import React, { useState } from 'react';
   import './App.css';
   import UploadReport from './components/UploadReport';
   import ManualEntry from './components/ManualEntry';
   import ResultsDisplay from './components/ResultsDisplay';
   import HistoryGraph from './components/HistoryGraph';

   function App() {
     const [currentView, setCurrentView] = useState('upload'); // 'upload', 'manual', 'results'
     const [reportData, setReportData] = useState(null);

     const handleUploadSuccess = (data) => {
       console.log('Upload successful:', data);
       setReportData({
         reportId: data.reportId,
         cbcData: data.extractedData,
         filename: data.filename
       });
       setCurrentView('results');
     };

     const handleManualSubmit = (data) => {
       console.log('Manual entry submitted:', data);
       setReportData({
         reportId: data.reportId,
         cbcData: data.cbcData
       });
       setCurrentView('results');
     };

     const handleBack = () => {
       setCurrentView('upload');
       setReportData(null);
     };

     return (
       <div className="App">
         <header>
           <h1>Health Monitoring Hub</h1>
           <p>Analyze your CBC reports with AI-powered insights</p>
         </header>
         <nav className="main-nav">
           <button 
             onClick={() => setCurrentView('upload')}
             className={currentView === 'upload' ? 'active' : ''}
           >
             Upload Report
           </button>
           <button 
             onClick={() => setCurrentView('manual')}
             className={currentView === 'manual' ? 'active' : ''}
           >
             Manual Entry
           </button>
           <button 
             onClick={() => setCurrentView('history')}
             className={currentView === 'history' ? 'active' : ''}
           >
             History & Trends
           </button>
         </nav>
         <main>
           {currentView === 'upload' && (
             <UploadReport onUploadSuccess={handleUploadSuccess} />
           )}
           {currentView === 'manual' && (
             <ManualEntry onDataSubmit={handleManualSubmit} />
           )}
           {currentView === 'results' && reportData && (
             <ResultsDisplay 
               reportId={reportData.reportId}
               cbcData={reportData.cbcData}
               onBack={handleBack}
             />
           )}
           {currentView === 'history' && (
             <HistoryGraph />
           )}
         </main>
       </div>
     );
   }

   export default App;