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
});

const addressSchema = z.object({
  street: z.string().min(1),
  number: z.string().min(1),
  neighborhood: z.string().optional().default(''),
  city: z.string().min(1),
  state: z.string().min(1),
  postalCode: z.string().optional(),
  complement: z.string().optional(),
  referencePoint: z.string().optional(),
  latitude: z.number(),
  longitude: z.number(),
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
