import 'server-only';

// Fachada do fluxo Pix de pedido. Implementação em ./order-pix-*:
//   - order-pix-charge:   criação/regeneração da cobrança e a view do cliente
//   - order-pix-webhook:  processamento de notificação do Mercado Pago + estorno
//   - order-pix-reconcile: varredura de reconciliação (cron)
// Barrel: preserva a interface pública de '@/modules/payments/order-pix'.

export * from '@/modules/payments/order-pix-charge';
export * from '@/modules/payments/order-pix-webhook';
export * from '@/modules/payments/order-pix-reconcile';
