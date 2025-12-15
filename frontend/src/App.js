import React, { useState, useEffect } from 'react';
import './App.css';
import UploadReport from './components/UploadReport';
import ResultsDisplay from './components/ResultsDisplay';
import HistoryGraph from './components/HistoryGraph';
import Dashboard from './components/Dashboard';
import Login from './components/Login';
import Signup from './components/Signup';
import LandingPage from './components/LandingPage';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentView, setCurrentView] = useState('landing');
  const [authView, setAuthView] = useState('login');
  const [reportData, setReportData] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [previousViewBeforeResults, setPreviousViewBeforeResults] = useState(null);
  const [uploadState, setUploadState] = useState(null); // persist upload/manual inputs

  useEffect(() => {
    // Don't auto-authenticate on mount - always show landing page first
    // User can login if they want to continue their session
    const savedUser = localStorage.getItem('hmh_user');
    if (savedUser) {
      try {
        const userData = JSON.parse(savedUser);
        setUser(userData);
        // Don't set isAuthenticated - let user see landing page first
      } catch (e) {
        console.error('Error parsing saved user:', e);
        localStorage.removeItem('hmh_user');
      }
    }
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
    setIsAuthenticated(true);
    localStorage.setItem('hmh_user', JSON.stringify(userData));
    setCurrentView('dashboard');
    setAuthView('login');
  };

  const handleSignup = (userData) => {
    setUser(userData);
    setIsAuthenticated(true);
    localStorage.setItem('hmh_user', JSON.stringify(userData));
    setCurrentView('dashboard');
  };

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  const confirmLogout = () => {
    setShowLogoutConfirm(false);
    setUser(null);
    setIsAuthenticated(false);
    setReportData(null);
    localStorage.removeItem('hmh_user');
    setCurrentView('landing');
    setAuthView('login');
  };

  const cancelLogout = () => {
    setShowLogoutConfirm(false);
  };

  const handleGetStarted = () => {
    // Always show login page when clicking "Start Free Trial"
    // Don't auto-login - let user explicitly login
    setAuthView('login');
    setCurrentView('login');
  };

  const handleUploadSuccess = (data) => {
    try {
      console.log('Upload successful - received data:', data);
      console.log('Extracted CBC Data:', data.extractedData);
      
      if (!data || !data.extractedData) {
        console.error('No extracted data received!', data);
        alert('No data extracted. Please try again or use manual entry.');
        return;
      }
      
      const reportDataToSet = {
        reportId: data.reportId || Date.now().toString(),
        cbcData: data.extractedData,
        filename: data.filename || 'uploaded_file'
      };
      
      console.log('Setting report data:', reportDataToSet);
      setReportData(reportDataToSet);
      
      // Remember where we came from so Back can return there
      setPreviousViewBeforeResults(currentView);
      setTimeout(() => {
        setCurrentView('results');
      }, 100);
    } catch (error) {
      console.error('Error in handleUploadSuccess:', error);
      alert('An error occurred. Please try again.');
    }
  };

  const handleManualSubmit = (data) => {
    try {
      console.log('Manual entry submitted:', data);
      
      if (!data || !data.cbcData) {
        console.error('No CBC data in manual submit!', data);
        alert('No data submitted. Please fill in the required fields.');
        return;
      }
      
      const reportDataToSet = {
        reportId: data.reportId || Date.now().toString(),
        cbcData: data.cbcData
      };
      
      console.log('Setting report data:', reportDataToSet);
      setReportData(reportDataToSet);
      
      // Remember where we came from so Back can return there
      setPreviousViewBeforeResults(currentView);
      setTimeout(() => {
        setCurrentView('results');
      }, 100);
    } catch (error) {
      console.error('Error in handleManualSubmit:', error);
      alert('An error occurred. Please try again.');
    }
  };

  const handleBack = () => {
    // Return to where user came from (upload or manual), keep data
    if (previousViewBeforeResults) {
      setCurrentView(previousViewBeforeResults);
    } else {
      setCurrentView('dashboard');
    }
  };

  const handleUploadStateChange = (state) => {
    setUploadState(state);
  };

  const handleNavigate = (view) => {
    setCurrentView(view);
  };

  // Show landing/login/signup if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="App">
        {currentView === 'landing' && (
          <LandingPage onGetStarted={handleGetStarted} />
        )}
        {currentView === 'login' && authView === 'login' && (
          <Login 
            onLoginSuccess={handleLogin}
            onSwitchToSignup={() => {
              setAuthView('signup');
              setCurrentView('signup');
            }}
            onBackToLanding={() => {
              setCurrentView('landing');
            }}
          />
        )}
        {(currentView === 'signup' || authView === 'signup') && (
          <Signup 
            onSignupSuccess={handleSignup}
            onSwitchToLogin={() => {
              setAuthView('login');
              setCurrentView('login');
            }}
            onBackToLanding={() => {
              setCurrentView('landing');
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="App">
      <div className="flex flex-col min-h-screen">
        {/* Header - Always visible on all pages - Higher z-index than sidebar */}
        <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-[60]">
          <div className="flex items-center justify-between px-4 md:px-6 py-4">
            <div className="flex items-center gap-4">
              {/* Hamburger Menu Button - Always visible to toggle sidebar */}
              <button
                className="p-3 rounded-lg hover:bg-gray-100 transition-colors border border-gray-200"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                aria-label="Toggle sidebar"
                title={sidebarOpen ? "Close menu" : "Open menu"}
              >
                {sidebarOpen ? (
                  <i className="fas fa-times text-2xl text-[#8B0000]"></i>
                ) : (
                  <i className="fas fa-bars text-2xl text-[#8B0000]"></i>
                )}
              </button>
              {/* Logo and Title */}
              <div className="flex items-center gap-3">
                <i className="fas fa-heartbeat text-2xl text-[#8B0000]"></i>
                <h1 className="text-xl font-bold text-[#8B0000]">Health Monitoring Hub</h1>
              </div>
            </div>
            {/* User Info */}
            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <div className="font-medium text-gray-900">{user?.name || 'User'}</div>
                <div className="text-xs text-gray-500">Last: {new Date().toLocaleDateString()}</div>
              </div>
              <button 
                className="px-4 py-2 rounded-lg flex items-center gap-2 text-red-600 hover:bg-red-50 transition-all"
                onClick={handleLogout}
              >
                <i className="fas fa-sign-out-alt"></i>
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </header>

        <div className="flex flex-1 relative">
          {/* Sidebar Overlay for Mobile */}
          {sidebarOpen && (
            <div 
              className="fixed inset-0 bg-black bg-opacity-50 z-[50] md:hidden"
              onClick={() => setSidebarOpen(false)}
            ></div>
          )}

          {/* Sidebar - Hidden by default, shown when hamburger is clicked */}
          <aside className={`${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          } fixed md:fixed inset-y-0 left-0 z-[50] w-64 transition-transform duration-300 bg-white border-r border-gray-200 shadow-lg flex flex-col`}>
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <i className="fas fa-heartbeat text-2xl text-[#8B0000]"></i>
                  <h2 className="text-lg font-bold text-[#8B0000]">Menu</h2>
                </div>
                <button 
                  className="md:hidden p-2 rounded-lg hover:bg-gray-100"
                  onClick={() => setSidebarOpen(false)}
                >
                  <i className="fas fa-times text-gray-600"></i>
                </button>
              </div>
            </div>
            <nav className="flex-1 p-4 overflow-y-auto">
              {[
                { id: 'dashboard', label: 'Dashboard', icon: 'fas fa-chart-line' },
                { id: 'upload', label: 'Upload Report', icon: 'fas fa-upload' },
                { id: 'manual', label: 'Manual Entry', icon: 'fas fa-edit' },
                { id: 'history', label: 'History & Trends', icon: 'fas fa-chart-bar' }
              ].map(item => (
                <button
                  key={item.id}
                  className={`w-full px-4 py-3 mb-2 rounded-lg flex items-center gap-3 transition-all ${
                    currentView === item.id
                      ? 'bg-[#FFE4E1] text-[#8B0000] font-semibold border-l-4 border-[#8B0000]' 
                      : 'text-gray-700 hover:bg-gray-50 hover:text-[#8B0000]'
                  }`}
                  onClick={() => {
                    if (item.id === 'manual') {
                      setCurrentView('manual');
                    } else {
                      handleNavigate(item.id);
                    }
                    // Close sidebar on mobile after navigation
                    if (window.innerWidth < 768) {
                      setSidebarOpen(false);
                    }
                  }}
                >
                  <i className={`${item.icon} w-5`}></i>
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>
            <div className="p-4 border-t border-gray-200">
              <div className="px-4 py-2 mb-2 text-sm text-gray-600">
                <div className="font-medium">{user?.name || 'User'}</div>
                <div className="text-xs text-gray-500">Last: {new Date().toLocaleDateString()}</div>
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 overflow-y-auto min-h-screen bg-gradient-to-br from-white via-[#fff8f8] to-[#FFE4E1]">
          {currentView === 'dashboard' && (
            <Dashboard onNavigate={handleNavigate} />
          )}
          {currentView === 'upload' && (
            <UploadReport 
              onUploadSuccess={handleUploadSuccess} 
              onBack={() => handleNavigate('dashboard')}
              initialState={uploadState}
              onStateChange={handleUploadStateChange}
              initialMode={currentView === 'upload' && window.location.hash === '#manual' ? 'manual' : undefined}
            />
          )}
          {currentView === 'manual' && (
            <UploadReport 
              onUploadSuccess={handleUploadSuccess} 
              onBack={() => handleNavigate('dashboard')}
              initialState={uploadState}
              onStateChange={handleUploadStateChange}
              initialMode="manual"
            />
          )}
          {currentView === 'results' && (
            reportData ? (
              <ResultsDisplay 
                reportId={reportData.reportId}
                cbcData={reportData.cbcData}
                onBack={handleBack}
              />
            ) : (
              <div className="upload-container">
                <div className="error-message">
                  No report data available. Please upload a file or enter values manually.
                </div>
                <button onClick={() => setCurrentView('upload')} className="btn-primary" style={{ marginTop: '1rem' }}>
                  Upload Report
                </button>
                <button onClick={() => setCurrentView('manual')} className="btn-secondary" style={{ marginTop: '1rem', marginLeft: '1rem' }}>
                  Manual Entry
                </button>
              </div>
            )
          )}
          {currentView === 'history' && (
            <HistoryGraph onNavigate={handleNavigate} />
          )}
          </main>
        </div>
      </div>

      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full border border-gray-200">
            <div className="p-6">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
                  <i className="fas fa-sign-out-alt text-red-600"></i>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Logout?</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    You will be signed out and your session data will be cleared from this device.
                  </p>
                </div>
              </div>

              <div className="mt-6 flex flex-col sm:flex-row justify-end gap-3">
                <button
                  onClick={cancelLogout}
                  className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmLogout}
                  className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition shadow-sm"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
