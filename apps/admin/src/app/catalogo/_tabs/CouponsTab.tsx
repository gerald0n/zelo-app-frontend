'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useAppDialog } from '@/contexts/AppDialogContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError, apiJson } from '@/lib/api';
import { removeCatalogItem, rollbackCatalog } from '@/lib/admin/catalog-cache';
import { formatCatalogPrice } from '@/modules/catalog/types';
import type { AdminCoupon, CouponDiscountType } from '@/modules/admin/types';
import { cn } from '@/lib/cn';

type Props = {
  coupons: AdminCoupon[];
  invalidateCatalog: () => Promise<void>;
  onError: (message: string) => void;
};

const TYPE_LABEL: Record<CouponDiscountType, string> = {
  percent: 'Percentual',
  fixed: 'Valor fixo',
  free_shipping: 'Frete grátis',
};

type FormState = {
  code: string;
  discountType: CouponDiscountType;
  /** Reais para `fixed`, número puro para `percent`. */
  value: string;
  maxUses: string;
  isActive: boolean;
};

const EMPTY: FormState = {
  code: '',
  discountType: 'percent',
  value: '',
  maxUses: '100',
  isActive: true,
};

function toForm(c: AdminCoupon): FormState {
  return {
    code: c.code,
    discountType: c.discountType,
    value:
      c.discountType === 'fixed'
        ? (c.discountValue / 100).toString()
        : c.discountType === 'percent'
          ? c.discountValue.toString()
          : '',
    maxUses: c.maxUses.toString(),
    isActive: c.isActive,
  };
}

export function CouponsTab({ coupons, invalidateCatalog, onError }: Props) {
  const { confirm } = useAppDialog();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<AdminCoupon | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        code: form.code.trim().toUpperCase(),
        discountType: form.discountType,
        discountValue:
          form.discountType === 'fixed'
            ? Math.round(parseFloat(form.value.replace(',', '.')) * 100)
            : form.discountType === 'percent'
              ? Math.round(parseFloat(form.value))
              : 0,
        maxUses: Math.round(parseFloat(form.maxUses)),
        isActive: form.isActive,
      };
      if (editing) {
        return apiJson(`/api/v1/admin/coupons/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      }
      return apiJson('/api/v1/admin/coupons', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    onSuccess: async () => {
      onError('');
      setShowForm(false);
      setEditing(null);
      setForm(EMPTY);
      await invalidateCatalog();
    },
    onError: (error) => {
      onError(
        error instanceof ApiError ? error.message : 'Falha ao salvar o cupom.',
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiJson(`/api/v1/admin/coupons/${id}`, { method: 'DELETE' }),
    onMutate: (id) => {
      onError('');
      return removeCatalogItem(queryClient, 'coupons', id);
    },
    onError: (error, _id, context) => {
      rollbackCatalog(queryClient, context);
      onError(
        error instanceof ApiError ? error.message : 'Falha ao remover o cupom.',
      );
    },
    onSettled: invalidateCatalog,
  });

  const openForm = (coupon?: AdminCoupon) => {
    onError('');
    setEditing(coupon ?? null);
    setForm(coupon ? toForm(coupon) : EMPTY);
    setShowForm(true);
  };

  return (
    <section className="space-y-3">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => openForm()}
          className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-white transition-[background-color,transform] duration-100 hover:bg-primary/90 active:scale-[0.97]"
        >
          <Plus className="size-3.5" />
          Novo cupom
        </button>
      </div>

      {showForm ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveMutation.mutate();
          }}
          className="space-y-3 rounded-lg border border-border bg-card p-3.5"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Label className="block text-xs font-semibold">
              Código
              <Input
                value={form.code}
                onChange={(e) => set('code', e.target.value.toUpperCase())}
                maxLength={32}
                placeholder="BOLO10"
                className="mt-1 h-10 w-full rounded-md border border-border px-3 text-sm uppercase"
              />
            </Label>
            <label className="block text-xs font-semibold">
              Tipo
              <select
                value={form.discountType}
                onChange={(e) =>
                  set('discountType', e.target.value as CouponDiscountType)
                }
                className="mt-1 h-10 w-full rounded-md border border-border px-3 text-sm"
              >
                <option value="percent">Percentual</option>
                <option value="fixed">Valor fixo (R$)</option>
                <option value="free_shipping">Frete grátis</option>
              </select>
            </label>
            {form.discountType !== 'free_shipping' ? (
              <Label className="block text-xs font-semibold">
                {form.discountType === 'percent'
                  ? 'Desconto (%)'
                  : 'Desconto (R$)'}
                <Input
                  type="number"
                  step={form.discountType === 'percent' ? '1' : '0.01'}
                  min={form.discountType === 'percent' ? 1 : 0.01}
                  max={form.discountType === 'percent' ? 100 : undefined}
                  value={form.value}
                  onChange={(e) => set('value', e.target.value)}
                  className="mt-1 h-10 w-full rounded-md border border-border px-3 text-sm"
                />
              </Label>
            ) : null}
            <Label className="block text-xs font-semibold">
              Limite de usos
              <Input
                type="number"
                min={editing ? editing.usesCount : 1}
                step={1}
                value={form.maxUses}
                onChange={(e) => set('maxUses', e.target.value)}
                className="mt-1 h-10 w-full rounded-md border border-border px-3 text-sm"
              />
            </Label>
          </div>
          <Label className="inline-flex items-center gap-2 text-xs font-semibold">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => set('isActive', e.target.checked)}
            />
            Ativo
          </Label>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saveMutation.isPending}
              className="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
            >
              {saveMutation.isPending ? 'Salvando…' : 'Salvar'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-md border border-border px-3 py-2 text-xs font-semibold"
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : null}

      {coupons.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Nenhum cupom ainda.
        </p>
      ) : (
        <div className="space-y-2">
          {coupons.map((coupon) => (
            <div
              key={coupon.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold tabular-nums">
                  {coupon.code}
                  {!coupon.isActive ? (
                    <span className="ml-2 rounded-full bg-muted px-1.5 py-0.5 text-2xs font-semibold text-muted-foreground">
                      Inativo
                    </span>
                  ) : null}
                </p>
                <p className="text-2xs text-muted-foreground">
                  {TYPE_LABEL[coupon.discountType]}
                  {coupon.discountType === 'percent'
                    ? ` ${coupon.discountValue}%`
                    : coupon.discountType === 'fixed'
                      ? ` ${formatCatalogPrice(coupon.discountValue)}`
                      : ''}{' '}
                  · usos {coupon.usesCount}/{coupon.maxUses}
                </p>
              </div>
              <button
                type="button"
                onClick={() => openForm(coupon)}
                aria-label="Editar cupom"
                className="rounded-md border border-border p-1.5 text-muted-foreground"
              >
                <Pencil className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  void (async () => {
                    const ok = await confirm({
                      title: 'Remover cupom',
                      description: `Remover ${coupon.code}? O histórico dos pedidos que já usaram fica intacto.`,
                      confirmLabel: 'Remover',
                      tone: 'destructive',
                    });
                    if (ok) deleteMutation.mutate(coupon.id);
                  })();
                }}
                aria-label="Remover cupom"
                className={cn(
                  'rounded-md border border-border p-1.5 text-destructive',
                  deleteMutation.isPending && 'opacity-50',
                )}
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
