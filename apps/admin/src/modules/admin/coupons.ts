import 'server-only';

import { err, ok, type Result } from '@/lib/errors';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { writeAuditLog } from '@/modules/admin/audit';
import { requireAdmin } from '@/modules/admin/auth';
import type { AdminCoupon, CouponDiscountType } from '@/modules/admin/types';
import type { Database } from '@/types/database';

type CouponRow = Database['public']['Tables']['coupons']['Row'];
type CouponUpdate = Database['public']['Tables']['coupons']['Update'];

const SELECT =
  'id, code, discount_type, discount_value, max_uses, uses_count, is_active, starts_at, ends_at';

function mapCoupon(row: CouponRow): AdminCoupon {
  return {
    id: row.id,
    code: row.code,
    discountType: row.discount_type as CouponDiscountType,
    discountValue: row.discount_value,
    maxUses: row.max_uses,
    usesCount: row.uses_count,
    isActive: row.is_active,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
  };
}

export type CouponInput = {
  code: string;
  discountType: CouponDiscountType;
  discountValue: number;
  maxUses: number;
  isActive?: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
};

/** Normaliza e valida a forma do cupom antes de gravar. */
function normalize(input: CouponInput): Result<CouponInput> {
  const code = input.code.trim().toUpperCase();
  if (!/^[A-Z0-9]{3,32}$/.test(code)) {
    return err(
      'VALIDATION_ERROR',
      'O código deve ter 3 a 32 caracteres (letras e números).',
    );
  }
  if (!Number.isInteger(input.maxUses) || input.maxUses < 1) {
    return err('VALIDATION_ERROR', 'Limite de usos deve ser 1 ou mais.');
  }
  if (input.discountType === 'percent') {
    if (
      !Number.isInteger(input.discountValue) ||
      input.discountValue < 1 ||
      input.discountValue > 100
    ) {
      return err('VALIDATION_ERROR', 'Percentual deve ser entre 1 e 100.');
    }
  } else if (input.discountType === 'fixed') {
    if (!Number.isInteger(input.discountValue) || input.discountValue < 1) {
      return err('VALIDATION_ERROR', 'Valor fixo deve ser maior que zero.');
    }
  }
  const startsAt = input.startsAt || null;
  const endsAt = input.endsAt || null;
  if (startsAt && endsAt && new Date(startsAt) >= new Date(endsAt)) {
    return err('VALIDATION_ERROR', 'O início deve ser antes do fim.');
  }
  return ok({
    code,
    discountType: input.discountType,
    discountValue:
      input.discountType === 'free_shipping' ? 0 : input.discountValue,
    maxUses: input.maxUses,
    isActive: input.isActive,
    startsAt,
    endsAt,
  });
}

export async function listAdminCoupons(): Promise<Result<AdminCoupon[]>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from('coupons')
    .select(SELECT)
    .order('created_at', { ascending: false });

  if (error) {
    return err('INTERNAL_ERROR', 'Não foi possível carregar os cupons.', {
      cause: error,
    });
  }
  return ok((data ?? []).map((row) => mapCoupon(row as CouponRow)));
}

export async function createAdminCoupon(
  input: CouponInput,
): Promise<Result<AdminCoupon>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const clean = normalize(input);
  if (!clean.ok) return clean;

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from('coupons')
    .insert({
      code: clean.data.code,
      discount_type: clean.data.discountType,
      discount_value: clean.data.discountValue,
      max_uses: clean.data.maxUses,
      is_active: clean.data.isActive ?? true,
      starts_at: clean.data.startsAt,
      ends_at: clean.data.endsAt,
    })
    .select(SELECT)
    .single();

  if (error || !data) {
    if (error?.code === '23505') {
      return err('VALIDATION_ERROR', 'Já existe um cupom com esse código.');
    }
    return err('INTERNAL_ERROR', 'Não foi possível criar o cupom.', {
      cause: error,
    });
  }

  await writeAuditLog({
    actorId: auth.data.id,
    action: 'coupon.create',
    entityType: 'coupon',
    entityId: data.id,
    metadata: { code: data.code, type: data.discount_type },
  });

  return ok(mapCoupon(data as CouponRow));
}

export async function updateAdminCoupon(options: {
  couponId: string;
  input: Partial<CouponInput>;
}): Promise<Result<AdminCoupon>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const admin = createAdminSupabaseClient();
  const { data: current, error: findError } = await admin
    .from('coupons')
    .select(SELECT)
    .eq('id', options.couponId)
    .maybeSingle();
  if (findError) {
    return err('INTERNAL_ERROR', 'Não foi possível carregar o cupom.', {
      cause: findError,
    });
  }
  if (!current) return err('NOT_FOUND', 'Cupom não encontrado.');

  const merged = normalize({
    code: options.input.code ?? current.code,
    discountType:
      options.input.discountType ??
      (current.discount_type as CouponDiscountType),
    discountValue: options.input.discountValue ?? current.discount_value,
    maxUses: options.input.maxUses ?? current.max_uses,
    isActive: options.input.isActive ?? current.is_active,
    startsAt:
      options.input.startsAt !== undefined
        ? options.input.startsAt
        : current.starts_at,
    endsAt:
      options.input.endsAt !== undefined
        ? options.input.endsAt
        : current.ends_at,
  });
  if (!merged.ok) return merged;

  if (merged.data.maxUses < current.uses_count) {
    return err(
      'VALIDATION_ERROR',
      `O cupom já foi usado ${current.uses_count} vez(es).`,
    );
  }

  const patch: CouponUpdate = {
    code: merged.data.code,
    discount_type: merged.data.discountType,
    discount_value: merged.data.discountValue,
    max_uses: merged.data.maxUses,
    is_active: merged.data.isActive ?? current.is_active,
    starts_at: merged.data.startsAt,
    ends_at: merged.data.endsAt,
  };

  const { data, error } = await admin
    .from('coupons')
    .update(patch)
    .eq('id', options.couponId)
    .select(SELECT)
    .single();

  if (error || !data) {
    if (error?.code === '23505') {
      return err('VALIDATION_ERROR', 'Já existe um cupom com esse código.');
    }
    return err('INTERNAL_ERROR', 'Não foi possível atualizar o cupom.', {
      cause: error,
    });
  }

  await writeAuditLog({
    actorId: auth.data.id,
    action: 'coupon.update',
    entityType: 'coupon',
    entityId: options.couponId,
    metadata: patch,
  });

  return ok(mapCoupon(data as CouponRow));
}

export async function deleteAdminCoupon(
  couponId: string,
): Promise<Result<true>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const admin = createAdminSupabaseClient();
  // `orders.coupon_id` é `on delete set null` — o histórico do pedido guarda
  // `coupon_code`/`coupon_discount_cents`, então apagar não corrompe nada.
  const { data, error } = await admin
    .from('coupons')
    .delete()
    .eq('id', couponId)
    .select('id')
    .maybeSingle();

  if (error) {
    return err('INTERNAL_ERROR', 'Não foi possível remover o cupom.', {
      cause: error,
    });
  }
  if (!data) return err('NOT_FOUND', 'Cupom não encontrado.');

  await writeAuditLog({
    actorId: auth.data.id,
    action: 'coupon.delete',
    entityType: 'coupon',
    entityId: couponId,
  });

  return ok(true);
}
