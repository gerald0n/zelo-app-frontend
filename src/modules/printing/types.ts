export type PrinterStatus = 'unsupported' | 'unpaired' | 'ready' | 'error';

export type ReceiptItem = {
  name: string;
  quantity: number;
  addOns: Array<{ name: string; quantity: number }>;
  note: string | null;
};

/** Vai pra cozinha assim que o pedido entra no sistema. */
export type KitchenTicketData = {
  orderNumber: string;
  createdAt: string;
  deliveryMethod: 'delivery' | 'pickup';
  timing: 'immediate' | 'scheduled';
  scheduledFor: string | null;
  isGuest: boolean;
  items: ReceiptItem[];
  customerNote: string | null;
  internalNote: string | null;
};

/** Grampeada no pedido quando ele fica pronto pra entrega/retirada. */
export type DeliverySlipData = {
  store: {
    name: string;
    cnpj: string | null;
    addressLine: string;
    city: string;
    state: string;
    phoneE164: string;
  };
  orderNumber: string;
  createdAt: string;
  deliveryMethod: 'delivery' | 'pickup';
  customerName: string | null;
  customerPhone: string | null;
  address: {
    formatted: string;
    referencePoint: string | null;
  } | null;
  items: ReceiptItem[];
  customerNote: string | null;
  subtotalCents: number;
  deliveryFeeCents: number;
  totalCents: number;
  paymentMethod: 'pix' | 'cash' | 'card';
  paymentStatus: string;
  needsChange: boolean | null;
  changeForAmountCents: number | null;
};
