'use client';

import { useState } from 'react';
import { Loader2, Tag, X } from 'lucide-react';
import { formatCatalogPrice } from '@/modules/catalog/types';
import type { CouponDiscountType } from '@/modules/orders';
import { cn } from '@/lib/cn';

export type AppliedCoupon = {
  code: string;
  discountType: CouponDiscountType;
  discountCents: number;
};

type Props = {
  subtotalCents: number;
  deliveryFeeCents: number;
  productIds: string[];
  applied: AppliedCoupon | null;
  onChange: (coupon: AppliedCoupon | null) => void;
};

const REASON_LABEL: Record<string, string> = {
  not_found: 'Cupom não encontrado.',
  inactive: 'Este cupom não está mais ativo.',
  expired: 'Este cupom expirou.',
  not_started: 'Este cupom ainda não está valendo.',
  exhausted: 'Este cupom esgotou.',
  promo_conflict: 'Cupom não vale junto com itens em promoção.',
};

export function CouponField({
  subtotalCents,
  deliveryFeeCents,
  productIds,
  applied,
  onChange,
}: Props) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apply = async () => {
    const trimmed = code.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/coupons/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: trimmed,
          subtotalCents,
          deliveryFeeCents,
          productIds,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.coupon) {
        setError('Não foi possível validar o cupom.');
        return;
      }
      if (!json.coupon.valid) {
        setError(REASON_LABEL[json.coupon.reason] ?? 'Cupom inválido.');
        return;
      }
      onChange({
        code: json.coupon.code,
        discountType: json.coupon.discountType,
        discountCents: json.coupon.discountCents,
      });
      setCode('');
    } catch {
      setError('Falha de rede ao validar o cupom.');
    } finally {
      setBusy(false);
    }
  };

  if (applied) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-success/40 bg-success/5 px-3 py-2">
        <span className="flex items-center gap-1.5 text-sm font-medium text-success">
          <Tag className="size-4" />
          {applied.code}
          <span className="text-muted-foreground">
            {applied.discountType === 'free_shipping'
              ? '· frete grátis'
              : `· −${formatCatalogPrice(applied.discountCents)}`}
          </span>
        </span>
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-label="Remover cupom"
          className="rounded p-1 text-muted-foreground hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void apply();
            }
          }}
          placeholder="Cupom de desconto"
          maxLength={32}
          className={cn(
            'h-10 min-w-0 flex-1 rounded-md border border-input bg-card px-3 text-base uppercase outline-none',
            'transition-[border-color] focus-visible:border-ring',
          )}
        />
        <button
          type="button"
          onClick={() => void apply()}
          disabled={busy || !code.trim()}
          className="h-10 shrink-0 rounded-md border border-border px-4 text-sm font-semibold disabled:opacity-50"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : 'Aplicar'}
        </button>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
