import { z } from 'zod';
import type {
  AdminAddon,
  AdminCategory,
  AdminCoupon,
  AdminProduct,
  AdminPromotion,
  PromotionScope,
} from '@/modules/admin/types';

export type Tab =
  'products' | 'categories' | 'addons' | 'promotions' | 'coupons';

export type CatalogResponse = {
  categories: AdminCategory[];
  products: AdminProduct[];
  addons: AdminAddon[];
  promotions: AdminPromotion[];
  coupons: AdminCoupon[];
};

const hhmmOrEmpty = z
  .string()
  .trim()
  .refine((v) => v === '' || /^([01]\d|2[0-3]):[0-5]\d$/.test(v), {
    message: 'Use HH:MM.',
  });

export const categorySchema = z.object({
  name: z.string().trim().min(1, 'Informe o nome.'),
  description: z.string().optional(),
  sortOrder: z.number().int().min(0),
  isActive: z.boolean(),
  schedulingAllowSameDay: z.boolean(),
  schedulingSameDayLeadMinutes: z
    .number()
    .int()
    .min(0, 'Entre 0 e 1440.')
    .max(1440, 'Entre 0 e 1440.'),
  schedulingWeekdayEarliest: hhmmOrEmpty,
  schedulingWeekendEarliest: hhmmOrEmpty,
  schedulingSlotIntervalMinutes: z
    .number()
    .int()
    .min(5, 'Entre 5 e 240.')
    .max(240, 'Entre 5 e 240.'),
});

export const productSchema = z.object({
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

export const addonSchema = z.object({
  name: z.string().trim().min(1, 'Informe o nome.'),
  description: z.string().optional(),
  priceReais: z.number().min(0, 'Preço inválido.'),
  isActive: z.boolean(),
  isAvailable: z.boolean(),
});

export const promotionSchema = z
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

export type CategoryForm = z.infer<typeof categorySchema>;
export type ProductForm = z.infer<typeof productSchema>;

/** Valores em branco do formulário de produto (novo cadastro). */
export function emptyProductForm(
  categoryId: string,
  sortOrder = 0,
): ProductForm {
  return {
    categoryId,
    name: '',
    description: '',
    priceReais: 0,
    sortOrder,
    isActive: true,
    isAvailable: true,
    weightMinGrams: '',
    weightMaxGrams: '',
    stockQuantity: '',
    addonIds: [],
  };
}
export type AddonForm = z.infer<typeof addonSchema>;
export type PromotionForm = z.infer<typeof promotionSchema>;

export const promotionScopeLabels: Record<PromotionScope, string> = {
  store: 'Loja toda',
  category: 'Categorias',
  products: 'Produtos',
};

/** `datetime-local` (sem fuso) <-> ISO. `''`/`undefined` viram `null`. */
export function localToIso(value: string | undefined): string | null {
  return value ? new Date(value).toISOString() : null;
}

export function isoToLocal(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function reaisToCents(value: number) {
  return Math.round(value * 100);
}

export function centsToReais(value: number) {
  return value / 100;
}
