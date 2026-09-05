import { formatCatalogPrice } from '@/modules/catalog/types';
import { ReceiptBuilder } from '@/modules/printing/escpos';
import type {
  DeliverySlipData,
  KitchenTicketData,
  ReceiptItem,
} from '@/modules/printing/types';

function formatClock(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function writeItems(builder: ReceiptBuilder, items: ReceiptItem[]) {
  for (const item of items) {
    builder.bold(true).line(`${item.quantity}x ${item.name}`).bold(false);
    for (const addOn of item.addOns) {
      builder.line(`   + ${addOn.quantity}x ${addOn.name}`);
    }
    if (item.note) builder.line(`   Obs.: ${item.note}`);
  }
}

/** Comanda de cozinha — só o que precisa ser feito, sem preço nem endereço. */
export function buildKitchenTicket(data: KitchenTicketData): Uint8Array {
  const builder = new ReceiptBuilder().init().align('center');

  builder.doubleSize(true).bold(true).line('COMANDA').bold(false).doubleSize(false);
  builder.line(`Pedido ${data.orderNumber}`);
  builder.line(formatDateTime(data.createdAt));
  builder.align('left').divider();

  builder.bold(true);
  builder.line(
    data.deliveryMethod === 'delivery' ? 'ENTREGA' : 'RETIRADA',
  );
  builder.bold(false);
  if (data.timing === 'scheduled' && data.scheduledFor) {
    builder.line(`Agendado: ${formatDateTime(data.scheduledFor)}`);
  }
  if (data.isGuest) builder.line('Cliente avulso (sem cadastro)');
  builder.divider();

  writeItems(builder, data.items);
  builder.divider();

  if (data.customerNote) {
    builder.line('Obs. cliente:').line(data.customerNote).divider();
  }
  if (data.internalNote) {
    builder.line('Recado interno:').line(data.internalNote).divider();
  }

  return builder.cut().toBytes();
}

const PAYMENT_LABEL: Record<DeliverySlipData['paymentMethod'], string> = {
  pix: 'Pix',
  cash: 'Dinheiro',
  card: 'Cartão',
};

function paymentStatusLabel(status: string): string {
  const map: Record<string, string> = {
    confirmed: 'Pago',
    refunded: 'Estornado',
    failed: 'Não pago',
    cancelled: 'Cancelado',
    pending: 'Aguardando',
  };
  return map[status] ?? status;
}

/** Grampeada no pedido — o que ajuda o entregador/cliente a se situar. */
export function buildDeliverySlip(data: DeliverySlipData): Uint8Array {
  const builder = new ReceiptBuilder().init().align('center');

  builder.bold(true).line(data.store.name).bold(false);
  builder.line('DOCUMENTO NÃO FISCAL');
  if (data.store.cnpj) builder.line(`CNPJ ${data.store.cnpj} · MEI`);
  builder.line(`${data.store.addressLine} - ${data.store.city}/${data.store.state}`);
  builder.line(`Tel/WhatsApp: ${data.store.phoneE164}`);
  builder.align('left').divider();

  builder.line(`Pedido ${data.orderNumber}        ${formatClock(data.createdAt)}`);
  builder.line(`Tipo: ${data.deliveryMethod === 'delivery' ? 'ENTREGA' : 'RETIRADA'}`);
  if (data.customerName) builder.line(`Cliente: ${data.customerName}`);
  if (data.customerPhone) builder.line(`Tel: ${data.customerPhone}`);
  if (data.address) {
    builder.line(`Endereço: ${data.address.formatted}`);
    if (data.address.referencePoint) {
      builder.line(`Referência: ${data.address.referencePoint}`);
    }
  }
  builder.divider();

  writeItems(builder, data.items);
  builder.divider();

  if (data.customerNote) {
    builder.line(`Obs. cliente: ${data.customerNote}`).divider();
  }

  builder.row('Subtotal:', formatCatalogPrice(data.subtotalCents));
  builder.row('Entrega:', formatCatalogPrice(data.deliveryFeeCents));
  builder.bold(true).row('TOTAL:', formatCatalogPrice(data.totalCents)).bold(false);
  builder.line(
    `Pagamento: ${PAYMENT_LABEL[data.paymentMethod]} · ${paymentStatusLabel(data.paymentStatus)}`,
  );
  if (data.needsChange && data.changeForAmountCents != null) {
    builder.line(`Levar troco para ${formatCatalogPrice(data.changeForAmountCents)}`);
  }
  builder.divider();
  builder.align('center').line('Obrigado pela preferência!');

  return builder.cut().toBytes();
}

export function buildTestPrint(): Uint8Array {
  return new ReceiptBuilder()
    .init()
    .align('center')
    .bold(true)
    .line('Teste de impressão OK')
    .bold(false)
    .line(new Date().toLocaleString('pt-BR'))
    .cut()
    .toBytes();
}
