'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { LogOut, Store } from 'lucide-react';
import { useGestorAuth } from '@/contexts/GestorAuthContext';

/** Sem chrome na tela de login — mesmo padrão do apps/admin. */
export default function GestorShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { admin, logout } = useGestorAuth();

  if (pathname === '/login') return <>{children}</>;

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border px-5 py-3">
        <Link href="/lojas" className="flex items-center gap-2">
          <Store className="size-5 text-primary" />
          <span className="text-sm font-bold tracking-tight">
            Gestor · Zelo Platform
          </span>
        </Link>
        {admin ? (
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              {admin.displayName}
            </span>
            <button
              type="button"
              onClick={async () => {
                await logout();
                router.replace('/login');
              }}
              aria-label="Sair"
              className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        ) : null}
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-6">
        {children}
      </main>
    </div>
  );
}
