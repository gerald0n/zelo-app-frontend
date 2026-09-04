'use client';

import { useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Upload,
  UtensilsCrossed,
} from 'lucide-react';
import AdminHeader from '@/components/admin/AdminHeader';
import { useAppDialog } from '@/contexts/AppDialogContext';
import { useRequireAdmin } from '@/hooks/useRequireAdmin';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ApiError, apiJson } from '@/lib/api';
import { adminContainerClass } from '@/lib/layout';
import { cn } from '@/lib/cn';
import { adminKeys } from '@/lib/query-keys';
import { formatCatalogPrice } from '@/modules/catalog/types';
import type {
  AdminAddon,
  AdminCategory,
  AdminProduct,
  AdminPromotion,
  PromotionScope,
} from '@/modules/admin/types';

type Tab = 'products' | 'categories' | 'addons' | 'promotions';

type CatalogResponse = {
  categories: AdminCategory[];
  products: AdminProduct[];
  addons: AdminAddon[];
  promotions: AdminPromotion[];
};

const categorySchema = z.object({
  name: z.string().trim().min(1, 'Informe o nome.'),
  description: z.string().optional(),
  sortOrder: z.number().int().min(0),
  isActive: z.boolean(),
});

const productSchema = z.object({
  categoryId: z.string().uuid('Selecione a categoria.'),
  name: z.string().trim().min(1, 'Informe o nome.'),
  description: z.string().optional(),
  priceReais: z.number().min(0, 'Preço inválido.'),
  sortOrder: z.number().int().min(0),
  isActive: z.boolean(),
  isAvailable: z.boolean(),
  weightMinGrams: z.string().optional(),
  weightMaxGrams: z.string().optional(),
  stockQuantity: z.string().optional(),
  addonIds: z.array(z.string().uuid()),
});

const addonSchema = z.object({
  name: z.string().trim().min(1, 'Informe o nome.'),
  description: z.string().optional(),
  priceReais: z.number().min(0, 'Preço inválido.'),
  isActive: z.boolean(),
  isAvailable: z.boolean(),
});

const promotionSchema = z
  .object({
    name: z.string().trim().min(1, 'Informe o nome.'),
    scope: z.enum(['store', 'category', 'products']),
    discountPercent: z
      .number()
      .gt(0, 'Informe um desconto entre 0 e 100.')
      .max(100, 'Informe um desconto entre 0 e 100.'),
    startsAt: z.string().optional(),
    endsAt: z.string().optional(),
    isActive: z.boolean(),
    categoryIds: z.array(z.string().uuid()),
    productIds: z.array(z.string().uuid()),
  })
  .refine((data) => data.scope !== 'category' || data.categoryIds.length > 0, {
    message: 'Selecione ao menos uma categoria.',
    path: ['categoryIds'],
  })
  .refine((data) => data.scope !== 'products' || data.productIds.length > 0, {
    message: 'Selecione ao menos um produto.',
    path: ['productIds'],
  });

type CategoryForm = z.infer<typeof categorySchema>;
type ProductForm = z.infer<typeof productSchema>;
type AddonForm = z.infer<typeof addonSchema>;
type PromotionForm = z.infer<typeof promotionSchema>;

const promotionScopeLabels: Record<PromotionScope, string> = {
  store: 'Loja toda',
  category: 'Categorias',
  products: 'Produtos',
};

/** `datetime-local` (sem fuso) <-> ISO. `''`/`undefined` viram `null`. */
function localToIso(value: string | undefined): string | null {
  return value ? new Date(value).toISOString() : null;
}

function isoToLocal(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function reaisToCents(value: number) {
  return Math.round(value * 100);
}

function centsToReais(value: number) {
  return value / 100;
}

export default function AdminCatalogoPage() {
  const queryClient = useQueryClient();
  const { isAuthenticated, ready } = useRequireAdmin();
  const { confirm } = useAppDialog();
  const [tab, setTab] = useState<Tab>('products');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [editingCategory, setEditingCategory] = useState<AdminCategory | null>(
    null,
  );
  const [editingProduct, setEditingProduct] = useState<AdminProduct | null>(
    null,
  );
  const [editingAddon, setEditingAddon] = useState<AdminAddon | null>(null);
  const [editingPromotion, setEditingPromotion] =
    useState<AdminPromotion | null>(null);
  const [formError, setFormError] = useState('');
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [showProductForm, setShowProductForm] = useState(false);
  const [showAddonForm, setShowAddonForm] = useState(false);
  const [showPromotionForm, setShowPromotionForm] = useState(false);

  const catalogQuery = useQuery({
    queryKey: adminKeys.catalog(),
    enabled: ready && isAuthenticated,
    queryFn: () => apiJson<CatalogResponse>('/api/v1/admin/catalog'),
  });

  const categories = useMemo(
    () => catalogQuery.data?.categories ?? [],
    [catalogQuery.data?.categories],
  );
  const products = useMemo(
    () => catalogQuery.data?.products ?? [],
    [catalogQuery.data?.products],
  );
  const addons = useMemo(
    () => catalogQuery.data?.addons ?? [],
    [catalogQuery.data?.addons],
  );
  const promotions = useMemo(
    () => catalogQuery.data?.promotions ?? [],
    [catalogQuery.data?.promotions],
  );

  const categoryForm = useForm<CategoryForm>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: '',
      description: '',
      sortOrder: 0,
      isActive: true,
    },
  });

  const productForm = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      categoryId: '',
      name: '',
      description: '',
      priceReais: 0,
      sortOrder: 0,
      isActive: true,
      isAvailable: true,
      weightMinGrams: '',
      weightMaxGrams: '',
      stockQuantity: '',
      addonIds: [],
    },
  });

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

  const selectedAddonIds =
    useWatch({ control: productForm.control, name: 'addonIds' }) ?? [];
  const promotionScope = useWatch({
    control: promotionForm.control,
    name: 'scope',
  });
  const promotionCategoryIds =
    useWatch({ control: promotionForm.control, name: 'categoryIds' }) ?? [];
  const promotionProductIds =
    useWatch({ control: promotionForm.control, name: 'productIds' }) ?? [];

  const invalidateCatalog = async () => {
    await queryClient.invalidateQueries({ queryKey: adminKeys.catalog() });
  };

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
      setFormError('');
      categoryForm.reset();
      await invalidateCatalog();
    },
    onError: (error) => {
      setFormError(
        error instanceof ApiError ? error.message : 'Falha ao salvar categoria.',
      );
    },
  });

  const productMutation = useMutation({
    mutationFn: async (values: ProductForm) => {
      const payload = {
        categoryId: values.categoryId,
        name: values.name,
        description: values.description || null,
        priceCents: reaisToCents(values.priceReais),
        sortOrder: values.sortOrder,
        isActive: values.isActive,
        isAvailable: values.isAvailable,
        weightMinGrams: values.weightMinGrams
          ? Number(values.weightMinGrams)
          : null,
        weightMaxGrams: values.weightMaxGrams
          ? Number(values.weightMaxGrams)
          : null,
        stockQuantity: values.stockQuantity
          ? Number(values.stockQuantity)
          : null,
        addonIds: values.addonIds,
      };
      if (editingProduct) {
        return apiJson(`/api/v1/admin/products/${editingProduct.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      }
      return apiJson('/api/v1/admin/products', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    onSuccess: async () => {
      setShowProductForm(false);
      setEditingProduct(null);
      setFormError('');
      productForm.reset({
        categoryId: categories[0]?.id ?? '',
        name: '',
        description: '',
        priceReais: 0,
        sortOrder: 0,
        isActive: true,
        isAvailable: true,
        weightMinGrams: '',
        weightMaxGrams: '',
        stockQuantity: '',
        addonIds: [],
      });
      await invalidateCatalog();
    },
    onError: (error) => {
      setFormError(
        error instanceof ApiError ? error.message : 'Falha ao salvar produto.',
      );
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
      setFormError('');
      addonForm.reset();
      await invalidateCatalog();
    },
    onError: (error) => {
      setFormError(
        error instanceof ApiError ? error.message : 'Falha ao salvar adicional.',
      );
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
      setFormError('');
      promotionForm.reset();
      await invalidateCatalog();
    },
    onError: (error) => {
      setFormError(
        error instanceof ApiError ? error.message : 'Falha ao salvar promoção.',
      );
    },
  });

  const deletePromotionMutation = useMutation({
    mutationFn: (promotionId: string) =>
      apiJson(`/api/v1/admin/promotions/${promotionId}`, { method: 'DELETE' }),
    onSuccess: invalidateCatalog,
  });

  const availabilityMutation = useMutation({
    mutationFn: (product: AdminProduct) =>
      apiJson(`/api/v1/admin/products/${product.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isAvailable: !product.isAvailable }),
      }),
    onSuccess: invalidateCatalog,
  });

  const archiveMutation = useMutation({
    mutationFn: async (input: {
      kind: 'product' | 'category' | 'addon';
      id: string;
    }) => {
      if (input.kind === 'product') {
        return apiJson(`/api/v1/admin/products/${input.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ archive: true }),
        });
      }
      if (input.kind === 'category') {
        return apiJson(`/api/v1/admin/categories/${input.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ archive: true }),
        });
      }
      return apiJson(`/api/v1/admin/addons/${input.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ archive: true }),
      });
    },
    onSuccess: invalidateCatalog,
  });

  const uploadMutation = useMutation({
    mutationFn: async (input: { productId: string; file: File }) => {
      const form = new FormData();
      form.set('productId', input.productId);
      form.set('file', input.file);
      form.set('altText', input.file.name);
      form.set('isPrimary', 'true');
      return apiJson('/api/v1/admin/uploads/product-image', {
        method: 'POST',
        body: form,
      });
    },
    onSuccess: invalidateCatalog,
    onError: (error) => {
      setFormError(
        error instanceof ApiError ? error.message : 'Falha no upload.',
      );
    },
  });

  const visibleProducts = useMemo(
    () =>
      categoryFilter
        ? products.filter((product) => product.categoryId === categoryFilter)
        : products,
    [categoryFilter, products],
  );

  if (!ready || !isAuthenticated) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background lg:pl-52">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const openCategoryForm = (category?: AdminCategory) => {
    setFormError('');
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

  const openProductForm = (product?: AdminProduct) => {
    setFormError('');
    setEditingProduct(product ?? null);
    productForm.reset(
      product
        ? {
            categoryId: product.categoryId,
            name: product.name,
            description: product.description ?? '',
            priceReais: centsToReais(product.priceCents),
            sortOrder: product.sortOrder,
            isActive: product.isActive,
            isAvailable: product.isAvailable,
            weightMinGrams:
              product.weightMinGrams != null
                ? String(product.weightMinGrams)
                : '',
            weightMaxGrams:
              product.weightMaxGrams != null
                ? String(product.weightMaxGrams)
                : '',
            stockQuantity:
              product.stockQuantity != null
                ? String(product.stockQuantity)
                : '',
            addonIds: product.addonIds,
          }
        : {
            categoryId: categories[0]?.id ?? '',
            name: '',
            description: '',
            priceReais: 0,
            sortOrder: products.length,
            isActive: true,
            isAvailable: true,
            weightMinGrams: '',
            weightMaxGrams: '',
            stockQuantity: '',
            addonIds: [],
          },
    );
    setShowProductForm(true);
  };

  const openAddonForm = (addon?: AdminAddon) => {
    setFormError('');
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

  const openPromotionForm = (promotion?: AdminPromotion) => {
    setFormError('');
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

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'products', label: 'Produtos' },
    { id: 'categories', label: 'Categorias' },
    { id: 'promotions', label: 'Promoções' },
    { id: 'addons', label: 'Adicionais' },
  ];

  return (
    <div className="min-h-dvh bg-background lg:pl-52">
      <AdminHeader
        title="Catálogo"
        subtitle={`${products.filter((item) => item.isAvailable).length} produtos disponíveis`}
      />
      <div
        className={cn(
          'space-y-4 p-3 pb-8 md:px-6 md:pt-6',
          adminContainerClass,
        )}
      >
        <div className="flex gap-1.5">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={cn(
                'rounded-md border px-3 py-1.5 text-2xs font-semibold',
                tab === item.id
                  ? 'border-primary bg-primary text-white'
                  : 'border-border bg-card',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        {formError ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {formError}
          </p>
        ) : null}

        {catalogQuery.isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : null}

        {tab === 'products' && !catalogQuery.isLoading ? (
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setCategoryFilter(null)}
                  className={cn(
                    'shrink-0 rounded-md border px-3 py-1.5 text-2xs font-semibold',
                    categoryFilter === null
                      ? 'border-primary bg-primary text-white'
                      : 'border-border bg-card',
                  )}
                >
                  Todos
                </button>
                {categories.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setCategoryFilter(item.id)}
                    className={cn(
                      'shrink-0 rounded-md border px-3 py-1.5 text-2xs font-semibold',
                      categoryFilter === item.id
                        ? 'border-primary bg-primary text-white'
                        : 'border-border bg-card',
                    )}
                  >
                    {item.name}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => openProductForm()}
                className="inline-flex shrink-0 items-center gap-1 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-white transition-[background-color,transform] duration-100 hover:bg-primary/90 active:scale-[0.97] disabled:active:scale-100"
              >
                <Plus className="size-3.5" />
                Novo
              </button>
            </div>

            {showProductForm ? (
              <form
                onSubmit={productForm.handleSubmit((values) =>
                  productMutation.mutate(values),
                )}
                className="space-y-3 rounded-lg border border-border bg-card p-3.5"
              >
                <p className="text-sm font-semibold">
                  {editingProduct ? 'Editar produto' : 'Novo produto'}
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Label className="block text-xs font-semibold">
                    Nome
                    <Input
                      {...productForm.register('name')}
                      className="mt-1 h-10 w-full rounded-md border border-border px-3 text-sm"
                    />
                  </Label>
                  <label className="block text-xs font-semibold">
                    Categoria
                    <select
                      {...productForm.register('categoryId')}
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
                      {...productForm.register('priceReais', {
                        valueAsNumber: true,
                      })}
                      className="mt-1 h-10 w-full rounded-md border border-border px-3 text-sm"
                    />
                  </Label>
                  <Label className="block text-xs font-semibold">
                    Ordem
                    <Input
                      type="number"
                      {...productForm.register('sortOrder', {
                        valueAsNumber: true,
                      })}
                      className="mt-1 h-10 w-full rounded-md border border-border px-3 text-sm"
                    />
                  </Label>
                  <Label className="block text-xs font-semibold">
                    Estoque (deixe vazio para ilimitado)
                    <Input
                      type="number"
                      min={0}
                      step={1}
                      {...productForm.register('stockQuantity')}
                      className="mt-1 h-10 w-full rounded-md border border-border px-3 text-sm"
                    />
                  </Label>
                  <Label className="block text-xs font-semibold sm:col-span-2">
                    Descrição
                    <Textarea
                      {...productForm.register('description')}
                      rows={3}
                      className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
                    />
                  </Label>
                </div>
                <div className="flex flex-wrap gap-4 text-xs">
                  <Label className="inline-flex items-center gap-2 font-semibold">
                    <input type="checkbox" {...productForm.register('isActive')} />
                    Ativo
                  </Label>
                  <Label className="inline-flex items-center gap-2 font-semibold">
                    <input
                      type="checkbox"
                      {...productForm.register('isAvailable')}
                    />
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
                              const current = productForm.getValues('addonIds');
                              productForm.setValue(
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
                    disabled={productMutation.isPending}
                    className="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-white transition-[background-color,transform] duration-100 hover:bg-primary/90 active:scale-[0.97] disabled:active:scale-100 disabled:opacity-60"
                  >
                    {productMutation.isPending ? 'Salvando…' : 'Salvar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowProductForm(false);
                      setEditingProduct(null);
                    }}
                    className="rounded-md border border-border px-3 py-2 text-xs font-semibold"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            ) : null}

            <div className="space-y-2">
              {visibleProducts.map((product) => (
                <div
                  key={product.id}
                  className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
                >
                  <span className="flex size-10 items-center justify-center overflow-hidden rounded-md bg-muted">
                    {product.images[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={product.images[0].url}
                        alt={product.images[0].altText}
                        className="size-full object-cover"
                      />
                    ) : (
                      <UtensilsCrossed className="size-4 text-muted-foreground" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{product.name}</p>
                    <p className="text-2xs text-muted-foreground">
                      {product.categoryName} ·{' '}
                      {formatCatalogPrice(product.priceCents)}
                      {product.stockQuantity != null ? (
                        <>
                          {' · '}
                          <span
                            className={cn(
                              'font-semibold',
                              product.stockQuantity === 0
                                ? 'text-destructive'
                                : product.stockQuantity <= 5
                                  ? 'text-tone-warning'
                                  : undefined,
                            )}
                          >
                            {product.stockQuantity === 0
                              ? 'Esgotado'
                              : `${product.stockQuantity} em estoque`}
                          </span>
                        </>
                      ) : null}
                    </p>
                  </div>
                  <label className="cursor-pointer rounded-md border border-border p-1.5 text-muted-foreground">
                    <Upload className="size-3.5" />
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        uploadMutation.mutate({
                          productId: product.id,
                          file,
                        });
                        event.target.value = '';
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => openProductForm(product)}
                    className="rounded-md border border-border p-1.5 text-muted-foreground"
                    aria-label="Editar produto"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void (async () => {
                        const ok = await confirm({
                          title: 'Arquivar produto',
                          description: `Arquivar ${product.name}?`,
                          confirmLabel: 'Arquivar',
                          tone: 'destructive',
                        });
                        if (!ok) return;
                        archiveMutation.mutate({
                          kind: 'product',
                          id: product.id,
                        });
                      })();
                    }}
                    className="rounded-md border border-border p-1.5 text-destructive"
                    aria-label="Arquivar produto"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={product.isAvailable}
                    onClick={() => availabilityMutation.mutate(product)}
                    className={cn(
                      'relative h-6 w-11 shrink-0 rounded-full transition-colors',
                      product.isAvailable ? 'bg-primary' : 'bg-muted',
                    )}
                  >
                    <span
                      className={cn(
                        'absolute top-0.5 size-5 rounded-full bg-white transition-transform',
                        product.isAvailable ? 'left-5' : 'left-0.5',
                      )}
                    />
                  </button>
                </div>
              ))}
              {visibleProducts.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum produto.</p>
              ) : null}
            </div>
          </section>
        ) : null}

        {tab === 'categories' && !catalogQuery.isLoading ? (
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
                        archiveMutation.mutate({
                          kind: 'category',
                          id: category.id,
                        });
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
        ) : null}

        {tab === 'addons' && !catalogQuery.isLoading ? (
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
                    <input
                      type="checkbox"
                      {...addonForm.register('isAvailable')}
                    />
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
                        archiveMutation.mutate({
                          kind: 'addon',
                          id: addon.id,
                        });
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
        ) : null}

        {tab === 'promotions' && !catalogQuery.isLoading ? (
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
              <form
                onSubmit={promotionForm.handleSubmit((values) =>
                  promotionMutation.mutate(values),
                )}
                className="space-y-3 rounded-lg border border-border bg-card p-3.5"
              >
                <p className="text-sm font-semibold">
                  {editingPromotion ? 'Editar promoção' : 'Nova promoção'}
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Label className="block text-xs font-semibold">
                    Nome
                    <Input
                      {...promotionForm.register('name')}
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
                      {...promotionForm.register('discountPercent', {
                        valueAsNumber: true,
                      })}
                      className="mt-1 h-10 w-full rounded-md border border-border px-3 text-sm"
                    />
                  </Label>
                  <label className="block text-xs font-semibold">
                    Abrangência
                    <select
                      {...promotionForm.register('scope')}
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
                    <input
                      type="checkbox"
                      {...promotionForm.register('isActive')}
                    />
                    Ativa
                  </Label>
                  <Label className="block text-xs font-semibold">
                    Início (opcional)
                    <Input
                      type="datetime-local"
                      {...promotionForm.register('startsAt')}
                      className="mt-1 h-10 w-full rounded-md border border-border px-3 text-sm"
                    />
                  </Label>
                  <Label className="block text-xs font-semibold">
                    Fim (opcional)
                    <Input
                      type="datetime-local"
                      {...promotionForm.register('endsAt')}
                      className="mt-1 h-10 w-full rounded-md border border-border px-3 text-sm"
                    />
                  </Label>
                </div>

                {promotionScope === 'category' ? (
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
                            checked={promotionCategoryIds.includes(category.id)}
                            onChange={(e) => {
                              const next = e.target.checked
                                ? [...promotionCategoryIds, category.id]
                                : promotionCategoryIds.filter(
                                    (id) => id !== category.id,
                                  );
                              promotionForm.setValue('categoryIds', next);
                            }}
                          />
                          {category.name}
                        </label>
                      ))}
                    </div>
                  </div>
                ) : null}

                {promotionScope === 'products' ? (
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
                            checked={promotionProductIds.includes(product.id)}
                            onChange={(e) => {
                              const next = e.target.checked
                                ? [...promotionProductIds, product.id]
                                : promotionProductIds.filter(
                                    (id) => id !== product.id,
                                  );
                              promotionForm.setValue('productIds', next);
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
                    disabled={promotionMutation.isPending}
                    className="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-white transition-[background-color,transform] duration-100 hover:bg-primary/90 active:scale-[0.97] disabled:active:scale-100"
                  >
                    {promotionMutation.isPending ? 'Salvando…' : 'Salvar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPromotionForm(false)}
                    className="rounded-md border border-border px-3 py-2 text-xs font-semibold"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
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
                              ? new Date(promotion.endsAt).toLocaleDateString(
                                  'pt-BR',
                                )
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
        ) : null}
      </div>
    </div>
  );
}
