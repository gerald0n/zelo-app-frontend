import { z } from 'zod';

export const storeSchema = z
  .object({
    name: z.string().trim().min(1, 'Informe o nome.'),
    cnpj: z.string().optional(),
    phoneE164: z.string().trim().min(8, 'Telefone inválido.'),
    whatsappE164: z.string().trim().min(8, 'WhatsApp inválido.'),
    addressLine: z.string().trim().min(1, 'Informe o endereço.'),
    city: z.string().trim().min(1),
    state: z.string().trim().length(2, 'Use a UF com 2 letras.'),
    postalCode: z.string().optional(),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    freeDeliveryRadiusMeters: z.number().int().min(0),
    maxDeliveryRadiusMeters: z.number().int().min(0),
    fixedDeliveryFeeReais: z.number().min(0),
    paymentFeeEstimatePercent: z.number().min(0).max(20),
    acceptingOrders: z.boolean(),
    acceptsPix: z.boolean(),
    acceptsCash: z.boolean(),
    acceptsCard: z.boolean(),
  })
  .superRefine((value, ctx) => {
    if (!value.acceptsPix && !value.acceptsCash && !value.acceptsCard) {
      ctx.addIssue({
        code: 'custom',
        message: 'Mantenha ao menos uma forma de pagamento habilitada.',
        path: ['acceptsPix'],
      });
    }
    if (value.maxDeliveryRadiusMeters < value.freeDeliveryRadiusMeters) {
      ctx.addIssue({
        code: 'custom',
        message: 'O raio máximo deve ser maior ou igual ao raio grátis.',
        path: ['maxDeliveryRadiusMeters'],
      });
    }
  });

export const blackoutSchema = z.object({
  startsAt: z.string().min(1, 'Informe o início.'),
  endsAt: z.string().min(1, 'Informe o fim.'),
  reason: z.string().optional(),
});

export type StoreForm = z.infer<typeof storeSchema>;
export type BlackoutForm = z.infer<typeof blackoutSchema>;
export type HourFormRow = {
  weekday: number;
  opensAt: string;
  closesAt: string;
  isClosed: boolean;
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
};

export const SLOT_TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function toLocalInputValue(iso: string) {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function fromLocalInputValue(value: string) {
  return new Date(value).toISOString();
}
