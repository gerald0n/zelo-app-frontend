export const adminKeys = {
  all: ['admin'] as const,
  catalog: () => [...adminKeys.all, 'catalog'] as const,
  orders: (scope: string, query = '') =>
    [...adminKeys.all, 'orders', scope, query] as const,
  order: (id: string) => [...adminKeys.all, 'order', id] as const,
  store: () => [...adminKeys.all, 'store'] as const,
  hours: () => [...adminKeys.all, 'hours'] as const,
  blackouts: () => [...adminKeys.all, 'blackouts'] as const,
  audit: () => [...adminKeys.all, 'audit'] as const,
  reports: (period: string) => [...adminKeys.all, 'reports', period] as const,
  reviews: (tab: string) => [...adminKeys.all, 'reviews', tab] as const,
  productReviews: (tab: string) =>
    [...adminKeys.all, 'product-reviews', tab] as const,
  reviewsPending: () => [...adminKeys.all, 'reviews-pending'] as const,
  pixRefundsPending: () => [...adminKeys.all, 'pix-refunds-pending'] as const,
};

export const catalogKeys = {
  store: () => ['catalog', 'store'] as const,
};
