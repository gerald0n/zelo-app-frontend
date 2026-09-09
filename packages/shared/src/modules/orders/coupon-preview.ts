import 'server-only';

import { z } from 'zod';
import { err, ok, type Result } from '@/lib/errors';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const couponPreviewSchema = z.object({
  code: z.string().trim().min(1).max(32),
  subtotalCents: z.number().int().nonnegative(),
  deliveryFeeCents: z.number().int().nonnegative(),
  /** Produtos no carrinho — o servidor resolve se há promoção ativa. */
  productIds: z.array(z.string().uuid()).min(1).max(100),
});

export type CouponPreviewInput = z.infer<typeof couponPreviewSchema>;

export type CouponDiscountType = 'percent' | 'fixed' | 'free_shipping';

export type CouponPreview =
  | {
      valid: true;
      code: string;
      discountType: CouponDiscountType;
      discountCents: number;
    }
  | { valid: false; reason: string };

/**
 * Checagem read-only do cupom pro checkout (não conta uso). A palavra final é
 * de `private.create_order` na hora de enviar o pedido — aqui é só pra mostrar
 * o desconto antes.
 */
export async function previewOrderCoupon(
  input: CouponPreviewInput,
): Promise<Result<CouponPreview>> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc('preview_coupon', {
    p_code: input.code,
    p_subtotal_cents: input.subtotalCents,
    p_delivery_fee_cents: input.deliveryFeeCents,
    p_product_ids: input.productIds,
  });

  if (error) {
    return err('INTERNAL_ERROR', 'Não foi possível validar o cupom.', {
      cause: error,
    });
  }

  return ok(data as CouponPreview);
}
