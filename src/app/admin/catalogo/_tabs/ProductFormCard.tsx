'use client';

import { useWatch, type UseFormReturn } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/cn';
import type { ProductForm } from '@/app/admin/catalogo/catalog-forms';
import type { AdminAddon, AdminCategory } from '@/modules/admin/types';

type Props = {
  form: UseFormReturn<ProductForm>;
  editingProduct: boolean;
  categories: AdminCategory[];
  addons: AdminAddon[];
  isPending: boolean;
  onSubmit: (values: ProductForm) => void;
  onCancel: () => void;
};

export function ProductFormCard({
  form,
  editingProduct,
  categories,
  addons,
  isPending,
  onSubmit,
  onCancel,
}: Props) {
  const selectedAddonIds =
    useWatch({ control: form.control, name: 'addonIds' }) ?? [];

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3 p-4">
      <p className="font-serif text-base font-bold">
        {editingProduct ? 'Editar produto' : 'Novo produto'}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Label className="block text-xs font-semibold">
          Nome
          <Input
            {...form.register('name')}
            className="mt-1 h-10 w-full rounded-md border border-border px-3 text-sm"
          />
        </Label>
        <label className="block text-xs font-semibold">
          Categoria
          <select
            {...form.register('categoryId')}
            className="mt-1 h-10 w-full rounded-md border border-border px-3 text-sm"
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <Label className="block text-xs font-semibold">
          Preço (R$)
          <Input
            type="number"
            step="0.01"
            {...form.register('priceReais', { valueAsNumber: true })}
            className="mt-1 h-10 w-full rounded-md border border-border px-3 text-sm"
          />
        </Label>
        <Label className="block text-xs font-semibold">
          Ordem
          <Input
            type="number"
            {...form.register('sortOrder', { valueAsNumber: true })}
            className="mt-1 h-10 w-full rounded-md border border-border px-3 text-sm"
          />
        </Label>
        <Label className="block text-xs font-semibold">
          Estoque (deixe vazio para ilimitado)
          <Input
            type="number"
            min={0}
            step={1}
            {...form.register('stockQuantity')}
            className="mt-1 h-10 w-full rounded-md border border-border px-3 text-sm"
          />
        </Label>
        <Label className="block text-xs font-semibold sm:col-span-2">
          Descrição
          <Textarea
            {...form.register('description')}
            rows={3}
            className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
          />
        </Label>
      </div>
      <div className="flex flex-wrap gap-4 text-xs">
        <Label className="inline-flex items-center gap-2 font-semibold">
          <input type="checkbox" {...form.register('isActive')} />
          Ativo
        </Label>
        <Label className="inline-flex items-center gap-2 font-semibold">
          <input type="checkbox" {...form.register('isAvailable')} />
          Disponível
        </Label>
      </div>
      {addons.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold">Adicionais</p>
          <div className="flex flex-wrap gap-2">
            {addons.map((addon) => {
              const selected = selectedAddonIds.includes(addon.id);
              return (
                <button
                  key={addon.id}
                  type="button"
                  onClick={() => {
                    const current = form.getValues('addonIds');
                    form.setValue(
                      'addonIds',
                      selected
                        ? current.filter((id) => id !== addon.id)
                        : [...current, addon.id],
                    );
                  }}
                  className={cn(
                    'rounded-md border px-2.5 py-1 text-2xs font-semibold',
                    selected
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border',
                  )}
                >
                  {addon.name}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-white transition-[background-color,transform] duration-100 hover:bg-primary/90 active:scale-[0.97] disabled:active:scale-100 disabled:opacity-60"
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
