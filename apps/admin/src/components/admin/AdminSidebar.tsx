'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  Grid2x2,
  Receipt,
  UtensilsCrossed,
  Star,
  Settings,
  Plus,
  PanelLeft,
  PanelLeftClose,
  Moon,
  Sun,
  LogOut,
  History,
} from 'lucide-react';
import { useAdmin } from '@/contexts/AdminContext';
import { useAdminRealtime } from '@/contexts/AdminRealtimeContext';
import { useNewOrder } from '@/contexts/AdminNewOrderContext';
import { apiJson } from '@/lib/api';
import { adminKeys } from '@/lib/query-keys';
import { useAppDialog } from '@/contexts/AppDialogContext';
import { useThemeToggle } from '@/hooks/useThemeToggle';
import AdminStoreToggle from '@/components/admin/AdminStoreToggle';
import { cn } from '@/lib/cn';

const NAV = [
  {
    href: '/',
    label: 'Visão geral',
    icon: Grid2x2,
    match: (p: string) => p === '/',
  },
  {
    href: '/pedidos',
    label: 'Pedidos',
    icon: Receipt,
    match: (p: string) => p.startsWith('/pedidos') || p.startsWith('/pedido'),
  },
  {
    href: '/historico',
    label: 'Histórico',
    icon: History,
    match: (p: string) => p.startsWith('/historico'),
  },
  {
    href: '/catalogo',
    label: 'Catálogo',
    icon: UtensilsCrossed,
    match: (p: string) => p.startsWith('/catalogo'),
  },
  {
    href: '/avaliacoes',
    label: 'Avaliações',
    icon: Star,
    match: (p: string) => p.startsWith('/avaliacoes'),
  },
  {
    href: '/configuracoes',
    label: 'Ajustes',
    icon: Settings,
    match: (p: string) => p.startsWith('/configuracoes'),
  },
];

type Props = { collapsed: boolean; onToggle: () => void };

/**
 * Sidebar fixa do painel (só `lg`). Concentra a marca, o status "Ao vivo",
 * a ação global "Nova comanda", o interruptor da loja e a navegação — o que
 * antes vivia espalhado no header de cada página. Recolhível (só ícones).
 */
export default function AdminSidebar({ collapsed, onToggle }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const { admin, logout } = useAdmin();
  const { status } = useAdminRealtime();
  const { open: openNewOrder } = useNewOrder();
  const { confirm } = useAppDialog();
  const { theme, toggle: toggleTheme } = useThemeToggle();

  const { data: pendingReviews } = useQuery({
    queryKey: adminKeys.reviewsPending(),
    queryFn: () =>
      apiJson<{ pending: number }>('/api/v1/admin/reviews?count=pending'),
    refetchInterval: 60_000,
  });
  const pendingCount = pendingReviews?.pending ?? 0;

  const live = status === 'subscribed';

  const handleLogout = async () => {
    const ok = await confirm({
      title: 'Encerrar sessão',
      description: 'Deseja sair do painel administrativo?',
      confirmLabel: 'Sair',
      tone: 'destructive',
    });
    if (!ok) return;
    await logout();
    router.replace('/login');
  };

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-50 hidden flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 lg:flex',
        collapsed ? 'w-16' : 'w-60',
      )}
    >
      <div
        className={cn(
          'flex items-center gap-2.5 px-3 py-3.5',
          collapsed && 'justify-center px-0',
        )}
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary font-serif text-lg font-bold text-primary-foreground">
          Z
        </span>
        {!collapsed ? (
          <div className="min-w-0 flex-1">
            <p className="truncate font-serif text-sm font-bold leading-tight">
              Zelo Confeitaria
            </p>
            <span className="mt-0.5 inline-flex items-center gap-1 text-2xs text-muted-foreground">
              <span
                className={cn(
                  'size-1.5 rounded-full',
                  live ? 'bg-success' : 'bg-muted-foreground/50',
                )}
              />
              {live ? 'Ao vivo' : 'Conectando…'}
            </span>
          </div>
        ) : null}
        {!collapsed ? (
          <button
            type="button"
            onClick={onToggle}
            aria-label="Recolher menu"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            <PanelLeftClose className="size-4" />
          </button>
        ) : null}
      </div>

      <div className={cn('space-y-2 px-3', collapsed && 'px-2')}>
        <button
          type="button"
          onClick={openNewOrder}
          title="Nova comanda"
          className={cn(
            'flex w-full items-center gap-2 rounded-lg bg-primary text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90',
            collapsed ? 'justify-center p-2.5' : 'px-3 py-2.5',
          )}
        >
          <Plus className="size-4 shrink-0" />
          {!collapsed ? 'Nova comanda' : null}
        </button>
        <AdminStoreToggle compact={collapsed} />
      </div>

      <nav
        className={cn('mt-4 flex-1 space-y-0.5 px-3', collapsed && 'px-2')}
        aria-label="Navegação administrativa"
      >
        {!collapsed ? (
          <p className="px-2 pb-1.5 text-2xs font-semibold uppercase tracking-widest text-muted-foreground">
            Menu principal
          </p>
        ) : null}
        {NAV.map((item) => {
          const active = item.match(pathname);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                collapsed && 'justify-center px-0',
                active
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground',
              )}
            >
              <Icon
                className="size-[19px] shrink-0"
                strokeWidth={active ? 2.25 : 1.75}
              />
              {!collapsed ? <span className="flex-1">{item.label}</span> : null}
              {item.href === '/avaliacoes' && pendingCount > 0 ? (
                <span
                  className={cn(
                    'inline-flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-2xs font-bold text-primary-foreground',
                    collapsed &&
                      'absolute right-1 top-1 min-w-3.5 px-0.5 text-[0.5rem]',
                  )}
                >
                  {pendingCount}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div
        className={cn(
          'space-y-1 border-t border-sidebar-border p-3',
          collapsed && 'px-2',
        )}
      >
        {collapsed ? (
          <button
            type="button"
            onClick={onToggle}
            aria-label="Expandir menu"
            className="flex w-full justify-center rounded-lg py-2 text-muted-foreground transition-colors hover:bg-sidebar-accent/50 hover:text-foreground"
          >
            <PanelLeft className="size-[19px]" />
          </button>
        ) : null}
        <button
          type="button"
          onClick={toggleTheme}
          className={cn(
            'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent/50 hover:text-foreground',
            collapsed && 'justify-center px-0',
          )}
          title="Alternar tema"
        >
          {theme === 'dark' ? (
            <Sun className="size-[19px] shrink-0" />
          ) : (
            <Moon className="size-[19px] shrink-0" />
          )}
          {!collapsed ? 'Alternar tema' : null}
        </button>
        <button
          type="button"
          onClick={handleLogout}
          className={cn(
            'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors hover:bg-destructive/10',
            collapsed && 'justify-center px-0',
          )}
          title="Sair do painel"
        >
          <LogOut className="size-[19px] shrink-0 text-muted-foreground" />
          {!collapsed ? (
            <span className="min-w-0 flex-1">
              <span className="block truncate text-foreground">
                {admin?.displayName ?? 'Administrador'}
              </span>
              <span className="block text-2xs text-muted-foreground">
                Sair do painel
              </span>
            </span>
          ) : null}
        </button>
      </div>
    </aside>
  );
}
