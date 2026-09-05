import { formatCatalogPrice } from '@/modules/catalog/types';
import { ReceiptBuilder } from '@/modules/printing/escpos';
import { RECEIPT_LOGO } from '@/modules/printing/logo';
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

function writeKitchenItems(builder: ReceiptBuilder, items: ReceiptItem[]) {
  items.forEach((item, index) => {
    if (index > 0) builder.line();
    // Altura dobrada (não largura) — nome de produto comprido não quebra.
    builder
      .doubleHeight(true)
      .bold(true)
      .line(`${item.quantity}x ${item.name}`)
      .bold(false)
      .doubleHeight(false);
    for (const addOn of item.addOns) {
      builder
        .doubleHeight(true)
        .line(`  + ${addOn.quantity}x ${addOn.name}`)
        .doubleHeight(false);
    }
    if (item.note) {
      builder
        .doubleHeight(true)
        .bold(true)
        .line(`  Obs.: ${item.note}`)
        .bold(false)
        .doubleHeight(false);
    }
  });
}

/**
 * Comanda de cozinha — só o que precisa ser feito. Sem preço; endereço só
 * quando é entrega. Tudo em corpo grande de propósito, pra ler de longe na
 * bancada.
 */
export function buildKitchenTicket(data: KitchenTicketData): Uint8Array {
  const builder = new ReceiptBuilder().init().align('center');

  builder.image(RECEIPT_LOGO).feed(1);

  builder
    .doubleSize(true)
    .bold(true)
    .line(`PEDIDO ${data.orderNumber}`)
    .doubleSize(false)
    .doubleHeight(true)
    .line(formatDateTime(data.createdAt))
    .doubleHeight(false)
    .bold(false);
  builder.divider();

  builder
    .doubleSize(true)
    .bold(true)
    .line(data.deliveryMethod === 'delivery' ? 'ENTREGA' : 'RETIRADA')
    .bold(false)
    .doubleSize(false);
  if (data.timing === 'scheduled' && data.scheduledFor) {
    builder
      .doubleSize(true)
      .bold(true)
      .line('AGENDADO')
      .line(formatDateTime(data.scheduledFor))
      .bold(false)
      .doubleSize(false);
  }
  if (data.isGuest) builder.line('(cliente avulso, sem cadastro)');

  builder.align('left').divider();

  builder.doubleHeight(true);
  if (data.customerName) {
    builder.bold(true).line(`Cliente: ${data.customerName}`).bold(false);
  }
  if (data.customerPhone) builder.line(`Tel: ${data.customerPhone}`);
  if (data.address) {
    builder.bold(true).line('Endereço:').bold(false);
    builder.line(data.address.formatted);
    if (data.address.referencePoint) {
      builder.line(`Ref.: ${data.address.referencePoint}`);
    }
  }
  builder.doubleHeight(false);
  if (data.customerName || data.customerPhone || data.address) {
    builder.divider();
  }

  writeKitchenItems(builder, data.items);
  builder.divider();

  if (data.customerNote) {
    builder
      .doubleSize(true)
      .bold(true)
      .line('OBS. CLIENTE')
      .doubleSize(false)
      .doubleHeight(true)
      .line(data.customerNote)
      .doubleHeight(false)
      .bold(false)
      .divider();
  }
  if (data.internalNote) {
    builder
      .bold(true)
      .doubleHeight(true)
      .line('RECADO INTERNO')
      .line(data.internalNote)
      .doubleHeight(false)
      .bold(false)
      .divider();
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

  builder.image(RECEIPT_LOGO).feed(1);
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
    .image(RECEIPT_LOGO)
    .feed(1)
    .doubleSize(true)
    .bold(true)
    .line('TESTE OK')
    .bold(false)
    .doubleSize(false)
    .doubleHeight(true)
    .line('Acentuação: ção, ãäé')
    .line('R$ 1,00')
    .doubleHeight(false)
    .line(new Date().toLocaleString('pt-BR'))
    .cut()
    .toBytes();
}
