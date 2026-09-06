'use client';

import { useCallback, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import AdminSidebar from '@/components/admin/AdminSidebar';
import AdminBottomNav from '@/components/admin/AdminBottomNav';
import { useUiPref } from '@/hooks/useUiPref';
import { cn } from '@/lib/cn';

const COLLAPSE_KEY = 'zelo:admin-sidebar-collapsed';

/**
 * Molde do painel: sidebar fixa à esquerda (`lg`) + barra inferior (mobile),
 * com o conteúdo ocupando o resto da largura. O estado recolhido da sidebar
 * mora aqui para o padding do conteúdo acompanhar. A tela de login não tem
 * chrome.
 */
export default function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === '/login';
  const [raw, setRaw] = useUiPref(COLLAPSE_KEY, '0');
  const collapsed = raw === '1';

  const toggle = useCallback(() => {
    setRaw(collapsed ? '0' : '1');
  }, [collapsed, setRaw]);

  if (isLogin) return <>{children}</>;

  return (
    <>
      <AdminSidebar collapsed={collapsed} onToggle={toggle} />
      <div
        className={cn(
          'min-h-dvh bg-background transition-[padding] duration-200',
          'max-lg:pb-[calc(84px+env(safe-area-inset-bottom,0px))]',
          collapsed ? 'lg:pl-16' : 'lg:pl-60',
        )}
      >
        {children}
      </div>
      <AdminBottomNav />
    </>
  );
}
