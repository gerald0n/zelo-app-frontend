'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useAppDialog } from '@/contexts/AppDialogContext';
import { ApiError, apiJson } from '@/lib/api';
import {
  isoToLocal,
  localToIso,
  promotionSchema,
  promotionScopeLabels,
  type PromotionForm,
} from '@/app/catalogo/catalog-forms';
import { PromotionFormCard } from '@/app/catalogo/_tabs/PromotionFormCard';
import type {
  AdminCategory,
  AdminProduct,
  AdminPromotion,
} from '@/modules/admin/types';

type Props = {
  categories: AdminCategory[];
  products: AdminProduct[];
  promotions: AdminPromotion[];
  invalidateCatalog: () => Promise<void>;
  onError: (message: string) => void;
};

export function PromotionsTab({
  categories,
  products,
  promotions,
  invalidateCatalog,
  onError,
}: Props) {
  const { confirm } = useAppDialog();
  const [editingPromotion, setEditingPromotion] =
    useState<AdminPromotion | null>(null);
  const [showPromotionForm, setShowPromotionForm] = useState(false);

  const promotionForm = useForm<PromotionForm>({
    resolver: zodResolver(promotionSchema),
    defaultValues: {
      name: '',
      scope: 'store',
      discountPercent: 10,
      startsAt: '',
      endsAt: '',
      isActive: true,
      categoryIds: [],
      productIds: [],
    },
  });

  const promotionMutation = useMutation({
    mutationFn: async (values: PromotionForm) => {
      const payload = {
        name: values.name,
        scope: values.scope,
        discountPercent: values.discountPercent,
        startsAt: localToIso(values.startsAt),
        endsAt: localToIso(values.endsAt),
        isActive: values.isActive,
        categoryIds: values.scope === 'category' ? values.categoryIds : [],
        productIds: values.scope === 'products' ? values.productIds : [],
      };
      if (editingPromotion) {
        return apiJson(`/api/v1/admin/promotions/${editingPromotion.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      }
      return apiJson('/api/v1/admin/promotions', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    onSuccess: async () => {
      setShowPromotionForm(false);
      setEditingPromotion(null);
      onError('');
      promotionForm.reset();
      await invalidateCatalog();
    },
    onError: (error) => {
      onError(
        error instanceof ApiError ? error.message : 'Falha ao salvar promoção.',
      );
    },
  });

  const deletePromotionMutation = useMutation({
    mutationFn: (promotionId: string) =>
      apiJson(`/api/v1/admin/promotions/${promotionId}`, { method: 'DELETE' }),
    onSuccess: invalidateCatalog,
  });

  const openPromotionForm = (promotion?: AdminPromotion) => {
    onError('');
    setEditingPromotion(promotion ?? null);
    promotionForm.reset(
      promotion
        ? {
            name: promotion.name,
            scope: promotion.scope,
            discountPercent: promotion.discountPercent,
            startsAt: isoToLocal(promotion.startsAt),
            endsAt: isoToLocal(promotion.endsAt),
            isActive: promotion.isActive,
            categoryIds: promotion.categoryIds,
            productIds: promotion.productIds,
          }
        : {
            name: '',
            scope: 'store',
            discountPercent: 10,
            startsAt: '',
            endsAt: '',
            isActive: true,
            categoryIds: [],
            productIds: [],
          },
    );
    setShowPromotionForm(true);
  };

  return (
    <section className="space-y-3">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => openPromotionForm()}
          className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-white transition-[background-color,transform] duration-100 hover:bg-primary/90 active:scale-[0.97] disabled:active:scale-100"
        >
          <Plus className="size-3.5" />
          Nova promoção
        </button>
      </div>

      {showPromotionForm ? (
        <PromotionFormCard
          form={promotionForm}
          editingPromotion={editingPromotion !== null}
          categories={categories}
          products={products}
          isPending={promotionMutation.isPending}
          onSubmit={(values) => promotionMutation.mutate(values)}
          onCancel={() => setShowPromotionForm(false)}
        />
      ) : null}

      <div className="space-y-2">
        {promotions.map((promotion) => (
          <div
            key={promotion.id}
            className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{promotion.name}</p>
              <p className="text-2xs text-muted-foreground">
                {promotion.discountPercent}% ·{' '}
                {promotionScopeLabels[promotion.scope]} ·{' '}
                {promotion.isActive ? 'Ativa' : 'Inativa'}
                {promotion.startsAt || promotion.endsAt
                  ? ` · ${
                      promotion.startsAt
                        ? new Date(promotion.startsAt).toLocaleDateString(
                            'pt-BR',
                          )
                        : 'sem início'
                    } – ${
                      promotion.endsAt
                        ? new Date(promotion.endsAt).toLocaleDateString('pt-BR')
                        : 'sem fim'
                    }`
                  : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={() => openPromotionForm(promotion)}
              className="rounded-md border border-border p-1.5"
            >
              <Pencil className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                void (async () => {
                  const ok = await confirm({
                    title: 'Remover promoção',
                    description: `Remover ${promotion.name}?`,
                    confirmLabel: 'Remover',
                    tone: 'destructive',
                  });
                  if (!ok) return;
                  deletePromotionMutation.mutate(promotion.id);
                })();
              }}
              className="rounded-md border border-border p-1.5 text-destructive"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}
        {promotions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma promoção cadastrada.
          </p>
        ) : null}
      </div>
    </section>
  );
}
