// ============================================================
// Ordinex — Protected Route Component
// Redirects unauthenticated users or wrong roles to landing page.
// ============================================================
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'CITIZEN' | 'LAWYER';
}

export function ProtectedRoute({
  children,
  requiredRole,
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #00342B, #004D40)',
        color: '#C5A454',
        fontFamily: "'Inter', sans-serif",
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 40,
            height: 40,
            border: '3px solid rgba(197,164,84,0.2)',
            borderTopColor: '#C5A454',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 16px',
          }} />
          <p style={{ fontSize: 14, opacity: 0.8 }}>Loading...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/" replace />;
  }

  if (requiredRole === 'LAWYER' && user.role === 'LAWYER' && !user.isVerified) {
    return <Navigate to="/lawyer/register?phase=kyc" replace />;
  }

  if (requiredRole && user.role !== requiredRole) {
    if (user.role === 'LAWYER') {
      return <Navigate to={user.isVerified ? '/lawyer/dashboard' : '/lawyer/register?phase=kyc'} replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
