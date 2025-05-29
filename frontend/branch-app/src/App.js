import React from 'react';
import { Routes, Route, Navigate, Link } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import RegistrationPage from './pages/RegistrationPage';
import DashboardPage from './pages/DashboardPage';
import './App.css'; // You can keep or modify this

// A simple component to handle protected routes
function ProtectedRoute({ children }) {
  const token = localStorage.getItem('branchUserToken');
  if (!token) {
    // User not authenticated
    return <Navigate to="/login" />;
  }
  return children;
}

function App() {
  return (
    <div className="App"> {/* */}
      <nav>
        {/* Basic navigation for PoC, can be improved later */}
        <Link to="/login" style={{ marginRight: '10px' }}>Login</Link>
        <Link to="/register">Register</Link>
      </nav>
      <hr />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegistrationPage />} />
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          } 
        />
        {/* Redirect root path to login or dashboard based on auth state */}
        <Route 
          path="/" 
          element={localStorage.getItem('branchUserToken') ? <Navigate to="/dashboard" /> : <Navigate to="/login" />} 
        />
      </Routes>
    </div>
  );
}

export default App;