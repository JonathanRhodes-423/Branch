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
    return <Navigate to="/login" replace />;
  }
  return children;
}

function App() {
  const isAuthenticated = !!localStorage.getItem('branchUserToken');

  return (
    <div className="App" style={{ minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
      <nav style={{ 
        padding: '10px 20px', 
        backgroundColor: '#fff', 
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        marginBottom: '20px'
      }}>
        {!isAuthenticated && (
          <>
            <Link to="/login" style={{ marginRight: '10px', textDecoration: 'none', color: '#007bff' }}>Login</Link>
            <Link to="/register" style={{ textDecoration: 'none', color: '#007bff' }}>Register</Link>
          </>
        )}
      </nav>

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
        <Route 
          path="/" 
          element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />} 
        />
      </Routes>
    </div>
  );
}

export default App;