'use client';

import { usePathname } from 'next/navigation';
import { AdminProvider } from '@/contexts/AdminContext';
import AdminBottomNav from '@/components/admin/AdminBottomNav';
import { cn } from '@/lib/cn';

/**
 * Tudo do painel fica isolado nesta rota.
 *
 * `AdminProvider` e a navbar do admin saíram do `Providers` global — assim
 * não entram no bundle de quem só abre o cardápio. Libs pesadas usadas só
 * aqui (editor de imagem, kanban de pedidos, integração com impressora)
 * também ficam contidas em `/admin/*` pelo code-splitting por rota.
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isLogin = pathname === '/admin/login';

  return (
    <AdminProvider>
      <div
        className={cn(
          // Folga p/ a navbar flutuante do admin (mobile). Login não tem navbar.
          !isLogin &&
            'max-lg:pb-[calc(84px+env(safe-area-inset-bottom,0px))] lg:pb-0',
        )}
      >
        {children}
      </div>
      <AdminBottomNav />
    </AdminProvider>
  );
}
