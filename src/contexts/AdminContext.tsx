'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { ADMIN_EMAIL } from '@/config/admin';

export type AdminUser = {
  id: string;
  email: string;
  displayName: string;
};

type LoginResult = { ok: true } | { ok: false; message: string };

type LoginOptions = { captchaToken?: string; website?: string };

type AdminContextValue = {
  isAuthenticated: boolean;
  ready: boolean;
  admin: AdminUser | null;
  login: (
    email: string,
    password: string,
    options?: LoginOptions,
  ) => Promise<LoginResult>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
};

const AdminContext = createContext<AdminContextValue | null>(null);

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [ready, setReady] = useState(false);

  const refreshSession = useCallback(async () => {
    try {
      const response = await fetch('/api/v1/admin/session', {
        cache: 'no-store',
      });
      if (!response.ok) {
        setAdmin(null);
        return;
      }
      const json = await response.json();
      setAdmin(json.admin as AdminUser);
    } catch {
      setAdmin(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch('/api/v1/admin/session', {
          cache: 'no-store',
        });
        if (cancelled) return;
        if (!response.ok) {
          setAdmin(null);
          return;
        }
        const json = await response.json();
        setAdmin(json.admin as AdminUser);
      } catch {
        if (!cancelled) setAdmin(null);
      } finally {
        if (!cancelled) setReady(true);
      }
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  const login = useCallback(
    async (email: string, password: string, options?: LoginOptions) => {
      const response = await fetch('/api/v1/admin/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          captchaToken: options?.captchaToken,
          website: options?.website,
        }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok) {
        setAdmin(null);
        return {
          ok: false as const,
          message:
            json?.error?.message ?? 'Não foi possível entrar no painel.',
        };
      }
      setAdmin(json.admin as AdminUser);
      return { ok: true as const };
    },
    [],
  );

  const logout = useCallback(async () => {
    await fetch('/api/v1/admin/session', { method: 'DELETE' });
    setAdmin(null);
  }, []);

  return (
    <AdminContext.Provider
      value={{
        isAuthenticated: Boolean(admin),
        ready,
        admin,
        login,
        logout,
        refreshSession,
      }}
    >
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const context = useContext(AdminContext);
  if (!context) throw new Error('useAdmin must be within AdminProvider');
  return context;
}

export { ADMIN_EMAIL };
