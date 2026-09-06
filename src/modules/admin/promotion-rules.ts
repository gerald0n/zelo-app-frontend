import { err, ok, type Result } from '@/lib/errors';
import type { AdminPromotion, PromotionScope } from '@/modules/admin/types';

export const PROMOTION_SELECT = `
  id,
  name,
  scope,
  discount_percent,
  starts_at,
  ends_at,
  is_active,
  promotion_categories ( category_id ),
  promotion_products ( product_id )
`;

export type PromotionRow = {
  id: string;
  name: string;
  scope: string;
  discount_percent: number;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  promotion_categories: Array<{ category_id: string }> | null;
  promotion_products: Array<{ product_id: string }> | null;
};

export function mapPromotion(row: PromotionRow): AdminPromotion {
  return {
    id: row.id,
    name: row.name,
    scope: row.scope as PromotionScope,
    discountPercent: Number(row.discount_percent),
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    isActive: row.is_active,
    categoryIds: (row.promotion_categories ?? []).map((c) => c.category_id),
    productIds: (row.promotion_products ?? []).map((p) => p.product_id),
  };
}

export type PromotionInput = {
  name: string;
  scope: PromotionScope;
  discountPercent: number;
  startsAt?: string | null;
  endsAt?: string | null;
  isActive?: boolean;
  categoryIds?: string[];
  productIds?: string[];
};

/** Duas promoções se sobrepõem no tempo (null = sem limite naquele lado). */
export function periodsOverlap(
  a: { startsAt: string | null; endsAt: string | null },
  b: { startsAt: string | null; endsAt: string | null },
): boolean {
  const aStart = a.startsAt ? new Date(a.startsAt).getTime() : -Infinity;
  const aEnd = a.endsAt ? new Date(a.endsAt).getTime() : Infinity;
  const bStart = b.startsAt ? new Date(b.startsAt).getTime() : -Infinity;
  const bEnd = b.endsAt ? new Date(b.endsAt).getTime() : Infinity;
  return aStart < bEnd && bStart < aEnd;
}

export function validatePromotionShape(input: PromotionInput): Result<true> {
  if (input.scope === 'category' && !input.categoryIds?.length) {
    return err(
      'VALIDATION_ERROR',
      'Selecione ao menos uma categoria para a promoção.',
    );
  }
  if (input.scope === 'products' && !input.productIds?.length) {
    return err(
      'VALIDATION_ERROR',
      'Selecione ao menos um produto para a promoção.',
    );
  }
  if (
    input.startsAt &&
    input.endsAt &&
    new Date(input.endsAt) <= new Date(input.startsAt)
  ) {
    return err('VALIDATION_ERROR', 'O fim da promoção deve ser após o início.');
  }
  return ok(true);
}

/**
 * Bloqueia duas promoções ATIVAS do mesmo nível cobrindo o mesmo alvo (mesma
 * categoria, mesmo produto, ou as duas "loja toda") com período sobreposto.
 * `others` já deve vir filtrado para o mesmo `scope`, ativas, e sem a própria
 * promoção em edição.
 */
export function detectOverlapConflict(
  input: PromotionInput,
  others: AdminPromotion[],
): Result<true> {
  if (input.isActive === false) return ok(true);

  const period = {
    startsAt: input.startsAt ?? null,
    endsAt: input.endsAt ?? null,
  };

  for (const other of others) {
    if (!periodsOverlap(period, other)) continue;

    if (input.scope === 'store') {
      return err(
        'VALIDATION_ERROR',
        `Já existe uma promoção ativa para a loja toda no mesmo período ("${other.name}").`,
      );
    }

    if (input.scope === 'category') {
      const clash = (input.categoryIds ?? []).find((id) =>
        other.categoryIds.includes(id),
      );
      if (clash) {
        return err(
          'VALIDATION_ERROR',
          `Essa categoria já está em outra promoção ativa no mesmo período ("${other.name}").`,
        );
      }
    }

    if (input.scope === 'products') {
      const clash = (input.productIds ?? []).find((id) =>
        other.productIds.includes(id),
      );
      if (clash) {
        return err(
          'VALIDATION_ERROR',
          `Esse produto já está em outra promoção ativa no mesmo período ("${other.name}").`,
        );
      }
    }
  }

  return ok(true);
}
