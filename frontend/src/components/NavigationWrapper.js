// src/components/NavigationWrapper.js
import React from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import App from '../App';

// This wrapper adds routing capabilities to your existing App
function NavigationWrapper() {
  return (
    <BrowserRouter>
      <AppWithRouter />
    </BrowserRouter>
  );
}

function AppWithRouter() {
  const navigate = useNavigate();
  const location = useLocation();

  // Pass navigate and location to the main App component
  return <App navigate={navigate} location={location} />;
}

export default NavigationWrapper;