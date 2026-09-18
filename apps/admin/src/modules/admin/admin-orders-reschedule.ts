import 'server-only';

import { type Result } from '@/lib/errors';
import { requireAdmin } from '@/modules/admin/auth';
import { getAdminOrder } from '@/modules/admin/orders';
import type { AdminOrderDetail } from '@/modules/admin/types';
import {
  applyOrderReschedule,
  getOrderRescheduleOptions,
  type OrderRescheduleOptions,
} from '@/modules/orders/reschedule';

export async function getAdminOrderRescheduleOptions(
  orderId: string,
): Promise<Result<OrderRescheduleOptions>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  return getOrderRescheduleOptions(orderId);
}

export async function rescheduleAdminOrder(options: {
  orderId: string;
  scheduledDate: string;
  scheduledTime: string;
}): Promise<Result<AdminOrderDetail>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const rescheduled = await applyOrderReschedule({
    orderId: options.orderId,
    actorType: 'admin',
    scheduledDate: options.scheduledDate,
    scheduledTime: options.scheduledTime,
  });
  if (!rescheduled.ok) return rescheduled;

  return getAdminOrder(options.orderId);
}
