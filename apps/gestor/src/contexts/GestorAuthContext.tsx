'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

export type GestorUser = {
  id: string;
  email: string;
  displayName: string;
};

type LoginResult = { ok: true } | { ok: false; message: string };

type GestorAuthContextValue = {
  isAuthenticated: boolean;
  ready: boolean;
  admin: GestorUser | null;
  login: (email: string, password: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
};

const GestorAuthContext = createContext<GestorAuthContextValue | null>(null);

const SESSION_REQUEST_TIMEOUT_MS = 20_000;

export function GestorAuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [admin, setAdmin] = useState<GestorUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/v1/session', {
          cache: 'no-store',
          signal: AbortSignal.timeout(SESSION_REQUEST_TIMEOUT_MS),
        });
        if (cancelled) return;
        if (!response.ok) {
          setAdmin(null);
          return;
        }
        const json = await response.json();
        setAdmin(json.admin as GestorUser);
      } catch {
        if (!cancelled) setAdmin(null);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    let response: Response;
    try {
      response = await fetch('/api/v1/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        cache: 'no-store',
        signal: AbortSignal.timeout(SESSION_REQUEST_TIMEOUT_MS),
      });
    } catch {
      setAdmin(null);
      return { ok: false as const, message: 'Falha de rede ao entrar.' };
    }
    const json = await response.json().catch(() => null);
    if (!response.ok) {
      setAdmin(null);
      return {
        ok: false as const,
        message: json?.error?.message ?? 'Não foi possível entrar.',
      };
    }
    setAdmin(json.admin as GestorUser);
    return { ok: true as const };
  }, []);

  const logout = useCallback(async () => {
    await fetch('/api/v1/session', { method: 'DELETE' });
    setAdmin(null);
  }, []);

  return (
    <GestorAuthContext.Provider
      value={{
        isAuthenticated: Boolean(admin),
        ready,
        admin,
        login,
        logout,
      }}
    >
      {children}
    </GestorAuthContext.Provider>
  );
}

export function useGestorAuth() {
  const context = useContext(GestorAuthContext);
  if (!context) {
    throw new Error('useGestorAuth must be within GestorAuthProvider');
  }
  return context;
}
