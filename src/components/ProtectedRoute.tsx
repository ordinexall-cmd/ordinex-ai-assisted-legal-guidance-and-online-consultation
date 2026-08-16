// ============================================================
// Ordinex — Protected Route Component
// Redirects unauthenticated users or wrong roles to landing page.
// ============================================================
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

import { VerificationGateNotice } from './auth/VerificationGateNotice';
import { AppShell } from './shell/AppShell';
import { isCitizenBookingUnlocked } from '../utils/trustScore';
import { getCitizenNav } from '../utils/citizenWorkspace';

import { getLawyerNav } from '../utils/lawyerWorkspace';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'CITIZEN' | 'LAWYER';
  requireCitizenVerified?: boolean;
  requireLawyerVerified?: boolean;
}

export function ProtectedRoute({
  children,
  requiredRole,
  requireCitizenVerified = false,
  requireLawyerVerified = false,
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="ox-boot-screen" role="status" aria-live="polite">
        <div className="ox-boot-screen__spinner" aria-hidden />
        <p>Loading</p>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/" replace />;
  }

  if (requiredRole && user.role !== requiredRole) {
    if (user.role === 'LAWYER') {
      return <Navigate to="/lawyer/dashboard" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  if (requireCitizenVerified && user.role === 'CITIZEN' && !isCitizenBookingUnlocked(user)) {
    return (
      <AppShell
        variant="flow"
        title="Verification Required"
        navItems={getCitizenNav(isCitizenBookingUnlocked(user))}
        stepLabel="Verification"
      >
        <VerificationGateNotice />
      </AppShell>
    );
  }

  if (requireLawyerVerified && user.role === 'LAWYER' && !user.isVerified) {
    return (
      <AppShell
        variant="flow"
        title="Verification Required"
        navItems={getLawyerNav(user)}
        stepLabel="Verification"
      >
        <VerificationGateNotice
          title="Profile Verification Required"
          featureName="Directory and consultation offers"
        />
      </AppShell>
    );
  }

  return <>{children}</>;
}
