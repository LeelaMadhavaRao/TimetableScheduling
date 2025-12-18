"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { 
  validateSession, 
  logout as authLogout,
  AdminUser, 
  TimetableAdministrator, 
  UserRole,
  AuthSession
} from '@/lib/auth';

interface AuthContextType {
  user: AdminUser | TimetableAdministrator | { id: string; code: string; name: string } | null;
  role: UserRole | null;
  session: AuthSession | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (sessionToken: string, role: UserRole) => void;
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
        // Invalid session, clear storage
        localStorage.removeItem(SESSION_KEY);
        localStorage.removeItem(ROLE_KEY);
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

  const login = (sessionToken: string, userRole: UserRole) => {
    localStorage.setItem(SESSION_KEY, sessionToken);
    localStorage.setItem(ROLE_KEY, userRole);
    refreshSession();
  };

  const logout = async () => {
    const sessionToken = localStorage.getItem(SESSION_KEY);
    
    if (sessionToken) {
      await authLogout(sessionToken);
    }
    
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(ROLE_KEY);
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

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      // Redirect based on attempted role or default to faculty login
      const storedRole = localStorage.getItem(ROLE_KEY);
      if (storedRole === 'admin') {
        window.location.href = '/login/admin';
      } else if (storedRole === 'timetable_admin') {
        window.location.href = '/login/timetable-admin';
      } else {
        window.location.href = '/login/faculty';
      }
    } else if (!isLoading && isAuthenticated && allowedRoles && role && !allowedRoles.includes(role)) {
      // User authenticated but wrong role
      if (role === 'admin') {
        window.location.href = '/dashboard/admin';
      } else if (role === 'timetable_admin') {
        window.location.href = '/admin';
      } else {
        window.location.href = '/faculty';
      }
    }
  }, [isLoading, isAuthenticated, role, allowedRoles]);

  return { isLoading, isAuthenticated, role };
}
