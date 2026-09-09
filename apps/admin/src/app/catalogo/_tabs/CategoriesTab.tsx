'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, Pencil, Plus, Trash2 } from 'lucide-react';
import { useAppDialog } from '@/contexts/AppDialogContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError, apiJson } from '@/lib/api';
import { removeCatalogItem, rollbackCatalog } from '@/lib/admin/catalog-cache';
import {
  categorySchema,
  type CategoryForm,
} from '@/app/catalogo/catalog-forms';
import { CategorySchedulingFields } from '@/app/catalogo/_tabs/CategorySchedulingFields';
import type { AdminCategory } from '@/modules/admin/types';

type Props = {
  categories: AdminCategory[];
  invalidateCatalog: () => Promise<void>;
  onError: (message: string) => void;
};

export function CategoriesTab({
  categories,
  invalidateCatalog,
  onError,
}: Props) {
  const { confirm } = useAppDialog();
  const queryClient = useQueryClient();
  const [editingCategory, setEditingCategory] = useState<AdminCategory | null>(
    null,
  );
  const [showCategoryForm, setShowCategoryForm] = useState(false);

  const emptyScheduling = {
    schedulingAllowSameDay: true,
    schedulingSameDayLeadMinutes: 120,
    schedulingWeekdayEarliest: '',
    schedulingWeekendEarliest: '',
    schedulingSlotIntervalMinutes: 30,
  };

  const categoryForm = useForm<CategoryForm>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: '',
      description: '',
      sortOrder: 0,
      isActive: true,
      ...emptyScheduling,
    },
  });

  const toPayload = (values: CategoryForm) => ({
    name: values.name,
    description: values.description || null,
    sortOrder: values.sortOrder,
    isActive: values.isActive,
    scheduling: {
      allowSameDay: values.schedulingAllowSameDay,
      sameDayLeadMinutes: values.schedulingSameDayLeadMinutes,
      weekdayEarliest: values.schedulingWeekdayEarliest || null,
      weekendEarliest: values.schedulingWeekendEarliest || null,
      slotIntervalMinutes: values.schedulingSlotIntervalMinutes,
    },
  });

  const categoryMutation = useMutation({
    mutationFn: async (values: CategoryForm) => {
      if (editingCategory) {
        return apiJson(`/api/v1/admin/categories/${editingCategory.id}`, {
          method: 'PATCH',
          body: JSON.stringify(toPayload(values)),
        });
      }
      return apiJson('/api/v1/admin/categories', {
        method: 'POST',
        body: JSON.stringify(toPayload(values)),
      });
    },
    onSuccess: async () => {
      setShowCategoryForm(false);
      setEditingCategory(null);
      onError('');
      categoryForm.reset();
      await invalidateCatalog();
    },
    onError: (error) => {
      onError(
        error instanceof ApiError
          ? error.message
          : 'Falha ao salvar categoria.',
      );
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) =>
      apiJson(`/api/v1/admin/categories/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ archive: true }),
      }),
    onMutate: (id) => {
      onError('');
      return removeCatalogItem(queryClient, 'categories', id);
    },
    onError: (error, _id, context) => {
      rollbackCatalog(queryClient, context);
      onError(
        error instanceof ApiError
          ? error.message
          : 'Falha ao arquivar a categoria.',
      );
    },
    onSettled: invalidateCatalog,
  });

  const reorderMutation = useMutation({
    mutationFn: (orderedIds: string[]) =>
      apiJson('/api/v1/admin/categories', {
        method: 'PUT',
        body: JSON.stringify({ orderedIds }),
      }),
    onSuccess: async () => {
      onError('');
      await invalidateCatalog();
    },
    onError: (error) => {
      onError(
        error instanceof ApiError
          ? error.message
          : 'Falha ao reordenar as categorias.',
      );
    },
  });

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= categories.length) return;
    const ids = categories.map((category) => category.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    reorderMutation.mutate(ids);
  };

  const openCategoryForm = (category?: AdminCategory) => {
    onError('');
    setEditingCategory(category ?? null);
    categoryForm.reset(
      category
        ? {
            name: category.name,
            description: category.description ?? '',
            sortOrder: category.sortOrder,
            isActive: category.isActive,
            schedulingAllowSameDay: category.scheduling.allowSameDay,
            schedulingSameDayLeadMinutes:
              category.scheduling.sameDayLeadMinutes,
            schedulingWeekdayEarliest:
              category.scheduling.weekdayEarliest ?? '',
            schedulingWeekendEarliest:
              category.scheduling.weekendEarliest ?? '',
            schedulingSlotIntervalMinutes:
              category.scheduling.slotIntervalMinutes,
          }
        : {
            name: '',
            description: '',
            sortOrder: categories.length,
            isActive: true,
            ...emptyScheduling,
          },
    );
    setShowCategoryForm(true);
  };

  return (
    <section className="space-y-3">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => openCategoryForm()}
          className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-white transition-[background-color,transform] duration-100 hover:bg-primary/90 active:scale-[0.97] disabled:active:scale-100"
        >
          <Plus className="size-3.5" />
          Nova categoria
        </button>
      </div>
      {showCategoryForm ? (
        <form
          onSubmit={categoryForm.handleSubmit((values) =>
            categoryMutation.mutate(values),
          )}
          className="space-y-3 rounded-lg border border-border bg-card p-3.5"
        >
          <Label className="block text-xs font-semibold">
            Nome
            <Input
              {...categoryForm.register('name')}
              className="mt-1 h-10 w-full rounded-md border border-border px-3 text-sm"
            />
          </Label>
          <Label className="block text-xs font-semibold">
            Descrição
            <Input
              {...categoryForm.register('description')}
              className="mt-1 h-10 w-full rounded-md border border-border px-3 text-sm"
            />
          </Label>
          <Label className="block text-xs font-semibold">
            Ordem
            <Input
              type="number"
              {...categoryForm.register('sortOrder', {
                valueAsNumber: true,
              })}
              className="mt-1 h-10 w-full rounded-md border border-border px-3 text-sm"
            />
          </Label>
          <Label className="inline-flex items-center gap-2 text-xs font-semibold">
            <input type="checkbox" {...categoryForm.register('isActive')} />
            Ativa
          </Label>

          <CategorySchedulingFields form={categoryForm} />

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={categoryMutation.isPending}
              className="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-white transition-[background-color,transform] duration-100 hover:bg-primary/90 active:scale-[0.97] disabled:opacity-60 disabled:active:scale-100"
            >
              {categoryMutation.isPending ? 'Salvando…' : 'Salvar'}
            </button>
            <button
              type="button"
              onClick={() => setShowCategoryForm(false)}
              className="rounded-md border border-border px-3 py-2 text-xs font-semibold"
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : null}
      <div className="space-y-2">
        {categories.map((category, index) => (
          <div
            key={category.id}
            className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
          >
            <div className="flex shrink-0 flex-col">
              <button
                type="button"
                onClick={() => move(index, -1)}
                disabled={index === 0 || reorderMutation.isPending}
                aria-label="Mover para cima"
                className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-accent disabled:opacity-30"
              >
                <ChevronUp className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => move(index, 1)}
                disabled={
                  index === categories.length - 1 || reorderMutation.isPending
                }
                aria-label="Mover para baixo"
                className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-accent disabled:opacity-30"
              >
                <ChevronDown className="size-4" />
              </button>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{category.name}</p>
              <p className="text-2xs text-muted-foreground">
                {category.isActive ? 'Ativa' : 'Inativa'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => openCategoryForm(category)}
              className="rounded-md border border-border p-1.5"
            >
              <Pencil className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                void (async () => {
                  const ok = await confirm({
                    title: 'Arquivar categoria',
                    description: `Arquivar ${category.name}?`,
                    confirmLabel: 'Arquivar',
                    tone: 'destructive',
                  });
                  if (!ok) return;
                  archiveMutation.mutate(category.id);
                })();
              }}
              className="rounded-md border border-border p-1.5 text-destructive"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
