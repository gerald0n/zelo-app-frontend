'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useRequireAdmin } from '@/hooks/useRequireAdmin';
import { adminContainerClass } from '@/lib/layout';
import { cn } from '@/lib/cn';
import type { ReviewStatus } from '@/modules/admin/types';
import { ReviewsList } from '@/app/avaliacoes/_components/ReviewsList';
import { ProductReviewsList } from '@/app/avaliacoes/_components/ProductReviewsList';

const TABS: Array<{ id: ReviewStatus; label: string }> = [
  { id: 'pending', label: 'Pendentes' },
  { id: 'approved', label: 'Aprovadas' },
  { id: 'hidden', label: 'Escondidas' },
];

const KINDS: Array<{ id: 'order' | 'product'; label: string }> = [
  { id: 'order', label: 'Dos pedidos' },
  { id: 'product', label: 'Dos produtos' },
];

export default function AdminAvaliacoesPage() {
  const { ready, isAuthenticated } = useRequireAdmin();
  const [kind, setKind] = useState<'order' | 'product'>('order');
  const [tab, setTab] = useState<ReviewStatus>('pending');

  if (!ready || !isAuthenticated) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'min-h-dvh space-y-4 p-3.5 pb-24 md:px-6 md:pt-6',
        adminContainerClass,
      )}
    >
      <header>
        <p className="text-2xs font-bold uppercase tracking-widest text-primary">
          Clientes
        </p>
        <h1 className="mt-1 font-serif text-2xl font-bold tracking-tight">
          Avaliações
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Nada aparece no site sem aprovação. As dos pedidos aprovadas e
          destacadas viram depoimento na home; as dos produtos aparecem na
          página do produto.
        </p>
      </header>

      <div className="flex gap-1.5">
        {KINDS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setKind(item.id)}
            className={cn(
              'rounded-full border px-3 py-1.5 text-2xs font-semibold transition-colors',
              kind === item.id
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card hover:bg-accent',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="flex gap-1.5">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={cn(
              'rounded-full border px-3 py-1.5 text-2xs font-semibold transition-colors',
              tab === item.id
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card hover:bg-accent',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {kind === 'order' ? (
        <ReviewsList status={tab} />
      ) : (
        <ProductReviewsList status={tab} />
      )}
    </div>
  );
}
