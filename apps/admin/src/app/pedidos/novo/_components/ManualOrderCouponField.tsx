'use client';

import { useState } from 'react';
import { Loader2, Tag, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCatalogPrice } from '@/modules/catalog/types';
import type { CouponDiscountType } from '@/modules/orders/coupon-preview';

export type AppliedManualOrderCoupon = {
  code: string;
  discountType: CouponDiscountType;
  discountCents: number;
};

type Props = {
  subtotalCents: number;
  deliveryFeeCents: number;
  productIds: string[];
  applied: AppliedManualOrderCoupon | null;
  onChange: (coupon: AppliedManualOrderCoupon | null) => void;
};

const REASON_LABEL: Record<string, string> = {
  empty: 'Informe o código do cupom.',
  not_found: 'Cupom não encontrado.',
  inactive: 'Este cupom não está mais ativo.',
  expired: 'Este cupom expirou.',
  not_started: 'Este cupom ainda não está valendo.',
  exhausted: 'Este cupom esgotou.',
  promo_conflict: 'Cupom não vale junto com itens em promoção.',
};

/** Aplica e valida cupom na comanda manual antes de criar o pedido. */
export function ManualOrderCouponField({
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
      const res = await fetch('/api/v1/admin/orders/coupon-preview', {
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
        setError(json?.error?.message ?? 'Não foi possível validar o cupom.');
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
      <Label className="block text-xs font-semibold">
        Cupom
        <div className="mt-1 flex items-center justify-between rounded-md border border-success/40 bg-success/5 px-3 py-2">
          <span className="flex items-center gap-1.5 text-sm font-medium text-success">
            <Tag className="size-4" />
            {applied.code}
            <span className="text-muted-foreground">
              {applied.discountType === 'free_shipping'
                ? '· frete grátis'
                : applied.discountType === 'full_order'
                  ? '· pedido grátis'
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
      </Label>
    );
  }

  return (
    <div className="space-y-1.5">
      <Label className="block text-xs font-semibold">
        Cupom (opcional)
        <div className="mt-1 flex gap-2">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void apply();
              }
            }}
            placeholder="BOLO10"
            maxLength={32}
            className="h-10 flex-1 rounded-md border border-border px-3 text-sm uppercase"
          />
          <button
            type="button"
            onClick={() => void apply()}
            disabled={busy || !code.trim()}
            className="h-10 shrink-0 rounded-md border border-border px-4 text-xs font-semibold disabled:opacity-50"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : 'Aplicar'}
          </button>
        </div>
      </Label>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
