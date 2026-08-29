import { hasCustomerName } from '@/modules/auth/customer-name';

export function checkoutContinuePath(user: { name: string } | null): string {
  if (!user) return '/checkout/identificacao';
  if (!hasCustomerName(user.name)) return '/checkout/nome';
  return '/checkout/recebimento';
}
