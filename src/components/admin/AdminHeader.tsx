'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

type Props = {
  title: string;
  subtitle?: string;
  backTo?: '/admin' | '/admin/pedidos';
};

export default function AdminHeader({ title, subtitle, backTo }: Props) {
  return (
    <header className="sticky top-0 z-30 flex min-h-14 items-center gap-2.5 border-b border-border bg-background px-3 pb-2.5 pt-2.5 lg:px-6">
      {backTo ? (
        <Link
          href={backTo}
          aria-label="Voltar"
          className="flex size-9 items-center justify-center"
        >
          <ArrowLeft className="size-[22px]" />
        </Link>
      ) : null}
      <div className="flex-1">
        <h1 className="text-lg font-bold tracking-tight">{title}</h1>
        {subtitle ? (
          <p className="mt-0.5 text-2xs text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      <span className="rounded-md bg-primary/10 px-2 py-1.5 text-2xs font-bold tracking-widest text-primary">
        ADMIN
      </span>
    </header>
  );
}
