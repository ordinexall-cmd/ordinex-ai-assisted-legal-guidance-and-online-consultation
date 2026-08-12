import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { setToken } from '../services/api';
import { useAuth } from '../context/AuthContext';

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
          navigate('/lawyer/register?phase=kyc', { replace: true });
          return;
        }
        navigate('/dashboard', { replace: true });
      })
      .catch(() => navigate('/?authError=session_failed', { replace: true }));
  }, [params, navigate, refreshUser]);

  return (
    <div className="analysis-empty" style={{ minHeight: '40vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p>Signing you in with Google…</p>
    </div>
  );
};

export default GoogleAuthDone;
