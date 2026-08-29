'use client';

import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export function AccountAuthGate({
  children,
  title,
  description,
}: {
  children: React.ReactNode;
  title: string;
  description: string;
}) {
  const { user, identityReady } = useAuth();

  if (!identityReady) {
    return (
      <div className="flex flex-1 items-center justify-center py-10 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-1 flex-col items-center gap-2 px-8 pt-10 text-center">
        <p className="text-base font-semibold">{title}</p>
        <p className="text-[13px] leading-[18px] text-muted-foreground">
          {description}
        </p>
        <Link
          href="/checkout/identificacao"
          className="mt-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-white"
        >
          Entrar
        </Link>
      </div>
    );
  }

  return children;
}
