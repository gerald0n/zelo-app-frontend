'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Receipt, Clock, Loader2 } from 'lucide-react';
import OrderCard from '@/components/OrderCard';
import { useAuth } from '@/contexts/AuthContext';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { useCart, type CartItem } from '@/modules/carts';
import { useShopExperience } from '@/contexts/ShopExperienceContext';
import { type CustomerOrderListItem } from '@/modules/orders/types';
import { cn } from '@/lib/cn';
import { mobilePageColumnClass } from '@/lib/layout';

type Tab = 'active' | 'history';

export default function PedidosPage() {
  const [tab, setTab] = useState<Tab>('active');
  const [orders, setOrders] = useState<CustomerOrderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const { isDesktop } = useResponsiveLayout();
  const router = useRouter();
  const { replaceItems } = useCart();
  const { notify } = useShopExperience();

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      if (cancelled) return;
      if (!user) {
        setOrders([]);
        setError(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/v1/orders?scope=${tab}`, {
          cache: 'no-store',
        });
        const json = await response.json();
        if (cancelled) return;
        if (!response.ok) {
          setError(
            json?.error?.message ?? 'Não foi possível carregar pedidos.',
          );
          setOrders([]);
          return;
        }
        setOrders(json.orders as CustomerOrderListItem[]);
      } catch {
        if (!cancelled) {
          setError('Falha de rede ao carregar pedidos.');
          setOrders([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [tab, user]);

  const reload = () => {
    if (!user) {
      setOrders([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    void (async () => {
      setError(null);
      try {
        const response = await fetch(`/api/v1/orders?scope=${tab}`, {
          cache: 'no-store',
        });
        const json = await response.json();
        if (!response.ok) {
          setError(
            json?.error?.message ?? 'Não foi possível carregar pedidos.',
          );
          setOrders([]);
          return;
        }
        setOrders(json.orders as CustomerOrderListItem[]);
      } catch {
        setError('Falha de rede ao carregar pedidos.');
        setOrders([]);
      } finally {
        setLoading(false);
      }
    })();
  };

  const handleReorder = async (orderId: string) => {
    try {
      const response = await fetch(`/api/v1/orders/${orderId}/reorder`, {
        method: 'POST',
      });
      const json = await response.json();
      if (!response.ok) {
        notify(json?.error?.message ?? 'Não foi possível pedir novamente.');
        return;
      }
      const items = json.items as CartItem[];
      if (items.length === 0) {
        notify('Nenhum item disponível para recompra.');
        return;
      }
      replaceItems(items);
      const unavailable = [
        ...(json.unavailableProducts as string[]),
        ...(json.unavailableAddOns as string[]),
      ];
      if (unavailable.length > 0) {
        notify(
          `Carrinho atualizado. Indisponíveis: ${unavailable.join(', ')}.`,
        );
      } else {
        notify('Itens adicionados ao carrinho.');
      }
      router.push('/carrinho');
    } catch {
      notify('Falha de rede na recompra.');
    }
  };

  return (
    <div className={cn('flex min-h-dvh flex-col bg-background', mobilePageColumnClass)}>
      <header className="space-y-2 border-b border-border px-3 pb-2 pt-3 max-lg:sticky max-lg:top-0 max-lg:z-30 max-lg:bg-background">
        <h1 className="text-lg font-bold tracking-[-0.4px]">
          Meus pedidos
        </h1>
        <div className="flex rounded-md bg-muted p-0.5">
          {(['active', 'history'] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                'flex-1 rounded-sm py-1.5 text-center text-sm',
                tab === t
                  ? 'bg-white font-semibold text-foreground'
                  : 'text-muted-foreground',
              )}
            >
              {t === 'active' ? 'Ativos' : 'Histórico'}
            </button>
          ))}
        </div>
      </header>

      <div
        className={cn(
          'min-h-0 flex-1 overflow-y-auto pt-2',
          isDesktop && 'mx-auto w-full max-w-[1180px] px-6 pt-6',
        )}
      >
        {loading ? (
          <div className="flex items-center justify-center gap-2 px-8 pt-10 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
            <p className="text-sm">Carregando pedidos…</p>
          </div>
        ) : !user ? (
          <div className="flex flex-col items-center gap-2 px-8 pt-10 text-center">
            <Receipt className="size-10 text-muted-foreground" />
            <p className="mt-1 text-base font-semibold">Entre para ver pedidos</p>
            <p className="text-sm leading-[18px] text-muted-foreground">
              Faça login para acompanhar seus pedidos e histórico.
            </p>
            <Link
              href="/checkout/identificacao"
              className="mt-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-white"
            >
              Entrar
            </Link>
          </div>
        ) : error ? (
          <div className="px-8 pt-10 text-center">
            <p className="text-sm text-destructive">{error}</p>
            <button
              type="button"
              onClick={reload}
              className="mt-3 text-sm font-medium text-primary"
            >
              Tentar novamente
            </button>
          </div>
        ) : tab === 'active' ? (
          orders.length > 0 ? (
            orders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                href={`/acompanhamento/${order.id}`}
              />
            ))
          ) : (
            <div className="flex flex-col items-center gap-2 px-8 pt-10 text-center">
              <Receipt className="size-10 text-muted-foreground" />
              <p className="mt-1 text-base font-semibold">
                Nenhum pedido ativo
              </p>
              <p className="text-sm leading-[18px] text-muted-foreground">
                Seus pedidos em andamento aparecem aqui.
              </p>
              <Link
                href="/"
                className="mt-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-white"
              >
                Ver cardápio
              </Link>
            </div>
          )
        ) : orders.length > 0 ? (
          orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              href={`/acompanhamento/${order.id}`}
              onReorder={() => void handleReorder(order.id)}
            />
          ))
        ) : (
          <div className="flex flex-col items-center gap-2 px-8 pt-10 text-center">
            <Clock className="size-10 text-muted-foreground" />
            <p className="mt-1 text-base font-semibold">
              Nenhum pedido anterior
            </p>
            <p className="text-sm leading-[18px] text-muted-foreground">
              Seu histórico de pedidos aparece aqui.
            </p>
          </div>
        )}
        <div className="h-4" />
      </div>
    </div>
  );
}
