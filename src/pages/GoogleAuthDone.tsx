import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { setToken } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { getCitizenPostAuthPath } from '../constants/guestDraft';

export const GoogleAuthDone: React.FC = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { refreshUser } = useAuth();

  useEffect(() => {
    const token = params.get('token');
    if (!token) {
      navigate('/?authError=missing_token', { replace: true });
      return;
    }
    setToken(token);
    const onboard = params.get('onboard');
    refreshUser()
      .then(() => {
        if (onboard === 'lawyer') {
          navigate('/settings?tab=verification', { replace: true });
          return;
        }
        navigate(getCitizenPostAuthPath(), { replace: true });
      })
      .catch(() => navigate('/?authError=session_failed', { replace: true }));
  }, [params, navigate, refreshUser]);

  return (
    <div className="analysis-empty" style={{ minHeight: '40vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p>Continuing with Google…</p>
    </div>
  );
};

export default GoogleAuthDone;
