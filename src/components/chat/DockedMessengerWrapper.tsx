import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { DockedMessenger } from './DockedMessenger';

/**
 * Wrapper that renders DockedMessenger only for authenticated users.
 * Reads user from AuthContext and passes userId/userName.
 */
export const DockedMessengerWrapper: React.FC = () => {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated || !user) return null;

  return (
    <DockedMessenger
      userId={user.id}
      userName={user.name}
    />
  );
};
