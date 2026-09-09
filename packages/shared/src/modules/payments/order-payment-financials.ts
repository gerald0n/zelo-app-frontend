import 'server-only';

import { logger } from '@/lib/logger';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { getMercadoPagoPaymentFinancials } from '@/modules/payments/mercadopago';

/**
 * Puxa taxa/líquido reais do pagamento (1 chamada extra ao MP) e grava no
 * pedido. Silencioso em qualquer falha — sem `mpPaymentId`, MP fora do ar ou
 * campos ausentes o relatório financeiro cai na taxa estimada.
 */
export async function recordPaymentFinancials(
  orderId: string,
  mpPaymentId: string | null | undefined,
): Promise<void> {
  if (!mpPaymentId) return;

  const fin = await getMercadoPagoPaymentFinancials(mpPaymentId);
  if (!fin.ok || !fin.data) {
    logger.warn('Pix confirmado sem taxa real (usará estimativa)', {
      orderId,
      mpPaymentId,
    });
    return;
  }

  const admin = createAdminSupabaseClient();
  const { error } = await admin
    .from('orders')
    .update({
      mp_payment_id: fin.data.mpPaymentId,
      payment_fee_cents: fin.data.feeCents,
      payment_net_cents: fin.data.netCents,
    })
    .eq('id', orderId);

  if (error) {
    logger.warn('Falha ao gravar taxa do Pix no pedido', {
      orderId,
      message: error.message,
    });
  }
}
