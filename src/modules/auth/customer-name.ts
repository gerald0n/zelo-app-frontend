/** Nome preenchido o bastante para Pedido e painel. */
export function hasCustomerName(name: string | null | undefined): boolean {
  return (name?.trim().length ?? 0) >= 2;
}
