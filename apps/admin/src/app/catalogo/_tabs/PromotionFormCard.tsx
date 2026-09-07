'use client';

import { useWatch, type UseFormReturn } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  promotionScopeLabels,
  type PromotionForm,
} from '@/app/catalogo/catalog-forms';
import type { AdminCategory, AdminProduct, PromotionScope } from '@/modules/admin/types';

type Props = {
  form: UseFormReturn<PromotionForm>;
  editingPromotion: boolean;
  categories: AdminCategory[];
  products: AdminProduct[];
  isPending: boolean;
  onSubmit: (values: PromotionForm) => void;
  onCancel: () => void;
};

export function PromotionFormCard({
  form,
  editingPromotion,
  categories,
  products,
  isPending,
  onSubmit,
  onCancel,
}: Props) {
  const scope = useWatch({ control: form.control, name: 'scope' });
  const categoryIds =
    useWatch({ control: form.control, name: 'categoryIds' }) ?? [];
  const productIds =
    useWatch({ control: form.control, name: 'productIds' }) ?? [];

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="space-y-3 rounded-lg border border-border bg-card p-3.5"
    >
      <p className="text-sm font-semibold">
        {editingPromotion ? 'Editar promoção' : 'Nova promoção'}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Label className="block text-xs font-semibold">
          Nome
          <Input
            {...form.register('name')}
            className="mt-1 h-10 w-full rounded-md border border-border px-3 text-sm"
          />
        </Label>
        <Label className="block text-xs font-semibold">
          Desconto (%)
          <Input
            type="number"
            step="0.01"
            min={0}
            max={100}
            {...form.register('discountPercent', { valueAsNumber: true })}
            className="mt-1 h-10 w-full rounded-md border border-border px-3 text-sm"
          />
        </Label>
        <label className="block text-xs font-semibold">
          Abrangência
          <select
            {...form.register('scope')}
            className="mt-1 h-10 w-full rounded-md border border-border px-3 text-sm"
          >
            {(
              Object.entries(promotionScopeLabels) as Array<
                [PromotionScope, string]
              >
            ).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <Label className="inline-flex items-center gap-2 self-end pb-2 text-xs font-semibold">
          <input type="checkbox" {...form.register('isActive')} />
          Ativa
        </Label>
        <Label className="block text-xs font-semibold">
          Início (opcional)
          <Input
            type="datetime-local"
            {...form.register('startsAt')}
            className="mt-1 h-10 w-full rounded-md border border-border px-3 text-sm"
          />
        </Label>
        <Label className="block text-xs font-semibold">
          Fim (opcional)
          <Input
            type="datetime-local"
            {...form.register('endsAt')}
            className="mt-1 h-10 w-full rounded-md border border-border px-3 text-sm"
          />
        </Label>
      </div>

      {scope === 'category' ? (
        <div>
          <p className="mb-1.5 text-xs font-semibold">Categorias</p>
          <div className="max-h-40 space-y-1.5 overflow-y-auto rounded-md border border-border p-2">
            {categories.map((category) => (
              <label
                key={category.id}
                className="flex items-center gap-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={categoryIds.includes(category.id)}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? [...categoryIds, category.id]
                      : categoryIds.filter((id) => id !== category.id);
                    form.setValue('categoryIds', next);
                  }}
                />
                {category.name}
              </label>
            ))}
          </div>
        </div>
      ) : null}

      {scope === 'products' ? (
        <div>
          <p className="mb-1.5 text-xs font-semibold">Produtos</p>
          <div className="max-h-40 space-y-1.5 overflow-y-auto rounded-md border border-border p-2">
            {products.map((product) => (
              <label
                key={product.id}
                className="flex items-center gap-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={productIds.includes(product.id)}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? [...productIds, product.id]
                      : productIds.filter((id) => id !== product.id);
                    form.setValue('productIds', next);
                  }}
                />
                {product.name}
              </label>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-white transition-[background-color,transform] duration-100 hover:bg-primary/90 active:scale-[0.97] disabled:active:scale-100"
        >
          {isPending ? 'Salvando…' : 'Salvar'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-border px-3 py-2 text-xs font-semibold"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
