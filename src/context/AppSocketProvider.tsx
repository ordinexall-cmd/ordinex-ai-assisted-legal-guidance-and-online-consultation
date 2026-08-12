import React, { useEffect } from 'react';
import { useAuth } from './AuthContext';
import { disconnectAppSocket, retainAppSocket } from '../services/appSocket';

/** Keeps Socket.IO connected while the user is authenticated. */
export function AppSocketProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      disconnectAppSocket();
      return;
    }
    retainAppSocket();
    return () => {
      disconnectAppSocket();
    };
  }, [user?.id]);

  return <>{children}</>;
}

export default AppSocketProvider;
