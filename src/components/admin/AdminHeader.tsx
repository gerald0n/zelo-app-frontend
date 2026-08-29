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
    <header className="flex min-h-14 items-center gap-2.5 border-b border-border bg-background px-3 pb-2.5 pt-2.5 max-lg:sticky max-lg:top-0 max-lg:z-30">
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
        <h1 className="text-lg font-bold tracking-[-0.3px]">{title}</h1>
        {subtitle ? (
          <p className="mt-0.5 text-[11px] text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      <span className="rounded-md bg-primary/10 px-2 py-1.5 text-[9px] font-bold tracking-[1px] text-primary">
        ADMIN
      </span>
    </header>
  );
}
