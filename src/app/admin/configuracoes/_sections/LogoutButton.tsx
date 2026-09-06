'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, LogOut } from 'lucide-react';
import { useAppDialog } from '@/contexts/AppDialogContext';

type Props = {
  logout: () => Promise<unknown>;
};

export function LogoutButton({ logout }: Props) {
  const router = useRouter();
  const { confirm } = useAppDialog();
  const [loggingOut, setLoggingOut] = useState(false);

  return (
    <button
      type="button"
      disabled={loggingOut}
      onClick={async () => {
        const ok = await confirm({
          title: 'Encerrar sessão',
          description: 'Deseja encerrar a sessão administrativa?',
          confirmLabel: 'Sair',
          tone: 'destructive',
        });
        if (!ok) return;
        setLoggingOut(true);
        await logout();
        // Sem resetar `loggingOut`: a navegação desmonta a tela.
        router.replace('/admin/login');
      }}
      className="flex w-full items-center justify-center gap-2 rounded-lg border border-border py-3 text-sm font-semibold text-destructive disabled:opacity-60"
    >
      {loggingOut ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <LogOut className="size-4" />
      )}
      Sair do painel
    </button>
  );
}
