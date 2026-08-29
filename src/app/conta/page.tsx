'use client';

import Link from 'next/link';
import {
  ChevronRight,
  ShieldCheck,
  User,
  MapPin,
  Bell,
  Info,
  MessageCircle,
  LogOut,
  Receipt,
  Smartphone,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePwaInstall } from '@/contexts/PwaInstallContext';
import { useAppDialog } from '@/contexts/AppDialogContext';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/cn';
import { mobilePageColumnClass } from '@/lib/layout';

type MenuItem = {
  icon: React.ElementType;
  label: string;
  href?: string;
  onClick?: () => void;
  danger?: boolean;
};

export default function ContaPage() {
  const { user, signOut } = useAuth();
  const { canOfferInstall, openInstallPrompt } = usePwaInstall();
  const { isDesktop } = useResponsiveLayout();
  const { confirm } = useAppDialog();

  const initials = user?.name
    ? user.name
        .split(' ')
        .map((w) => w[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : '?';

  const handleSignOut = async () => {
    const ok = await confirm({
      title: 'Sair da conta',
      description: 'Deseja sair da sua conta neste dispositivo?',
      confirmLabel: 'Sair',
      tone: 'destructive',
    });
    if (!ok) return;
    await signOut();
  };

  const handleContact = async () => {
    try {
      const response = await fetch('/api/v1/catalog/store', { cache: 'no-store' });
      const json = await response.json().catch(() => null);
      const phone = json?.store?.whatsappE164 as string | undefined;
      if (phone) {
        window.open(`https://wa.me/${phone.replace(/\D/g, '')}`, '_blank');
        return;
      }
    } catch {
      /* fallback abaixo */
    }
    window.location.href = '/loja';
  };

  const menuItems: MenuItem[] = [
    {
      icon: Receipt,
      label: 'Meus pedidos',
      href: '/pedidos',
    },
    {
      icon: ShieldCheck,
      label: 'Painel administrativo',
      href: '/admin/login',
    },
    {
      icon: User,
      label: 'Dados pessoais',
      href: '/conta/dados',
    },
    {
      icon: MapPin,
      label: 'Meus endereços',
      href: '/conta/enderecos',
    },
    {
      icon: Bell,
      label: 'Notificações',
      href: '/conta/notificacoes',
    },
    ...(canOfferInstall
      ? [
          {
            icon: Smartphone,
            label: 'Adicionar à tela inicial',
            onClick: openInstallPrompt,
          } satisfies MenuItem,
        ]
      : []),
    {
      icon: Info,
      label: 'Informações da Zelo',
      href: '/loja',
    },
    {
      icon: MessageCircle,
      label: 'Fale conosco',
      onClick: () => void handleContact(),
    },
    ...(user
      ? [
          {
            icon: LogOut,
            label: 'Sair',
            onClick: handleSignOut,
            danger: true,
          } satisfies MenuItem,
        ]
      : []),
  ];

  return (
    <div className={cn('flex min-h-dvh flex-col bg-background', mobilePageColumnClass)}>
      <div
        className={cn(
          'min-h-0 flex-1 space-y-2.5 overflow-y-auto p-3',
          isDesktop && 'mx-auto w-full max-w-[1120px] p-8',
        )}
      >
        <div className="flex items-center gap-3 rounded-lg border border-border bg-white p-3">
          <div className="flex size-11 items-center justify-center rounded-full bg-muted">
            <span className="text-base font-bold text-primary">{initials}</span>
          </div>
          <div className="flex-1">
            {user ? (
              <>
                <p className="text-base font-semibold">{user.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {user.phone}
                </p>
              </>
            ) : (
              <>
                <p className="text-base font-semibold">Visitante</p>
                <Link
                  href="/checkout/identificacao"
                  className="mt-0.5 text-sm font-medium text-primary"
                >
                  Entrar ou criar conta
                </Link>
              </>
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-border bg-white">
          {menuItems.map((item, index) => {
            const Icon = item.icon;
            const content = (
              <>
                <Icon
                  className={cn(
                    'size-[18px]',
                    item.danger ? 'text-destructive' : 'text-foreground',
                  )}
                />
                <span
                  className={cn(
                    'flex-1 text-sm',
                    item.danger ? 'text-destructive' : 'text-foreground',
                  )}
                >
                  {item.label}
                </span>
                <ChevronRight className="size-3.5 text-muted-foreground" />
              </>
            );
            return (
              <div key={item.label}>
                {item.href ? (
                  <Link
                    href={item.href}
                    className="flex items-center gap-3 px-3 py-[11px]"
                  >
                    {content}
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={item.onClick}
                    className="flex w-full items-center gap-3 px-3 py-[11px] text-left"
                  >
                    {content}
                  </button>
                )}
                {index < menuItems.length - 1 ? (
                  <div className="ml-[42px]">
                    <Separator />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        <p className="mt-1 text-center text-2xs text-muted-foreground">
          Zelo Confeitaria · v1.0.0
        </p>
      </div>
    </div>
  );
}
