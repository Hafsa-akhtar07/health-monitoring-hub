import React, { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';

function Signup({ onSignupSuccess, onSwitchToLogin, onBackToLanding }) {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setError(null);
  };

  const validateForm = () => {
    if (!formData.fullName || !formData.email || !formData.password || !formData.confirmPassword) {
      setError('Please fill in all fields');
      return false;
    }

    if (formData.fullName.length < 3) {
      setError('Full name must be at least 3 characters');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address');
      return false;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters');
      return false;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      // TODO: Replace with actual API call
      // For now, simulate signup
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Mock successful signup
      if (onSignupSuccess) {
        onSignupSuccess({
          email: formData.email,
          name: formData.fullName,
          id: 'user_' + Date.now()
        });
      }
    } catch (err) {
      setError('Signup failed. Please try again.');
      console.error('Signup error:', err);
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
          <p className="text-lg text-gray-600">Create your account and start monitoring your health</p>
        </div>

        {/* Signup Card */}
        <Card className="shadow-2xl shadow-[#8B0000]/20 border-0 overflow-hidden">
          <div className="bg-gradient-to-r from-[#8B0000] to-[#B22222] p-6">
            <CardHeader className="pb-2">
              <CardTitle className="text-2xl text-white flex items-center gap-2">
                <i className="fas fa-user-plus"></i>
                Create Your Account
              </CardTitle>
              <CardDescription className="text-white/90">
                Join thousands of users monitoring their health
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
                <label htmlFor="fullName" className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <i className="fas fa-user text-[#8B0000]"></i>
                  Full Name
                </label>
                <input
                  type="text"
                  id="fullName"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  placeholder="Enter your full name"
                  required
                  minLength={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#8B0000] focus:border-[#8B0000] outline-none transition-all"
                />
              </div>

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
                    placeholder="At least 8 characters"
                    required
                    autoComplete="new-password"
                    minLength={8}
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

              <div className="space-y-2">
                <label htmlFor="confirmPassword" className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <i className="fas fa-lock text-[#8B0000]"></i>
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    id="confirmPassword"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="Confirm your password"
                    required
                    autoComplete="new-password"
                    minLength={8}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#8B0000] focus:border-[#8B0000] outline-none transition-all pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-[#8B0000] transition-colors"
                  >
                    <i className={`fas ${showConfirmPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                  </button>
                </div>
              </div>

              <div className="flex items-start gap-2 text-sm">
                <input 
                  type="checkbox" 
                  required
                  className="mt-1 w-4 h-4 text-[#8B0000] border-gray-300 rounded focus:ring-[#8B0000]"
                />
                <label className="text-gray-600 cursor-pointer">
                  I agree to the{' '}
                  <a href="#" className="text-[#8B0000] hover:text-[#DC143C] font-medium">Terms & Conditions</a>
                  {' '}and{' '}
                  <a href="#" className="text-[#8B0000] hover:text-[#DC143C] font-medium">Privacy Policy</a>
                </label>
              </div>

              <Button
                type="submit"
                className="w-full bg-[#8B0000] hover:bg-[#B22222] text-white py-6 text-base font-semibold shadow-lg shadow-[#8B0000]/30 hover:shadow-[#8B0000]/50 transition-all duration-300"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <i className="fas fa-spinner fa-spin mr-2"></i>
                    Creating account...
                  </>
                ) : (
                  <>
                    <i className="fas fa-user-plus mr-2"></i>
                    Sign Up
                  </>
                )}
              </Button>
            </form>

            <div className="mt-6 pt-6 border-t border-gray-200 text-center">
              <p className="text-gray-600 text-sm">
                Already have an account?{' '}
                <button 
                  type="button"
                  onClick={onSwitchToLogin}
                  className="text-[#8B0000] hover:text-[#DC143C] font-semibold transition-colors"
                >
                  Login here
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

export default Signup;
