'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { createCustomerSupabaseClient } from '@/lib/supabase/customer-client';
import { resetCustomerRealtimeAuth } from '@/modules/realtime/ensure-customer-auth';
import { clearReconciledMarker } from '@/modules/carts/reconcile-marker';
import { hasCustomerName } from '@/modules/auth/customer-name';

export type AuthUser = {
  id?: string;
  phone: string;
  name: string;
};

type RequestOtpResult =
  | {
      ok: true;
      debugCode?: string;
      deliveredVia?: 'sms' | 'debug';
    }
  | { ok: false; message: string };

type VerifyOtpResult =
  { ok: true; needsName: boolean } | { ok: false; message: string };

type UpdateProfileResult = { ok: true } | { ok: false; message: string };

type AuthContextType = {
  user: AuthUser | null;
  pendingPhone: string;
  setPendingPhone: (phone: string) => void;
  requestOtp: (
    phone: string,
    options?: { captchaToken?: string; website?: string },
  ) => Promise<RequestOtpResult>;
  verifyOtp: (phone: string, code: string) => Promise<VerifyOtpResult>;
  updateProfile: (name: string) => Promise<UpdateProfileResult>;
  signOut: () => Promise<void>;
  identityReady: boolean;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [pendingPhone, setPendingPhone] = useState('');
  const [identityReady, setIdentityReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/v1/auth/me');
        if (!response.ok) {
          if (!cancelled) setIdentityReady(true);
          return;
        }
        const json = await response.json();
        const customer = json?.customer;
        if (!cancelled && customer) {
          setUser({
            id: customer.id,
            phone: customer.phoneE164,
            name: customer.name,
          });
        }
      } catch {
        // Ambiente sem sessão — segue como visitante.
      } finally {
        if (!cancelled) setIdentityReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const requestOtp = useCallback(
    async (
      phone: string,
      options?: { captchaToken?: string; website?: string },
    ) => {
      try {
        const response = await fetch('/api/v1/auth/otp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone,
            captchaToken: options?.captchaToken,
            website: options?.website,
          }),
        });
        const json = await response.json().catch(() => null);
        if (!response.ok) {
          return {
            ok: false as const,
            message:
              json?.error?.message ?? 'Não foi possível enviar o código.',
          };
        }
        return {
          ok: true as const,
          debugCode:
            typeof json?.debugCode === 'string' ? json.debugCode : undefined,
          deliveredVia:
            json?.deliveredVia === 'sms' || json?.deliveredVia === 'debug'
              ? json.deliveredVia
              : undefined,
        };
      } catch {
        return {
          ok: false as const,
          message: 'Falha de rede ao enviar o código.',
        };
      }
    },
    [],
  );

  const verifyOtp = useCallback(async (phone: string, code: string) => {
    try {
      const response = await fetch('/api/v1/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok) {
        return {
          ok: false as const,
          message: json?.error?.message ?? 'Código inválido.',
        };
      }
      const customer = json?.customer;
      if (customer) {
        setUser({
          id: customer.id,
          phone: customer.phoneE164,
          name: customer.name ?? '',
        });
      }
      resetCustomerRealtimeAuth();
      return {
        ok: true as const,
        needsName:
          customer?.needsName === true || !hasCustomerName(customer?.name),
      };
    } catch {
      return {
        ok: false as const,
        message: 'Falha de rede ao validar o código.',
      };
    }
  }, []);

  const updateProfile = useCallback(async (name: string) => {
    try {
      const response = await fetch('/api/v1/auth/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok) {
        return {
          ok: false as const,
          message: json?.error?.message ?? 'Não foi possível salvar.',
        };
      }
      const customer = json?.customer;
      if (customer) {
        setUser({
          id: customer.id,
          phone: customer.phoneE164,
          name: customer.name,
        });
      }
      return { ok: true as const };
    } catch {
      return { ok: false as const, message: 'Falha de rede ao salvar.' };
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await fetch('/api/v1/auth/session', { method: 'DELETE' });
    } catch {
      /* ignore */
    }
    try {
      await createCustomerSupabaseClient().auth.signOut();
    } catch {
      /* ignore */
    }
    resetCustomerRealtimeAuth();
    clearReconciledMarker();
    setUser(null);
    setPendingPhone('');
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        pendingPhone,
        setPendingPhone,
        requestOtp,
        verifyOtp,
        updateProfile,
        signOut,
        identityReady,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be within AuthProvider');
  return ctx;
}
