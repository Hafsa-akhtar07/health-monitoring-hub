// Backup of original App.js
import React, { useState, useEffect } from 'react';
import './App.css';
import UploadReport from './components/UploadReport';
import ManualEntry from './components/ManualEntry';
import ResultsDisplay from './components/ResultsDisplay';
import HistoryGraph from './components/HistoryGraph';
import Dashboard from './components/Dashboard';
import Profile from './components/Profile';
import Login from './components/Login';
import Signup from './components/Signup';
import LandingPage from './components/LandingPage';
import Footer from './components/Footer';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentView, setCurrentView] = useState('landing');
  const [authView, setAuthView] = useState('login');
  const [reportData, setReportData] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('hmh_user');
    if (savedUser) {
      try {
        const userData = JSON.parse(savedUser);
        setUser(userData);
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
  };

  const handleSignup = (userData) => {
    setUser(userData);
    setIsAuthenticated(true);
    localStorage.setItem('hmh_user', JSON.stringify(userData));
    setCurrentView('dashboard');
  };

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to logout?')) {
      setUser(null);
      setIsAuthenticated(false);
      setReportData(null);
      localStorage.removeItem('hmh_user');
      setCurrentView('landing');
      setAuthView('login');
    }
  };

  const handleGetStarted = () => {
    const savedUser = localStorage.getItem('hmh_user');
    if (savedUser) {
      try {
        const userData = JSON.parse(savedUser);
        setUser(userData);
        setIsAuthenticated(true);
        setCurrentView('dashboard');
        return;
      } catch (e) {
        console.error('Error parsing saved user:', e);
        localStorage.removeItem('hmh_user');
      }
    }
    setAuthView('login');
    setCurrentView('login');
  };

  const handleUploadSuccess = (data) => {
    try {
      if (!data || !data.extractedData) {
        alert('No data extracted. Please try again or use manual entry.');
        return;
      }
      const reportDataToSet = {
        reportId: data.reportId || Date.now().toString(),
        cbcData: data.extractedData,
        filename: data.filename || 'uploaded_file'
      };
      setReportData(reportDataToSet);
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
      if (!data || !data.cbcData) {
        alert('No data submitted. Please fill in the required fields.');
        return;
      }
      const reportDataToSet = {
        reportId: data.reportId || Date.now().toString(),
        cbcData: data.cbcData
      };
      setReportData(reportDataToSet);
      setTimeout(() => {
        setCurrentView('results');
      }, 100);
    } catch (error) {
      console.error('Error in handleManualSubmit:', error);
      alert('An error occurred. Please try again.');
    }
  };

  const handleBack = () => {
    setCurrentView('dashboard');
    setReportData(null);
  };

  const handleNavigate = (view) => {
    setCurrentView(view);
  };

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'upload', label: 'Upload Report', icon: '📤' },
    { id: 'manual', label: 'Manual Entry', icon: '✍️' },
    { id: 'history', label: 'History & Trends', icon: '📈' },
    { id: 'profile', label: 'Profile & Privacy', icon: '👤' }
  ];

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
        <Footer />
      </div>
    );
  }

  return (
    <div className="App">
      <header className="app-header">
        <div className="header-content">
          <button 
            className="sidebar-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Toggle sidebar"
          >
            ☰
          </button>
          <div className="header-title">
            <h1>🏥 Health Monitoring Hub</h1>
            <p className="header-subtitle">AI-Powered CBC Analysis</p>
          </div>
          <div className="header-user">
            <span className="user-name">{user?.name || 'User'}</span>
            <span className="last-analysis">Last analysis: {new Date().toLocaleDateString()}</span>
          </div>
        </div>
      </header>

      <div className="app-layout">
        <aside className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
          <nav className="sidebar-nav">
            {menuItems.map(item => (
              <button
                key={item.id}
                className={`nav-item ${currentView === item.id ? 'active' : ''}`}
                onClick={() => handleNavigate(item.id)}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
              </button>
            ))}
          </nav>
          <div className="sidebar-footer">
            <button className="nav-item logout-btn" onClick={handleLogout}>
              <span className="nav-icon">🚪</span>
              <span className="nav-label">Logout</span>
            </button>
          </div>
        </aside>

        <main className="main-content">
          {currentView === 'dashboard' && (
            <Dashboard onNavigate={handleNavigate} />
          )}
          {currentView === 'upload' && (
            <UploadReport onUploadSuccess={handleUploadSuccess} />
          )}
          {currentView === 'manual' && (
            <ManualEntry onDataSubmit={handleManualSubmit} />
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
            <HistoryGraph />
          )}
          {currentView === 'profile' && (
            <Profile onNavigate={handleNavigate} />
          )}
        </main>
      </div>
      <Footer />
    </div>
  );
}

export default App;










