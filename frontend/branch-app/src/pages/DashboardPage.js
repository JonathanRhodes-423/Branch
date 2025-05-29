import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function DashboardPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('branchUserToken');
    if (!token) {
      navigate('/login'); // Redirect to login if no token
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('branchUserToken');
    localStorage.removeItem('branchUserId');
    navigate('/login');
  };

  return (
    <div>
      <h2>Dashboard</h2>
      <p>Welcome to your Branch App Dashboard!</p>
      {/* Placeholder for future content */}
      <button onClick={handleLogout}>Logout</button>
    </div>
  );
}

export default DashboardPage;