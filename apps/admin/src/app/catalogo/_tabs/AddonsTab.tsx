'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useAppDialog } from '@/contexts/AppDialogContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError, apiJson } from '@/lib/api';
import { formatCatalogPrice } from '@/modules/catalog/types';
import {
  addonSchema,
  centsToReais,
  reaisToCents,
  type AddonForm,
} from '@/app/catalogo/catalog-forms';
import type { AdminAddon } from '@/modules/admin/types';

type Props = {
  addons: AdminAddon[];
  invalidateCatalog: () => Promise<void>;
  onError: (message: string) => void;
};

export function AddonsTab({ addons, invalidateCatalog, onError }: Props) {
  const { confirm } = useAppDialog();
  const [editingAddon, setEditingAddon] = useState<AdminAddon | null>(null);
  const [showAddonForm, setShowAddonForm] = useState(false);

  const addonForm = useForm<AddonForm>({
    resolver: zodResolver(addonSchema),
    defaultValues: {
      name: '',
      description: '',
      priceReais: 0,
      isActive: true,
      isAvailable: true,
    },
  });

  const addonMutation = useMutation({
    mutationFn: async (values: AddonForm) => {
      const payload = {
        name: values.name,
        description: values.description || null,
        priceCents: reaisToCents(values.priceReais),
        isActive: values.isActive,
        isAvailable: values.isAvailable,
      };
      if (editingAddon) {
        return apiJson(`/api/v1/admin/addons/${editingAddon.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      }
      return apiJson('/api/v1/admin/addons', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    onSuccess: async () => {
      setShowAddonForm(false);
      setEditingAddon(null);
      onError('');
      addonForm.reset();
      await invalidateCatalog();
    },
    onError: (error) => {
      onError(
        error instanceof ApiError ? error.message : 'Falha ao salvar adicional.',
      );
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) =>
      apiJson(`/api/v1/admin/addons/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ archive: true }),
      }),
    onSuccess: invalidateCatalog,
  });

  const openAddonForm = (addon?: AdminAddon) => {
    onError('');
    setEditingAddon(addon ?? null);
    addonForm.reset(
      addon
        ? {
            name: addon.name,
            description: addon.description ?? '',
            priceReais: centsToReais(addon.priceCents),
            isActive: addon.isActive,
            isAvailable: addon.isAvailable,
          }
        : {
            name: '',
            description: '',
            priceReais: 0,
            isActive: true,
            isAvailable: true,
          },
    );
    setShowAddonForm(true);
  };

  return (
    <section className="space-y-3">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => openAddonForm()}
          className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-white transition-[background-color,transform] duration-100 hover:bg-primary/90 active:scale-[0.97] disabled:active:scale-100"
        >
          <Plus className="size-3.5" />
          Novo adicional
        </button>
      </div>
      {showAddonForm ? (
        <form
          onSubmit={addonForm.handleSubmit((values) =>
            addonMutation.mutate(values),
          )}
          className="space-y-3 rounded-lg border border-border bg-card p-3.5"
        >
          <Label className="block text-xs font-semibold">
            Nome
            <Input
              {...addonForm.register('name')}
              className="mt-1 h-10 w-full rounded-md border border-border px-3 text-sm"
            />
          </Label>
          <Label className="block text-xs font-semibold">
            Preço (R$)
            <Input
              type="number"
              step="0.01"
              {...addonForm.register('priceReais', {
                valueAsNumber: true,
              })}
              className="mt-1 h-10 w-full rounded-md border border-border px-3 text-sm"
            />
          </Label>
          <Label className="block text-xs font-semibold">
            Descrição
            <Input
              {...addonForm.register('description')}
              className="mt-1 h-10 w-full rounded-md border border-border px-3 text-sm"
            />
          </Label>
          <div className="flex gap-4 text-xs">
            <Label className="inline-flex items-center gap-2 font-semibold">
              <input type="checkbox" {...addonForm.register('isActive')} />
              Ativo
            </Label>
            <Label className="inline-flex items-center gap-2 font-semibold">
              <input type="checkbox" {...addonForm.register('isAvailable')} />
              Disponível
            </Label>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-white transition-[background-color,transform] duration-100 hover:bg-primary/90 active:scale-[0.97] disabled:active:scale-100"
            >
              Salvar
            </button>
            <button
              type="button"
              onClick={() => setShowAddonForm(false)}
              className="rounded-md border border-border px-3 py-2 text-xs font-semibold"
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : null}
      <div className="space-y-2">
        {addons.map((addon) => (
          <div
            key={addon.id}
            className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{addon.name}</p>
              <p className="text-2xs text-muted-foreground">
                {formatCatalogPrice(addon.priceCents)} ·{' '}
                {addon.isAvailable ? 'Disponível' : 'Indisponível'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => openAddonForm(addon)}
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
        {addons.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum adicional cadastrado.
          </p>
        ) : null}
      </div>
    </section>
  );
}
