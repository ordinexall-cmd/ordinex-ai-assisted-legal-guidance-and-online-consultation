import React, { useEffect, useState } from 'react';
import { authApi } from '../../services/api';

interface Props {
  readonly role?: 'CITIZEN' | 'LAWYER';
}

export const GoogleSignInButton: React.FC<Props> = ({ role = 'CITIZEN' }) => {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    authApi.googleStatus()
      .then((r) => setEnabled(r.enabled))
      .catch(() => setEnabled(false));
  }, []);

  if (!enabled) return null;

  return (
    <>
      <div className="auth-divider" role="separator">
        <span>or</span>
      </div>
      <button
        type="button"
        className="auth-google-btn"
        onClick={() => {
          window.location.href = authApi.googleStartUrl(role);
        }}
      >
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
          <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303C33.654 32.657 29.083 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C33.64 6.053 29.082 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
          <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 16.108 18.961 13 24 13c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C33.64 6.053 29.082 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
          <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
          <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c1.649 4.657 6.219 8 11.697 8 3.059 0 5.842-1.154 7.961-3.039l5.657 5.657C39.64 43.947 44 38.075 44 24c0-1.341-.138-2.65-.389-3.917z" />
        </svg>
        Continue with Google
      </button>
    </>
  );
};

export default GoogleSignInButton;
