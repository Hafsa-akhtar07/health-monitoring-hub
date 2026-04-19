import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { authAPI } from '../utils/api';
import { authStorage } from '../utils/authStorage';

function Login({ onLoginSuccess, onSwitchToSignup, onBackToLanding }) {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Basic validation
    if (!formData.email || !formData.password) {
      setError('Please fill in all fields');
      setLoading(false);
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address');
      setLoading(false);
      return;
    }

    try {
      // Call real login API
      const response = await authAPI.login({
        email: formData.email,
        password: formData.password
      });

      if (response.success && response.token && response.user) {
        // Store token/user in sessionStorage (per-tab), keep localStorage for backward compat
        authStorage.setToken(response.token);
        authStorage.setUser(response.user);
        localStorage.setItem('hmh_token', response.token); // legacy
        localStorage.setItem('hmh_user', JSON.stringify(response.user)); // legacy

        // Call success callback with user data
        if (onLoginSuccess) {
          onLoginSuccess(response.user);
        }
      } else {
        setError(response.error || 'Login failed. Please try again.');
      }
    } catch (err) {
      // Handle API errors
      const errorMessage = err.response?.data?.error || err.message || 'Login failed. Please check your credentials.';
      setError(errorMessage);
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  //const handleBackToLanding = () => {
    //navigate('/');
    //if (onBackToLanding) {
      //onBackToLanding();
    //}
  //};
const handleBackToLanding = () => {
  window.history.back(); // This will go back in browser history
  if (onBackToLanding) {
    onBackToLanding();
  }
};
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12" style={{
      background: 'linear-gradient(180deg, #fff5f5 0%, #ffe0e0 15%, #ffcccc 30%, #ffb3b3 45%, #ff9999 60%, #ff8080 75%, #e06666 85%, #cc4d4d 95%, #b33b3b 100%)',
      backgroundAttachment: 'fixed'
    }}>
      <div className="w-full max-w-md">
        {/* Header Logo */}
        <div className="text-center mb-8 animate-fadeIn">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#8B0000] to-[#B22222] flex items-center justify-center shadow-xl shadow-red-900/30">
              <i className="fas fa-heartbeat text-3xl text-white"></i>
            </div>
          </div>
          <h1 className="text-3xl font-bold text-[#2c1212] mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>
            Health Monitoring Hub
          </h1>
          <p className="text-[#4e2a2a] text-lg font-medium">Welcome back! Please login to continue</p>
        </div>

        {/* Login Card */}
        <Card className="shadow-2xl shadow-red-900/25 border-0 overflow-hidden transform transition-all duration-500 hover:shadow-red-900/40 hover:scale-[1.02]">
          <div className="bg-gradient-to-r from-[#8B0000] to-[#B22222] p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full -ml-12 -mb-12"></div>
            <CardHeader className="pb-2 relative z-10">
              <CardTitle className="text-2xl text-white flex items-center gap-2">
                <i className="fas fa-sign-in-alt"></i>
                Login to Your Account
              </CardTitle>
              <CardDescription className="text-white/90">
                Access your health dashboard and reports
              </CardDescription>
            </CardHeader>
          </div>

          <CardContent className="p-6 bg-white/80 backdrop-blur-sm">
            {error && (
              <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-600 rounded-lg text-red-700 text-sm flex items-center gap-2 shadow-sm animate-shake">
                <i className="fas fa-exclamation-circle"></i>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2 group">
                <label htmlFor="email" className="text-sm font-semibold text-[#2c1212] flex items-center gap-2">
                  <i className="fas fa-envelope text-[#8B0000] group-hover:text-[#B22222] transition-colors"></i>
                  Email Address
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="Enter your email"
                  required
                  autoComplete="email"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#8B0000] focus:border-[#8B0000] outline-none transition-all duration-300 hover:border-red-300"
                />
              </div>

              <div className="space-y-2 group">
                <label htmlFor="password" className="text-sm font-semibold text-[#2c1212] flex items-center gap-2">
                  <i className="fas fa-lock text-[#8B0000] group-hover:text-[#B22222] transition-colors"></i>
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Enter your password"
                    required
                    autoComplete="current-password"
                    minLength={6}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#8B0000] focus:border-[#8B0000] outline-none transition-all duration-300 pr-12 hover:border-red-300"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-[#8B0000] transition-all duration-300 hover:scale-110"
                  >
                    <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 cursor-pointer text-[#4e2a2a] group">
                  <input type="checkbox" className="w-4 h-4 text-[#8B0000] border-gray-300 rounded focus:ring-[#8B0000] cursor-pointer" />
                  <span className="group-hover:text-[#8B0000] transition-colors">Remember me</span>
                </label>
                <a href="#" className="text-[#8B0000] hover:text-[#DC143C] font-medium transition-all duration-300 hover:underline">
                  Forgot password?
                </a>
              </div>

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-[#8B0000] to-[#B22222] hover:from-[#B22222] hover:to-[#DC143C] text-white py-6 text-base font-semibold rounded-xl shadow-lg shadow-red-900/40 hover:shadow-red-900/60 transition-all duration-300 transform hover:scale-[1.02] active:scale-95"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <i className="fas fa-spinner fa-spin mr-2"></i>
                    Logging in...
                  </>
                ) : (
                  <>
                    <i className="fas fa-sign-in-alt mr-2"></i>
                    Login
                  </>
                )}
              </Button>
            </form>

            <div className="mt-6 pt-6 border-t border-gray-200 text-center">
              <p className="text-[#4e2a2a] text-sm">
                Don't have an account?{' '}
                <button 
                  type="button"
                  onClick={onSwitchToSignup}
                  className="text-[#8B0000] hover:text-[#DC143C] font-semibold transition-all duration-300 hover:underline ml-1"
                >
                  Sign up here
                </button>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Back to Landing Page */}
        {onBackToLanding && (
          <div className="mt-6 text-center">
            <button
              onClick={handleBackToLanding}
              className="group text-[#4e2a2a] hover:text-[#8B0000] text-sm font-medium transition-all duration-300 flex items-center justify-center gap-2 mx-auto px-4 py-2 rounded-full hover:bg-white/50 backdrop-blur-sm"
            >
              <i className="fas fa-arrow-left group-hover:transform group-hover:-translate-x-1 transition-transform duration-300"></i>
              Back to Home
            </button>
          </div>
        )}
      </div>

      {/* Add animation keyframes */}
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
        
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-2px); }
          20%, 40%, 60%, 80% { transform: translateX(2px); }
        }
        
        .animate-fadeIn {
          animation: fadeIn 0.6s ease-out;
        }
        
        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }
      `}</style>
    </div>
  );
}

export default Login;