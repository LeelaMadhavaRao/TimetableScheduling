"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import {
  validateSession,
  logout as authLogout,
  AuthUser,
  UserRole,
  AuthSession,
  ROLE_HOME,
  ROLE_LOGIN,
} from '@/lib/auth';

interface AuthContextType {
  user: AuthUser | null;
  role: UserRole | null;
  session: AuthSession | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (sessionToken: string, role: UserRole) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SESSION_KEY = 'timetable_session_token';
const ROLE_KEY = 'timetable_user_role';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthContextType['user']>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    const sessionToken = localStorage.getItem(SESSION_KEY);

    if (!sessionToken) {
      setUser(null);
      setRole(null);
      setSession(null);
      setIsLoading(false);
      return;
    }

    try {
      const result = await validateSession(sessionToken);

      if (result.success && result.user && result.role) {
        setUser(result.user);
        setRole(result.role);
        setSession(result.session || null);
      } else {
        // Invalid session: drop the token but remember the role, so the user is sent back to
        // the right login page
        localStorage.removeItem(SESSION_KEY);
        setUser(null);
        setRole(null);
        setSession(null);
      }
    } catch (error) {
      console.error('Session refresh error:', error);
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(ROLE_KEY);
      setUser(null);
      setRole(null);
      setSession(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const login = async (sessionToken: string, userRole: UserRole) => {
    // Set in localStorage for client-side access
    localStorage.setItem(SESSION_KEY, sessionToken);
    localStorage.setItem(ROLE_KEY, userRole);

    // Also set cookies for server-side access (with Secure and SameSite flags)
    document.cookie = `${SESSION_KEY}=${sessionToken}; path=/; max-age=${24 * 60 * 60}; SameSite=Lax; Secure`;
    document.cookie = `${ROLE_KEY}=${userRole}; path=/; max-age=${24 * 60 * 60}; SameSite=Lax; Secure`;

    await refreshSession();
  };

  const logout = async () => {
    const sessionToken = localStorage.getItem(SESSION_KEY);

    if (sessionToken) {
      await authLogout(sessionToken);
    }

    // Clear localStorage
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(ROLE_KEY);

    // Clear cookies
    document.cookie = `${SESSION_KEY}=; path=/; max-age=0`;
    document.cookie = `${ROLE_KEY}=; path=/; max-age=0`;

    setUser(null);
    setRole(null);
    setSession(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        session,
        isLoading,
        isAuthenticated: !!user && !!role,
        login,
        logout,
        refreshSession
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Hook to require authentication
export function useRequireAuth(allowedRoles?: UserRole[]) {
  const { isAuthenticated, isLoading, role } = useAuth();
  const authorized = !isLoading && isAuthenticated && !!role && (!allowedRoles || allowedRoles.includes(role));

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      // Send the visitor to the login of the page they tried to open, else of their last role
      const storedRole = localStorage.getItem(ROLE_KEY) as UserRole | null;
      const target = allowedRoles?.[0] ?? storedRole;
      window.location.href = target && ROLE_LOGIN[target] ? ROLE_LOGIN[target] : ROLE_LOGIN.faculty;
    } else if (!isLoading && isAuthenticated && allowedRoles && role && !allowedRoles.includes(role)) {
      // User authenticated but wrong role
      window.location.href = ROLE_HOME[role] || '/';
    }
  }, [isLoading, isAuthenticated, role, allowedRoles]);

  return { isLoading, isAuthenticated, role, authorized };
}
