import 'server-only';

import { err, ok, type Result } from '@/lib/errors';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { writeAuditLog } from '@/modules/admin/audit';
import { requireAdmin } from '@/modules/admin/auth';
import type { AdminPromotion, PromotionScope } from '@/modules/admin/types';
import type { Database } from '@/types/database';

type PromotionUpdate = Database['public']['Tables']['promotions']['Update'];

const PROMOTION_SELECT = `
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

type PromotionRow = {
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

function mapPromotion(row: PromotionRow): AdminPromotion {
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

/** Duas promoções se sobrepõem no tempo (null = sem limite naquele lado). */
function periodsOverlap(
  a: { startsAt: string | null; endsAt: string | null },
  b: { startsAt: string | null; endsAt: string | null },
): boolean {
  const aStart = a.startsAt ? new Date(a.startsAt).getTime() : -Infinity;
  const aEnd = a.endsAt ? new Date(a.endsAt).getTime() : Infinity;
  const bStart = b.startsAt ? new Date(b.startsAt).getTime() : -Infinity;
  const bEnd = b.endsAt ? new Date(b.endsAt).getTime() : Infinity;
  return aStart < bEnd && bStart < aEnd;
}

export async function listAdminPromotions(): Promise<Result<AdminPromotion[]>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from('promotions')
    .select(PROMOTION_SELECT)
    .order('created_at', { ascending: false });

  if (error) {
    return err('INTERNAL_ERROR', 'Não foi possível carregar as promoções.', {
      cause: error,
    });
  }

  return ok((data ?? []).map((row) => mapPromotion(row as PromotionRow)));
}

type PromotionInput = {
  name: string;
  scope: PromotionScope;
  discountPercent: number;
  startsAt?: string | null;
  endsAt?: string | null;
  isActive?: boolean;
  categoryIds?: string[];
  productIds?: string[];
};

function validatePromotionShape(
  input: PromotionInput,
): Result<true> {
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
 * `excludePromotionId` deixa a própria promoção de fora ao editar.
 */
async function findOverlapConflict(
  admin: ReturnType<typeof createAdminSupabaseClient>,
  input: PromotionInput,
  excludePromotionId?: string,
): Promise<Result<true>> {
  if (input.isActive === false) return ok(true);

  const period = { startsAt: input.startsAt ?? null, endsAt: input.endsAt ?? null };

  let query = admin
    .from('promotions')
    .select(PROMOTION_SELECT)
    .eq('scope', input.scope)
    .eq('is_active', true);
  if (excludePromotionId) query = query.neq('id', excludePromotionId);

  const { data, error } = await query;
  if (error) {
    return err('INTERNAL_ERROR', 'Não foi possível validar sobreposição.', {
      cause: error,
    });
  }

  const others = (data ?? []).map((row) => mapPromotion(row as PromotionRow));

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

async function replacePromotionTargets(
  admin: ReturnType<typeof createAdminSupabaseClient>,
  promotionId: string,
  input: Pick<PromotionInput, 'scope' | 'categoryIds' | 'productIds'>,
): Promise<Result<true>> {
  await admin
    .from('promotion_categories')
    .delete()
    .eq('promotion_id', promotionId);
  await admin
    .from('promotion_products')
    .delete()
    .eq('promotion_id', promotionId);

  if (input.scope === 'category' && input.categoryIds?.length) {
    const { error } = await admin.from('promotion_categories').insert(
      input.categoryIds.map((categoryId) => ({
        promotion_id: promotionId,
        category_id: categoryId,
      })),
    );
    if (error) {
      return err('INTERNAL_ERROR', 'Não foi possível vincular categorias.', {
        cause: error,
      });
    }
  }

  if (input.scope === 'products' && input.productIds?.length) {
    const { error } = await admin.from('promotion_products').insert(
      input.productIds.map((productId) => ({
        promotion_id: promotionId,
        product_id: productId,
      })),
    );
    if (error) {
      return err('INTERNAL_ERROR', 'Não foi possível vincular produtos.', {
        cause: error,
      });
    }
  }

  return ok(true);
}

export async function createAdminPromotion(
  input: PromotionInput,
): Promise<Result<AdminPromotion>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const shape = validatePromotionShape(input);
  if (!shape.ok) return shape;

  const admin = createAdminSupabaseClient();

  const overlap = await findOverlapConflict(admin, input);
  if (!overlap.ok) return overlap;

  const { data, error } = await admin
    .from('promotions')
    .insert({
      name: input.name.trim(),
      scope: input.scope,
      discount_percent: input.discountPercent,
      starts_at: input.startsAt || null,
      ends_at: input.endsAt || null,
      is_active: input.isActive ?? true,
    })
    .select('id')
    .single();

  if (error || !data) {
    return err('INTERNAL_ERROR', 'Não foi possível criar a promoção.', {
      cause: error,
    });
  }

  const targets = await replacePromotionTargets(admin, data.id, input);
  if (!targets.ok) return targets;

  await writeAuditLog({
    actorId: auth.data.id,
    action: 'promotion.create',
    entityType: 'promotion',
    entityId: data.id,
    metadata: { name: input.name, scope: input.scope },
  });

  return getAdminPromotion(data.id);
}

export async function getAdminPromotion(
  promotionId: string,
): Promise<Result<AdminPromotion>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from('promotions')
    .select(PROMOTION_SELECT)
    .eq('id', promotionId)
    .maybeSingle();

  if (error) {
    return err('INTERNAL_ERROR', 'Não foi possível carregar a promoção.', {
      cause: error,
    });
  }
  if (!data) return err('NOT_FOUND', 'Promoção não encontrada.');
  return ok(mapPromotion(data as PromotionRow));
}

export async function updateAdminPromotion(
  promotionId: string,
  input: Partial<PromotionInput>,
): Promise<Result<AdminPromotion>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const current = await getAdminPromotion(promotionId);
  if (!current.ok) return current;

  const merged: PromotionInput = {
    name: input.name ?? current.data.name,
    scope: input.scope ?? current.data.scope,
    discountPercent: input.discountPercent ?? current.data.discountPercent,
    startsAt: input.startsAt !== undefined ? input.startsAt : current.data.startsAt,
    endsAt: input.endsAt !== undefined ? input.endsAt : current.data.endsAt,
    isActive: input.isActive ?? current.data.isActive,
    categoryIds: input.categoryIds ?? current.data.categoryIds,
    productIds: input.productIds ?? current.data.productIds,
  };

  const shape = validatePromotionShape(merged);
  if (!shape.ok) return shape;

  const admin = createAdminSupabaseClient();

  const overlap = await findOverlapConflict(admin, merged, promotionId);
  if (!overlap.ok) return overlap;

  const patch: PromotionUpdate = {
    name: merged.name.trim(),
    scope: merged.scope,
    discount_percent: merged.discountPercent,
    starts_at: merged.startsAt || null,
    ends_at: merged.endsAt || null,
    is_active: merged.isActive,
  };

  const { error } = await admin
    .from('promotions')
    .update(patch)
    .eq('id', promotionId);

  if (error) {
    return err('INTERNAL_ERROR', 'Não foi possível atualizar a promoção.', {
      cause: error,
    });
  }

  const targets = await replacePromotionTargets(admin, promotionId, merged);
  if (!targets.ok) return targets;

  await writeAuditLog({
    actorId: auth.data.id,
    action: 'promotion.update',
    entityType: 'promotion',
    entityId: promotionId,
    metadata: { name: merged.name, scope: merged.scope },
  });

  return getAdminPromotion(promotionId);
}

export async function deleteAdminPromotion(
  promotionId: string,
): Promise<Result<true>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from('promotions')
    .delete()
    .eq('id', promotionId)
    .select('id')
    .maybeSingle();

  if (error) {
    return err('INTERNAL_ERROR', 'Não foi possível remover a promoção.', {
      cause: error,
    });
  }
  if (!data) return err('NOT_FOUND', 'Promoção não encontrada.');

  await writeAuditLog({
    actorId: auth.data.id,
    action: 'promotion.delete',
    entityType: 'promotion',
    entityId: promotionId,
  });

  return ok(true);
}
