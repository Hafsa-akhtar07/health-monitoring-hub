   import React from 'react';
   import './App.css';
   import UploadReport from './components/UploadReport';

   function App() {
     const handleUploadSuccess = (data) => {
       console.log('Upload successful:', data);
       // TODO: Navigate to results page
     };

     return (
       <div className="App">
         <header>
           <h1>Health Monitoring Hub</h1>
           <p>Analyze your CBC reports with AI-powered insights</p>
         </header>
         <main>
           <UploadReport onUploadSuccess={handleUploadSuccess} />
         </main>
       </div>
     );
   }

   export default App;