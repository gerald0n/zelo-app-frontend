'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useAppDialog } from '@/contexts/AppDialogContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError, apiJson } from '@/lib/api';
import { removeCatalogItem, rollbackCatalog } from '@/lib/admin/catalog-cache';
import { formatCatalogPrice } from '@/modules/catalog/types';
import {
  centsToReais,
  emptyPizzaAddonForm,
  pizzaAddonSchema,
  reaisToCents,
  type PizzaAddonForm,
} from '@/app/catalogo/catalog-forms';
import type { AdminPizzaAddon } from '@/modules/admin/types';

type Props = {
  pizzaAddons: AdminPizzaAddon[];
  invalidateCatalog: () => Promise<void>;
  onError: (message: string) => void;
};

export function PizzaAddonsTab({
  pizzaAddons,
  invalidateCatalog,
  onError,
}: Props) {
  const { confirm } = useAppDialog();
  const queryClient = useQueryClient();
  const [editingAddon, setEditingAddon] = useState<AdminPizzaAddon | null>(
    null,
  );
  const [showForm, setShowForm] = useState(false);

  const form = useForm<PizzaAddonForm>({
    resolver: zodResolver(pizzaAddonSchema),
    defaultValues: emptyPizzaAddonForm(),
  });

  const mutation = useMutation({
    mutationFn: async (values: PizzaAddonForm) => {
      const payload = {
        name: values.name,
        description: values.description || null,
        priceHalfCents: reaisToCents(values.priceHalfReais),
        priceFullCents: reaisToCents(values.priceFullReais),
        isActive: values.isActive,
      };
      if (editingAddon) {
        return apiJson(`/api/v1/admin/pizza-addons/${editingAddon.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      }
      return apiJson('/api/v1/admin/pizza-addons', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    onSuccess: async () => {
      setShowForm(false);
      setEditingAddon(null);
      onError('');
      form.reset(emptyPizzaAddonForm());
      await invalidateCatalog();
    },
    onError: (error) => {
      onError(
        error instanceof ApiError
          ? error.message
          : 'Falha ao salvar adicional de pizza.',
      );
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) =>
      apiJson(`/api/v1/admin/pizza-addons/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ archive: true }),
      }),
    onMutate: (id) => {
      onError('');
      return removeCatalogItem(queryClient, 'pizzaAddons', id);
    },
    onError: (error, _id, context) => {
      rollbackCatalog(queryClient, context);
      onError(
        error instanceof ApiError
          ? error.message
          : 'Falha ao arquivar o adicional de pizza.',
      );
    },
    onSettled: invalidateCatalog,
  });

  const openForm = (addon?: AdminPizzaAddon) => {
    onError('');
    setEditingAddon(addon ?? null);
    form.reset(
      addon
        ? {
            name: addon.name,
            description: addon.description ?? '',
            priceHalfReais: centsToReais(addon.priceHalfCents),
            priceFullReais: centsToReais(addon.priceFullCents),
            isActive: addon.isActive,
          }
        : emptyPizzaAddonForm(),
    );
    setShowForm(true);
  };

  return (
    <section className="space-y-3">
      <p className="max-w-prose text-xs text-muted-foreground">
        Adicionais específicos de pizza, com preço diferente se aplicados a
        uma metade ou à pizza toda.
      </p>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => openForm()}
          className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-white transition-[background-color,transform] duration-100 hover:bg-primary/90 active:scale-[0.97] disabled:active:scale-100"
        >
          <Plus className="size-3.5" />
          Novo adicional
        </button>
      </div>
      {showForm ? (
        <form
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
          className="space-y-3 rounded-lg border border-border bg-card p-3.5"
        >
          <Label className="block text-xs font-semibold">
            Nome
            <Input
              {...form.register('name')}
              className="mt-1 h-10 w-full rounded-md border border-border px-3 text-sm"
            />
          </Label>
          <div className="grid gap-3 sm:grid-cols-2">
            <Label className="block text-xs font-semibold">
              Preço na metade (R$)
              <Input
                type="number"
                step="0.01"
                {...form.register('priceHalfReais', { valueAsNumber: true })}
                className="mt-1 h-10 w-full rounded-md border border-border px-3 text-sm"
              />
            </Label>
            <Label className="block text-xs font-semibold">
              Preço na pizza toda (R$)
              <Input
                type="number"
                step="0.01"
                {...form.register('priceFullReais', { valueAsNumber: true })}
                className="mt-1 h-10 w-full rounded-md border border-border px-3 text-sm"
              />
            </Label>
          </div>
          <Label className="block text-xs font-semibold">
            Descrição
            <Input
              {...form.register('description')}
              className="mt-1 h-10 w-full rounded-md border border-border px-3 text-sm"
            />
          </Label>
          <div className="flex gap-4 text-xs">
            <Label className="inline-flex items-center gap-2 font-semibold">
              <input type="checkbox" {...form.register('isActive')} />
              Ativo
            </Label>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={mutation.isPending}
              className="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-white transition-[background-color,transform] duration-100 hover:bg-primary/90 active:scale-[0.97] disabled:opacity-60 disabled:active:scale-100"
            >
              {mutation.isPending ? 'Salvando…' : 'Salvar'}
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
      <div className="space-y-2">
        {pizzaAddons.map((addon) => (
          <div
            key={addon.id}
            className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{addon.name}</p>
              <p className="text-2xs text-muted-foreground">
                Metade: {formatCatalogPrice(addon.priceHalfCents)} · Pizza
                toda: {formatCatalogPrice(addon.priceFullCents)} ·{' '}
                {addon.isActive ? 'Ativo' : 'Inativo'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => openForm(addon)}
              className="rounded-md border border-border p-1.5"
            >
              <Pencil className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                void (async () => {
                  const ok = await confirm({
                    title: 'Arquivar adicional',
                    description: `Arquivar ${addon.name}?`,
                    confirmLabel: 'Arquivar',
                    tone: 'destructive',
                  });
                  if (!ok) return;
                  archiveMutation.mutate(addon.id);
                })();
              }}
              className="rounded-md border border-border p-1.5 text-destructive"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}
        {pizzaAddons.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum adicional de pizza cadastrado.
          </p>
        ) : null}
      </div>
    </section>
  );
}
