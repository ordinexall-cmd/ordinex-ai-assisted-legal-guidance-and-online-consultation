// ============================================================
// Ordinex — Auth Context
// Global authentication state for the entire app.
// ============================================================
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi, setToken, clearToken, setKycToken, type UserProfile } from '../services/api';

interface AuthContextType {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isPremium: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<UserProfile>;
  register: (data: RegisterData) => Promise<{ phone: string; devOtp?: string }>;
  verifyOtp: (phone: string, code: string) => Promise<UserProfile>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  updateUser: (updates: Partial<UserProfile>) => void;
}

interface RegisterData {
  name: string;
  email: string;
  phone: string;
  password: string;
  role?: string;
  barNumber?: string;
  specializations?: string[];
  consultationFee?: number;
  bio?: string;
  yearsOfExperience?: number;
  practiceType?: string;
  // Citizen expanded-profile fields
  dob?: string;
  gender?: string;
  address?: string;
  civilStatus?: string;
  occupation?: string;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing token on mount
  useEffect(() => {
    const token = localStorage.getItem('ordinex_token');
    if (token) {
      authApi.getProfile()
        .then(({ user }) => setUser(user))
        .catch(() => {
          clearToken();
          setUser(null);
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  // Re-fetch tier flags from DB when tab regains focus (picks up demo sync / subscription changes)
  useEffect(() => {
    if (!user) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        authApi.getProfile()
          .then(({ user: fresh }) => setUser(fresh))
          .catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [user?.id]);

  const login = useCallback(async (email: string, password: string): Promise<UserProfile> => {
    const response = await authApi.login({
      email: email.trim().toLowerCase(),
      password: password.trim(),
    });
    setToken(response.token);
    setUser(response.user);
    return response.user;
  }, []);

  const register = useCallback(async (data: RegisterData): Promise<{ phone: string; devOtp?: string }> => {
    const response = await authApi.register(data);
    return { phone: response.phone, devOtp: (response as any).devOtp };
  }, []);

  const verifyOtp = useCallback(async (phone: string, code: string): Promise<UserProfile> => {
    const response = await authApi.verifyOtp({ phone, code });
    if (response.kycToken) {
      setKycToken(response.kycToken);
    }
    if (response.token) {
      setToken(response.token);
      setUser(response.user);
    }
    return response.user;
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
    window.location.href = '/';
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const { user } = await authApi.getProfile();
      setUser(user);
    } catch {
      clearToken();
      setUser(null);
    }
  }, []);

  const updateUser = useCallback((updates: Partial<UserProfile>) => {
    setUser(prev => prev ? { ...prev, ...updates } : null);
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      isPremium: user?.isPremium ?? false,
      isLoading,
      login,
      register,
      verifyOtp,
      logout,
      refreshUser,
      updateUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
