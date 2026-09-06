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
import {
  categorySchema,
  type CategoryForm,
} from '@/app/catalogo/catalog-forms';
import type { AdminCategory } from '@/modules/admin/types';

type Props = {
  categories: AdminCategory[];
  invalidateCatalog: () => Promise<void>;
  onError: (message: string) => void;
};

export function CategoriesTab({ categories, invalidateCatalog, onError }: Props) {
  const { confirm } = useAppDialog();
  const [editingCategory, setEditingCategory] = useState<AdminCategory | null>(
    null,
  );
  const [showCategoryForm, setShowCategoryForm] = useState(false);

  const categoryForm = useForm<CategoryForm>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: '',
      description: '',
      sortOrder: 0,
      isActive: true,
    },
  });

  const categoryMutation = useMutation({
    mutationFn: async (values: CategoryForm) => {
      if (editingCategory) {
        return apiJson(`/api/v1/admin/categories/${editingCategory.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name: values.name,
            description: values.description || null,
            sortOrder: values.sortOrder,
            isActive: values.isActive,
          }),
        });
      }
      return apiJson('/api/v1/admin/categories', {
        method: 'POST',
        body: JSON.stringify({
          name: values.name,
          description: values.description || null,
          sortOrder: values.sortOrder,
          isActive: values.isActive,
        }),
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
        error instanceof ApiError ? error.message : 'Falha ao salvar categoria.',
      );
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) =>
      apiJson(`/api/v1/admin/categories/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ archive: true }),
      }),
    onSuccess: invalidateCatalog,
  });

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
          }
        : {
            name: '',
            description: '',
            sortOrder: categories.length,
            isActive: true,
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
          <div className="flex gap-2">
            <button
              type="submit"
              className="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-white transition-[background-color,transform] duration-100 hover:bg-primary/90 active:scale-[0.97] disabled:active:scale-100"
            >
              Salvar
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
        {categories.map((category) => (
          <div
            key={category.id}
            className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{category.name}</p>
              <p className="text-2xs text-muted-foreground">
                Ordem {category.sortOrder} ·{' '}
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
