'use client';

import { useEffect, useState } from 'react';
import { createEphemeralSupabaseClient } from '@/lib/supabase/ephemeral';
import { createCustomerSupabaseClient } from '@/lib/supabase/customer-client';
import { ensureCustomerRealtimeAuth } from '@/modules/realtime/ensure-customer-auth';
import type { RealtimeChannel } from '@supabase/supabase-js';

export type RealtimeStatus =
  | 'idle'
  | 'connecting'
  | 'subscribed'
  | 'reconnecting'
  | 'error';

function bindVisibilityRefetch(onSignal: () => void) {
  const handler = () => {
    if (document.visibilityState === 'visible') onSignal();
  };
  document.addEventListener('visibilitychange', handler);
  window.addEventListener('online', handler);
  return () => {
    document.removeEventListener('visibilitychange', handler);
    window.removeEventListener('online', handler);
  };
}

/**
 * Canal administrativo: novos pedidos e mudanças de status (RLS admin).
 * Retorna um contador que incrementa a cada sinal — a UI deve refetch o estado persistido.
 */
export function useAdminOrdersRealtime(enabled: boolean) {
  const [status, setStatus] = useState<RealtimeStatus>('idle');
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!enabled) return;

    let channel: RealtimeChannel | null = null;
    let cancelled = false;
    let supabase: ReturnType<typeof createEphemeralSupabaseClient> | null =
      null;

    const bump = () => {
      setVersion((current) => current + 1);
    };

    const connect = async () => {
      if (cancelled) return;
      setStatus((current) =>
        current === 'subscribed' ? 'reconnecting' : 'connecting',
      );

      try {
        const response = await fetch('/api/v1/admin/realtime', {
          method: 'POST',
          cache: 'no-store',
        });
        const json = (await response.json().catch(() => null)) as {
          accessToken?: string;
          refreshToken?: string;
        } | null;
        if (!response.ok || !json?.accessToken || !json.refreshToken) {
          setStatus('error');
          return;
        }

        supabase = createEphemeralSupabaseClient();
        const { error } = await supabase.auth.setSession({
          access_token: json.accessToken,
          refresh_token: json.refreshToken,
        });
        if (error) {
          setStatus('error');
          return;
        }
      } catch {
        setStatus('error');
        return;
      }

      if (!supabase) return;

      channel = supabase
        .channel('admin-orders')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'orders' },
          bump,
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'order_status_history' },
          bump,
        )
        .subscribe((subscribeStatus) => {
          if (cancelled) return;
          if (subscribeStatus === 'SUBSCRIBED') {
            setStatus('subscribed');
            bump();
          } else if (
            subscribeStatus === 'CHANNEL_ERROR' ||
            subscribeStatus === 'TIMED_OUT'
          ) {
            setStatus('error');
          }
        });
    };

    const timer = window.setTimeout(() => {
      void connect();
    }, 0);
    const unbind = bindVisibilityRefetch(bump);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      unbind();
      if (channel && supabase) {
        void supabase.removeChannel(channel);
      }
    };
  }, [enabled]);

  return { status: enabled ? status : 'idle', version };
}

/**
 * Canal do Pedido do Cliente: apenas o próprio pedido (RLS).
 */
export function useCustomerOrderRealtime(
  orderId: string | null,
  enabled: boolean,
) {
  const [status, setStatus] = useState<RealtimeStatus>('idle');
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!enabled || !orderId) return;

    let channel: RealtimeChannel | null = null;
    let cancelled = false;
    let supabase: ReturnType<typeof createCustomerSupabaseClient> | null =
      null;

    const bump = () => {
      setVersion((current) => current + 1);
    };

    const connect = async () => {
      setStatus((current) =>
        current === 'subscribed' ? 'reconnecting' : 'connecting',
      );
      const ok = await ensureCustomerRealtimeAuth();
      if (cancelled) return;
      if (!ok) {
        setStatus('error');
        return;
      }

      try {
        supabase = createCustomerSupabaseClient();
      } catch {
        setStatus('error');
        return;
      }

      channel = supabase
        .channel(`customer-order-${orderId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'orders',
            filter: `id=eq.${orderId}`,
          },
          bump,
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'order_status_history',
            filter: `order_id=eq.${orderId}`,
          },
          bump,
        )
        .subscribe((subscribeStatus) => {
          if (cancelled) return;
          if (subscribeStatus === 'SUBSCRIBED') {
            setStatus('subscribed');
            bump();
          } else if (
            subscribeStatus === 'CHANNEL_ERROR' ||
            subscribeStatus === 'TIMED_OUT'
          ) {
            setStatus('error');
          }
        });
    };

    const timer = window.setTimeout(() => {
      void connect();
    }, 0);
    const unbind = bindVisibilityRefetch(bump);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      unbind();
      if (channel && supabase) {
        void supabase.removeChannel(channel);
      }
    };
  }, [orderId, enabled]);

  return {
    status: enabled && orderId ? status : 'idle',
    version,
  };
}
