import 'server-only';

import { err, ok, type Result } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getPublicCatalog } from '@/modules/catalog/catalog-repository';
import { getSatelliteLocation } from '@/modules/catalog/satellite-repository';
import {
  listAvailableScheduleDates,
  listAvailableScheduleTimes,
  resolveCartSchedulingRule,
} from '@/modules/scheduling/schedule';
import {
  listSatelliteActiveDates,
  listSatelliteDeliverySlots,
  listSatellitePickupWindow,
} from '@/modules/scheduling/satellite-slots';
import {
  RESCHEDULABLE_STATUSES,
  type DeliveryMethod,
  type OrderStatus,
} from '@/modules/orders/types';

/**
 * Grade de dias/horários disponíveis pra reagendar UM pedido específico —
 * já filtrada pela regra de agendamento dos itens dele (ou pela agenda da
 * unidade satélite, quando é o caso). Normaliza os dois motores de agenda
 * (Pereiro por categoria vs. satélite por janela/slots fixos) num único
 * formato `availableDates` + `timesByDate`, pra UI não precisar saber qual
 * dos dois está por trás.
 */
export type OrderRescheduleOptions = {
  orderId: string;
  status: OrderStatus;
  deliveryMethod: DeliveryMethod;
  currentScheduledFor: string;
  availableDates: string[];
  timesByDate: Record<string, string[]>;
};

type OrderForReschedule = {
  id: string;
  status: OrderStatus;
  timing: 'immediate' | 'scheduled';
  scheduled_for: string | null;
  delivery_method: DeliveryMethod;
  fulfillment_location_id: string | null;
  order_items: Array<{ product_id: string | null }> | null;
};

async function loadOrderForReschedule(
  orderId: string,
): Promise<Result<OrderForReschedule>> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from('orders')
    .select(
      'id, status, timing, scheduled_for, delivery_method, fulfillment_location_id, order_items ( product_id )',
    )
    .eq('id', orderId)
    .maybeSingle();

  if (error) {
    logger.error('Falha ao carregar pedido para reagendamento', {
      message: error.message,
    });
    return err('INTERNAL_ERROR', 'Não foi possível carregar o pedido.', {
      cause: error,
    });
  }
  if (!data) return err('NOT_FOUND', 'Pedido não encontrado.');

  return ok(data as unknown as OrderForReschedule);
}

export async function getOrderRescheduleOptions(
  orderId: string,
): Promise<Result<OrderRescheduleOptions>> {
  const loaded = await loadOrderForReschedule(orderId);
  if (!loaded.ok) return loaded;
  const order = loaded.data;

  if (order.timing !== 'scheduled' || !order.scheduled_for) {
    return err('VALIDATION_ERROR', 'Este pedido não é agendado.');
  }
  if (!RESCHEDULABLE_STATUSES.includes(order.status)) {
    return err(
      'VALIDATION_ERROR',
      'Este pedido não pode mais ser reagendado.',
    );
  }

  const deliveryMethod = order.delivery_method;

  if (order.fulfillment_location_id) {
    const locationResult = await getSatelliteLocation();
    if (!locationResult.ok) return locationResult;
    const location = locationResult.data;
    if (!location || location.id !== order.fulfillment_location_id) {
      return err('NOT_FOUND', 'Unidade não encontrada.');
    }

    const dates = listSatelliteActiveDates(location);
    const timesByDate: Record<string, string[]> = {};
    for (const date of dates) {
      if (deliveryMethod === 'pickup') {
        const window = listSatellitePickupWindow(location, date);
        timesByDate[date] = window ? [window.opensAt.slice(0, 5)] : [];
      } else {
        timesByDate[date] = listSatelliteDeliverySlots(location, date).map(
          (slot) => slot.startsAt.slice(0, 5),
        );
      }
    }

    return ok({
      orderId,
      status: order.status,
      deliveryMethod,
      currentScheduledFor: order.scheduled_for,
      availableDates: dates,
      timesByDate,
    });
  }

  const catalogResult = await getPublicCatalog();
  if (!catalogResult.ok) return catalogResult;
  const { store, categories, products } = catalogResult.data;
  if (!store) return err('NOT_FOUND', 'Loja não encontrada.');

  const productIds = (order.order_items ?? [])
    .map((item) => item.product_id)
    .filter((id): id is string => Boolean(id));
  const { rule } = resolveCartSchedulingRule(categories, products, productIds);

  const dates = listAvailableScheduleDates(store, { deliveryMethod, rule });
  const timesByDate: Record<string, string[]> = {};
  for (const date of dates) {
    timesByDate[date] = listAvailableScheduleTimes(
      store,
      date,
      deliveryMethod,
      rule,
    );
  }

  return ok({
    orderId,
    status: order.status,
    deliveryMethod,
    currentScheduledFor: order.scheduled_for,
    availableDates: dates,
    timesByDate,
  });
}

export async function applyOrderReschedule(options: {
  orderId: string;
  actorType: 'admin' | 'customer';
  scheduledDate: string;
  scheduledTime: string;
}): Promise<Result<true>> {
  const optionsResult = await getOrderRescheduleOptions(options.orderId);
  if (!optionsResult.ok) return optionsResult;

  const { availableDates, timesByDate } = optionsResult.data;
  if (!availableDates.includes(options.scheduledDate)) {
    return err('VALIDATION_ERROR', 'Data indisponível para este pedido.');
  }
  const times = timesByDate[options.scheduledDate] ?? [];
  if (!times.includes(options.scheduledTime)) {
    return err('VALIDATION_ERROR', 'Horário indisponível para esta data.');
  }

  // Mesmo formato usado na criação do pedido (checkout): data/hora local +
  // offset fixo de Fortaleza, sem conversão de timezone (ver
  // `build-order-request-body.ts`).
  const scheduledFor = `${options.scheduledDate}T${options.scheduledTime}:00-03:00`;

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc('reschedule_order', {
    p_order_id: options.orderId,
    p_actor_type: options.actorType,
    p_new_scheduled_for: scheduledFor,
  });

  if (error) {
    logger.error('Reagendamento falhou', { message: error.message });
    return err(
      'VALIDATION_ERROR',
      error.message || 'Reagendamento não permitido para este pedido.',
      { cause: error },
    );
  }

  return ok(true);
}
