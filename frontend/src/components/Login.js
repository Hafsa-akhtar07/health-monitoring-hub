import React, { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';

function Login({ onLoginSuccess, onSwitchToSignup, onBackToLanding }) {
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
      // TODO: Replace with actual API call
      // For now, simulate login
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock successful login
      if (onLoginSuccess) {
        onLoginSuccess({
          email: formData.email,
          name: 'John Doe',
          id: 'user_' + Date.now()
        });
      }
    } catch (err) {
      setError('Login failed. Please check your credentials.');
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-[#fff8f8] to-[#FFE4E1] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Header Logo */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <i className="fas fa-heartbeat text-4xl text-[#8B0000]"></i>
            <h1 className="text-3xl font-bold text-[#8B0000]">Health Monitoring Hub</h1>
          </div>
          <p className="text-lg text-gray-600">Welcome back! Please login to continue</p>
        </div>

        {/* Login Card */}
        <Card className="shadow-2xl shadow-[#8B0000]/20 border-0 overflow-hidden">
          <div className="bg-gradient-to-r from-[#8B0000] to-[#B22222] p-6">
            <CardHeader className="pb-2">
              <CardTitle className="text-2xl text-white flex items-center gap-2">
                <i className="fas fa-sign-in-alt"></i>
                Login to Your Account
              </CardTitle>
              <CardDescription className="text-white/90">
                Access your health dashboard and reports
              </CardDescription>
            </CardHeader>
          </div>

          <CardContent className="p-6">
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
                <i className="fas fa-exclamation-circle"></i>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <i className="fas fa-envelope text-[#8B0000]"></i>
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
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#8B0000] focus:border-[#8B0000] outline-none transition-all"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <i className="fas fa-lock text-[#8B0000]"></i>
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
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#8B0000] focus:border-[#8B0000] outline-none transition-all pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-[#8B0000] transition-colors"
                  >
                    <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 cursor-pointer text-gray-600">
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 text-[#8B0000] border-gray-300 rounded focus:ring-[#8B0000]"
                  />
                  <span>Remember me</span>
                </label>
                <a href="#" className="text-[#8B0000] hover:text-[#DC143C] font-medium transition-colors">
                  Forgot password?
                </a>
              </div>

              <Button
                type="submit"
                className="w-full bg-[#8B0000] hover:bg-[#B22222] text-white py-6 text-base font-semibold shadow-lg shadow-[#8B0000]/30 hover:shadow-[#8B0000]/50 transition-all duration-300"
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
              <p className="text-gray-600 text-sm">
                Don't have an account?{' '}
                <button 
                  type="button"
                  onClick={onSwitchToSignup}
                  className="text-[#8B0000] hover:text-[#DC143C] font-semibold transition-colors"
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
              onClick={onBackToLanding}
              className="text-gray-600 hover:text-[#8B0000] text-sm transition-colors flex items-center justify-center gap-2 mx-auto"
            >
              <i className="fas fa-arrow-left"></i>
              Back to Home
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default Login;
