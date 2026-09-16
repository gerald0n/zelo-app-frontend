import { z } from 'zod';

const orderItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive(),
  customerNote: z.string().max(500).optional(),
  addOns: z
    .array(
      z.object({
        addOnId: z.string().uuid(),
        quantity: z.number().int().positive().default(1),
      }),
    )
    .default([]),
  /** Tamanho da pizza — só presente em itens de pizza. */
  pizzaSizeId: z.string().uuid().optional(),
  /** Segundo sabor (meio a meio) — só presente em itens de pizza. */
  secondaryProductId: z.string().uuid().optional(),
  pizzaAddons: z
    .array(
      z.object({
        pizzaAddonId: z.string().uuid(),
        appliesTo: z.enum(['whole', 'flavor1', 'flavor2']),
      }),
    )
    .default([]),
});

const addressSchema = z.object({
  // Sem `.min(1)`: a coordenada confirmada (latitude/longitude, sempre
  // obrigatória) passa a ser suficiente quando o Google não reconhece a rua.
  street: z.string().optional().default(''),
  number: z.string().optional().default(''),
  neighborhood: z.string().optional().default(''),
  city: z.string().min(1),
  state: z.string().min(1),
  postalCode: z.string().optional(),
  complement: z.string().optional(),
  referencePoint: z.string().optional(),
  latitude: z.number(),
  longitude: z.number(),
  locationSource: z
    .enum(['geocoded', 'current_location', 'manual_pin'])
    .optional(),
  locationAccuracyMeters: z.number().optional(),
  locationDiverged: z.boolean().optional(),
  formattedAddress: z.string().optional(),
});

export const createOrderBodySchema = z.object({
  timing: z.enum(['immediate', 'scheduled']),
  scheduledFor: z.string().optional(),
  deliveryMethod: z.enum(['delivery', 'pickup']),
  paymentMethod: z.enum(['pix', 'cash', 'card']),
  needsChange: z.boolean().optional(),
  changeForAmountCents: z.number().int().positive().optional(),
  customerNote: z.string().max(1000).optional(),
  couponCode: z.string().trim().min(3).max(32).optional(),
  address: addressSchema.optional(),
  items: z.array(orderItemSchema).min(1),
  /** Presente = pedido pro local satélite (São Miguel/RN), não Pereiro. */
  fulfillmentLocationId: z.string().uuid().optional(),
  /**
   * `true` = pedido de "pronta entrega" (lote curado, exclusivo do local
   * satélite). `false`/ausente = encomenda — cardápio normal, vale em
   * qualquer local (Pereiro ou um satélite).
   */
  prontaEntrega: z.boolean().optional(),
});

export type CreateOrderBody = z.infer<typeof createOrderBodySchema>;

export type CreatedOrderSummary = {
  id: string;
  orderNumber: number;
  status: string;
  totalCents: number;
  deliveryFeeCents: number;
  subtotalCents: number;
  couponCode: string | null;
  couponDiscountCents: number;
  routeDistanceMeters: number | null;
};

export type CreatedOrderPix = {
  qrCode: string;
  qrCodeBase64: string;
  ticketUrl: string | null;
  expiresAt: string;
};
