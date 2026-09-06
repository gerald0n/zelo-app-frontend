import 'server-only';

import { err, type Result } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/modules/admin/auth';
import { getAdminOrder } from '@/modules/admin/orders';
import type { AdminOrderDetail } from '@/modules/admin/types';

export async function createManualAdminOrder(input: {
  guestName: string;
  guestPhoneE164: string;
  items: Array<{
    productId: string;
    quantity: number;
    customerNote?: string | null;
    addOns: Array<{ addOnId: string; quantity: number }>;
  }>;
  deliveryMethod: 'pickup' | 'delivery';
  timing: 'immediate' | 'scheduled';
  scheduledFor?: string | null;
  address?: {
    street: string;
    number: string;
    neighborhood: string;
    city: string;
    state: string;
    postalCode?: string | null;
    complement?: string | null;
    referencePoint?: string | null;
  } | null;
  deliveryFeeCents?: number;
  paymentMethod: 'cash' | 'card';
  alreadyPaid: boolean;
  customerNote?: string | null;
}): Promise<Result<AdminOrderDetail>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc('create_manual_order', {
    payload: {
      guest_name: input.guestName,
      guest_phone_e164: input.guestPhoneE164,
      items: input.items.map((item) => ({
        product_id: item.productId,
        quantity: item.quantity,
        customer_note: item.customerNote ?? null,
        add_ons: item.addOns.map((addon) => ({
          add_on_id: addon.addOnId,
          quantity: addon.quantity,
        })),
      })),
      delivery_method: input.deliveryMethod,
      timing: input.timing,
      scheduled_for: input.scheduledFor ?? null,
      address: input.address
        ? {
            street: input.address.street,
            number: input.address.number,
            neighborhood: input.address.neighborhood,
            city: input.address.city,
            state: input.address.state,
            postal_code: input.address.postalCode ?? null,
            complement: input.address.complement ?? null,
            reference_point: input.address.referencePoint ?? null,
          }
        : null,
      delivery_fee_cents: input.deliveryFeeCents ?? null,
      payment_method: input.paymentMethod,
      already_paid: input.alreadyPaid,
      customer_note: input.customerNote ?? null,
    },
  });

  if (error || !data) {
    logger.error('Falha ao criar comanda manual', {
      message: error?.message,
    });
    return err(
      'VALIDATION_ERROR',
      error?.message || 'Não foi possível criar a comanda.',
      { cause: error },
    );
  }

  return getAdminOrder(data);
}
