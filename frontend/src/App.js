import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import UploadReport from './components/UploadReport';
import ResultsDisplay from './components/ResultsDisplay';
import HistoryGraph from './components/HistoryGraph';
import Dashboard from './components/Dashboard';
import AdminDashboard from './components/AdminDashboard';
import Login from './components/Login';
import Signup from './components/Signup';
import LandingPage from './components/LandingPage';
import { authAPI } from './utils/api';
import { authStorage } from './utils/authStorage';
import { createSocket } from './utils/socket';

const REPORT_DATA_STORAGE_KEY = 'hmh_last_report_data';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentView, setCurrentView] = useState('landing');
  const [authView, setAuthView] = useState('login');
  const [reportData, setReportData] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [previousViewBeforeResults, setPreviousViewBeforeResults] = useState(null);
  const [uploadState, setUploadState] = useState(null);
  const [realtimeToast, setRealtimeToast] = useState(null);
  const socketRef = useRef(null);
  const isAdmin = user?.role === 'admin';

  const saveReportData = (data) => {
    setReportData(data);
    try {
      if (data) {
        sessionStorage.setItem(REPORT_DATA_STORAGE_KEY, JSON.stringify(data));
      } else {
        sessionStorage.removeItem(REPORT_DATA_STORAGE_KEY);
      }
    } catch (e) {
      console.warn('Unable to persist report data:', e);
    }
  };

  const loadReportData = () => {
    try {
      const raw = sessionStorage.getItem(REPORT_DATA_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.cbcData) return null;
      return parsed;
    } catch (e) {
      console.warn('Unable to restore report data:', e);
      return null;
    }
  };

  // Helper function to get view from URL
  const getViewFromUrl = () => {
    const path = window.location.pathname;
    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get('view');
    
    // Check if we have a view parameter first
    if (viewParam) {
      return viewParam;
    }
    
    // Map paths to views
    if (path === '/') return 'landing';
    if (path === '/login') return 'login';
    if (path === '/signup') return 'signup';
    if (path === '/dashboard') return 'dashboard';
    if (path === '/upload') return 'upload';
    if (path === '/manual-entry') return 'manual';
    if (path === '/results') return 'results';
    if (path === '/history') return 'history';
    if (path === '/admin') return 'admin-dashboard';
    
    return 'landing';
  };

  // Helper function to update URL based on view
  const updateUrl = (view, replace = false) => {
    let path = '/';
    let search = '';
    
    switch(view) {
      case 'landing':
        path = '/';
        break;
      case 'login':
        path = '/login';
        break;
      case 'signup':
        path = '/signup';
        break;
      case 'dashboard':
        path = '/dashboard';
        break;
      case 'upload':
        path = '/upload';
        break;
      case 'manual':
        path = '/manual-entry';
        break;
      case 'results':
        path = '/results';
        break;
      case 'history':
        path = '/history';
        break;
      case 'admin-dashboard':
        path = '/admin';
        break;
      default:
        path = '/';
    }
    
    if (replace) {
      window.history.replaceState({ view }, '', path + search);
    } else {
      window.history.pushState({ view }, '', path + search);
    }
  };

  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = (event) => {
      const view = getViewFromUrl();
      
      // Update state based on URL
      if (!isAuthenticated) {
        if (view === 'landing') setCurrentView('landing');
        else if (view === 'login') setCurrentView('login');
        else if (view === 'signup') setCurrentView('signup');
        else {
          setCurrentView('landing');
          updateUrl('landing', true);
        }
      } else {
        const validViews = ['dashboard', 'upload', 'manual', 'results', 'history', 'admin-dashboard'];
        if (validViews.includes(view)) {
          setCurrentView(view);
        } else {
          const defaultView = user?.role === 'admin' ? 'admin-dashboard' : 'dashboard';
          setCurrentView(defaultView);
          updateUrl(defaultView, true);
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isAuthenticated, user]);

  // Initialize app based on URL on load
  useEffect(() => {
    const token = authStorage.getToken();
    const savedUser = authStorage.getUser();
    const urlView = getViewFromUrl();

    if (token && savedUser) {
      authAPI.getCurrentUser()
        .then((response) => {
          if (response && response.success && response.user) {
            setUser(response.user);
            setIsAuthenticated(true);
            authStorage.setUser(response.user);
            
            // Determine where to go based on URL or role
            let targetView;
            if (urlView !== 'landing' && urlView !== 'login' && urlView !== 'signup') {
              // If URL has a valid view, use it
              targetView = urlView;
            } else {
              // Otherwise go to dashboard
              targetView = response.user.role === 'admin' ? 'admin-dashboard' : 'dashboard';
            }
            
            setCurrentView(targetView);
            updateUrl(targetView, true);

            const restoredReport = loadReportData();
            if (restoredReport) {
              setReportData(restoredReport);
            }
          } else {
            // Invalid token, go to landing
            setCurrentView('landing');
            updateUrl('landing', true);
          }
        })
        .catch((error) => {
          console.error('Token verification failed:', error);
          authStorage.clear();
          setCurrentView('landing');
          updateUrl('landing', true);
        });
    } else {
      // No token, show landing or login based on URL
      if (urlView === 'login') {
        setCurrentView('login');
      } else if (urlView === 'signup') {
        setCurrentView('signup');
      } else {
        setCurrentView('landing');
        updateUrl('landing', true);
      }
    }
  }, []);

  // Socket.IO real-time updates
  useEffect(() => {
    if (!isAuthenticated) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }
    const socket = createSocket();
    socketRef.current = socket;

    socket.on('report:uploaded', (data) => {
      setRealtimeToast({
        message: data.message || 'New report uploaded',
        type: 'report',
        filename: data.filename,
      });
      window.dispatchEvent(new CustomEvent('hmh:adminRefresh'));
    });
    socket.on('analysis:done', (data) => {
      setRealtimeToast({
        message: data.message || 'Analysis completed',
        type: 'analysis',
        severity: data.overallSeverity,
      });
      window.dispatchEvent(new CustomEvent('hmh:adminRefresh'));
    });
    socket.on('user:registered', () => {
      window.dispatchEvent(new CustomEvent('hmh:adminRefresh'));
    });
    socket.on('ocr:error', () => {
      window.dispatchEvent(new CustomEvent('hmh:adminRefresh'));
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [isAuthenticated]);

  // Auto-hide realtime toast after 5 seconds
  useEffect(() => {
    if (!realtimeToast) return;
    const t = setTimeout(() => setRealtimeToast(null), 5000);
    return () => clearTimeout(t);
  }, [realtimeToast]);

  const handleLogin = (userData) => {
    saveReportData(null);
    setUploadState(null);
    setPreviousViewBeforeResults(null);
    setUser(userData);
    setIsAuthenticated(true);
    const targetView = userData?.role === 'admin' ? 'admin-dashboard' : 'dashboard';
    setCurrentView(targetView);
    setAuthView('login');
    updateUrl(targetView);
  };

  const handleSignup = (userData) => {
    saveReportData(null);
    setUploadState(null);
    setPreviousViewBeforeResults(null);
    setUser(userData);
    setIsAuthenticated(true);
    setCurrentView('dashboard');
    updateUrl('dashboard');
  };

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  const confirmLogout = () => {
    setShowLogoutConfirm(false);
    setUser(null);
    setIsAuthenticated(false);
    saveReportData(null);
    setUploadState(null);
    setPreviousViewBeforeResults(null);
    authStorage.clear();
    setCurrentView('landing');
    setAuthView('login');
    updateUrl('landing');
  };

  const cancelLogout = () => {
    setShowLogoutConfirm(false);
  };

  const handleGetStarted = () => {
    setAuthView('login');
    setCurrentView('login');
    updateUrl('login');
  };

  const handleUploadSuccess = (data) => {
    try {
      console.log('Upload successful - received data:', data);
      
      if (!data || !data.extractedData) {
        console.error('No extracted data received!', data);
        alert('No data extracted. Please try again or use manual entry.');
        return;
      }
      
      const reportDataToSet = {
        reportId: data.reportId || Date.now().toString(),
        cbcData: data.extractedData,
        filename: data.filename || 'uploaded_file',
        gender: data.gender || null
      };
      
      console.log('Setting report data:', reportDataToSet);
      saveReportData(reportDataToSet);
      
      setPreviousViewBeforeResults(currentView);
      setTimeout(() => {
        setCurrentView('results');
        updateUrl('results');
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
        cbcData: data.cbcData,
        gender: data.gender || null
      };
      
      console.log('Setting report data:', reportDataToSet);
      saveReportData(reportDataToSet);
      
      setPreviousViewBeforeResults(currentView);
      setTimeout(() => {
        setCurrentView('results');
        updateUrl('results');
      }, 100);
    } catch (error) {
      console.error('Error in handleManualSubmit:', error);
      alert('An error occurred. Please try again.');
    }
  };

  const handleBack = () => {
    if (previousViewBeforeResults) {
      setCurrentView(previousViewBeforeResults);
      updateUrl(previousViewBeforeResults);
    } else {
      setCurrentView('dashboard');
      updateUrl('dashboard');
    }
  };

  const handleUploadStateChange = (state) => {
    setUploadState(state);
  };

  const handleNavigate = (view, options = {}) => {
    if (user?.role === 'admin') {
      setCurrentView('admin-dashboard');
      updateUrl('admin-dashboard');
      return;
    }
    if (view === 'upload' && options.resetUploadState) {
      setUploadState(null);
    }
    setCurrentView(view);
    updateUrl(view);
  };

  useEffect(() => {
    if (!isAuthenticated || isAdmin) return;
    if (currentView === 'results' && !reportData) {
      setCurrentView('upload');
      updateUrl('upload', true);
    }
  }, [currentView, reportData, isAuthenticated, isAdmin]);

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
              updateUrl('signup');
            }}
            onBackToLanding={() => {
              setCurrentView('landing');
              updateUrl('landing');
            }}
          />
        )}
        {(currentView === 'signup' || authView === 'signup') && (
          <Signup 
            onSignupSuccess={handleSignup}
            onSwitchToLogin={() => {
              setAuthView('login');
              setCurrentView('login');
              updateUrl('login');
            }}
            onBackToLanding={() => {
              setCurrentView('landing');
              updateUrl('landing');
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="App">
      {/* Real-time update toast (Socket.IO) */}
      {realtimeToast && (
        <div
          className="fixed top-0 left-0 right-0 z-[80] flex items-center justify-center px-4 py-3 bg-[#8B0000] text-white shadow-lg animate-slide-down"
          role="alert"
        >
          <i className="fas fa-bell mr-2"></i>
          <span className="font-medium">
            {realtimeToast.message}
            {realtimeToast.filename && `: ${realtimeToast.filename}`}
            {realtimeToast.severity && ` (${realtimeToast.severity})`}
          </span>
          <button
            type="button"
            aria-label="Dismiss"
            className="ml-4 p-1 rounded hover:bg-white/20"
            onClick={() => setRealtimeToast(null)}
          >
            <i className="fas fa-times"></i>
          </button>
        </div>
      )}

      <div className="flex flex-col min-h-screen">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-[60]">
          <div className="flex items-center justify-between px-4 md:px-6 py-4">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              <button
                type="button"
                className="p-2 sm:p-3 rounded-lg hover:bg-gray-100 transition-colors border border-gray-200 shrink-0 md:hidden"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                aria-label="Toggle sidebar"
              >
                {sidebarOpen ? (
                  <i className="fas fa-times text-2xl text-[#8B0000]"></i>
                ) : (
                  <i className="fas fa-bars text-2xl text-[#8B0000]"></i>
                )}
              </button>
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <i className="fas fa-heartbeat text-xl sm:text-2xl text-[#8B0000] shrink-0"></i>
                <h1 className="text-base sm:text-xl font-bold text-[#8B0000] truncate">
                  Health Monitoring Hub
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-4 shrink-0">
              <div className="text-right hidden sm:block">
                <div className="font-medium text-gray-900 flex items-center gap-2 justify-end">
                  <span>{user?.name || 'User'}</span>
                  {isAdmin && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-yellow-100 text-yellow-800 border border-yellow-300">
                      Admin
                    </span>
                  )}
                </div>
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

        <div className="flex flex-1 relative min-h-0">
          {/* Sidebar Overlay for Mobile */}
          {sidebarOpen && (
            <div 
              className="fixed inset-0 bg-black bg-opacity-50 z-[50] md:hidden"
              onClick={() => setSidebarOpen(false)}
            ></div>
          )}

          {/* Sidebar: drawer on small screens, in-flow on md+ */}
          <aside
            className={`${
              sidebarOpen ? 'translate-x-0' : '-translate-x-full'
            } fixed left-0 top-16 bottom-0 z-[50] w-64 max-w-[min(100vw,16rem)] flex flex-col bg-white border-r border-gray-200 shadow-lg transition-transform duration-300 overflow-y-auto md:static md:top-auto md:bottom-auto md:z-0 md:max-w-none md:translate-x-0 md:flex-shrink-0 md:overflow-y-visible md:shadow-none`}
          >
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
              {(isAdmin
                ? [
                    { id: 'admin-dashboard', label: 'Admin Dashboard', icon: 'fas fa-tools' }
                  ]
                : [
                    { id: 'dashboard', label: 'Dashboard', icon: 'fas fa-chart-line' },
                    { id: 'upload', label: 'Upload Report', icon: 'fas fa-upload' },
                    { id: 'manual', label: 'Manual Entry', icon: 'fas fa-edit' },
                    { id: 'history', label: 'History & Trends', icon: 'fas fa-chart-bar' }
                  ]
              ).map(item => (
                <button
                  key={item.id}
                  className={`w-full px-4 py-3 mb-2 rounded-lg flex items-center gap-3 transition-all ${
                    currentView === item.id
                      ? 'bg-[#FFE4E1] text-[#8B0000] font-semibold border-l-4 border-[#8B0000]' 
                      : 'text-gray-700 hover:bg-gray-50 hover:text-[#8B0000]'
                  }`}
                  onClick={() => {
                    if (item.id === 'manual') {
                      handleNavigate('manual');
                    } else {
                      handleNavigate(item.id);
                    }
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
          <main className="flex-1 min-w-0 overflow-y-auto min-h-[calc(100vh-4.5rem)] md:min-h-screen bg-gradient-to-br from-white via-[#fff8f8] to-[#FFE4E1]">
            {isAdmin ? (
              <>
                {currentView === 'admin-dashboard' && (
                  <AdminDashboard />
                )}
              </>
            ) : (
              <>
                {currentView === 'dashboard' && (
                  <Dashboard onNavigate={handleNavigate} />
                )}
                {currentView === 'upload' && (
                  <UploadReport 
                    key={`upload-${user?.id || 'no-user'}`}
                    onUploadSuccess={handleUploadSuccess} 
                    onBack={() => handleNavigate('dashboard')}
                    initialState={uploadState}
                    onStateChange={handleUploadStateChange}
                    initialMode={currentView === 'upload' && window.location.hash === '#manual' ? 'manual' : undefined}
                  />
                )}
                {currentView === 'manual' && (
                  <UploadReport 
                    key={`manual-${user?.id || 'no-user'}`}
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
                      gender={reportData.gender || null}
                      onBack={handleBack}
                      onUploadNew={() => {
                        saveReportData(null);
                        setUploadState(null);
                        setPreviousViewBeforeResults('upload');
                        setCurrentView('upload');
                        updateUrl('upload');
                      }}
                    />
                  ) : null
                )}
                {currentView === 'history' && (
                  <HistoryGraph onNavigate={handleNavigate} />
                )}
              </>
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

      <style>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-slide-down {
          animation: slideDown 0.5s ease-out;
        }
      `}</style>
    </div>
  );
}

export default App;