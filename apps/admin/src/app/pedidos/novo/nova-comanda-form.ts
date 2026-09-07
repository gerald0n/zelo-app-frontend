import { z } from 'zod';
import type { ManualOrderItemDraft } from '@/components/admin/AdminManualOrderItemPicker';
import type {
  AdminAddon,
  AdminCategory,
  AdminProduct,
} from '@/modules/admin/types';

export type CatalogResponse = {
  categories: AdminCategory[];
  products: AdminProduct[];
  addons: AdminAddon[];
};

export const manualOrderSchema = z
  .object({
    guestName: z.string().trim().min(1, 'Informe o nome.'),
    guestPhone: z.string().trim().min(8, 'Telefone inválido.'),
    deliveryMethod: z.enum(['pickup', 'delivery']),
    street: z.string().trim().optional(),
    number: z.string().trim().optional(),
    neighborhood: z.string().trim().optional(),
    city: z.string().trim().optional(),
    state: z.string().trim().optional(),
    complement: z.string().trim().optional(),
    referencePoint: z.string().trim().optional(),
    deliveryFeeReais: z.number().min(0),
    timing: z.enum(['immediate', 'scheduled']),
    scheduledFor: z.string().optional(),
    paymentMethod: z.enum(['cash', 'card']),
    alreadyPaid: z.boolean(),
    source: z.enum(['balcao', 'whatsapp', 'instagram']),
    customerNote: z.string().trim().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.deliveryMethod === 'delivery') {
      const required: Array<[keyof typeof value, string]> = [
        ['street', 'Informe a rua.'],
        ['number', 'Informe o número.'],
        ['neighborhood', 'Informe o bairro.'],
        ['city', 'Informe a cidade.'],
        ['state', 'Informe a UF.'],
      ];
      for (const [field, message] of required) {
        if (!value[field]) {
          ctx.addIssue({ code: 'custom', message, path: [field] });
        }
      }
    }
    if (value.timing === 'scheduled' && !value.scheduledFor) {
      ctx.addIssue({
        code: 'custom',
        message: 'Informe data e hora do agendamento.',
        path: ['scheduledFor'],
      });
    }
  });

export type ManualOrderForm = z.infer<typeof manualOrderSchema>;

function reaisToCents(value: number) {
  return Math.round(value * 100);
}

/** Soma prevista dos itens (produto + adicionais) × quantidade. */
export function draftSubtotalCents(
  items: ManualOrderItemDraft[],
  products: AdminProduct[],
  addons: AdminAddon[],
): number {
  const productById = new Map(products.map((p) => [p.id, p]));
  const addonById = new Map(addons.map((a) => [a.id, a]));
  return items.reduce((sum, item) => {
    const product = productById.get(item.productId);
    if (!product) return sum;
    const addonsSum = item.addOnIds.reduce(
      (s, id) => s + (addonById.get(id)?.priceCents ?? 0),
      0,
    );
    return sum + (product.priceCents + addonsSum) * item.quantity;
  }, 0);
}

const SOURCE_LABEL: Record<ManualOrderForm['source'], string> = {
  balcao: 'Balcão presencial',
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
};

/**
 * O backend ainda não tem coluna de canal — registramos como primeira linha
 * da observação para o canal aparecer na comanda e no detalhe do pedido.
 */
function noteWithSource(values: ManualOrderForm): string | null {
  const note = values.customerNote?.trim() ?? '';
  if (values.source === 'balcao') return note || null;
  const prefix = `Canal: ${SOURCE_LABEL[values.source]}`;
  return note ? `${prefix}\n${note}` : prefix;
}

/** Traduz o formulário + itens para o payload da rota POST /api/v1/admin/orders. */
export function buildManualOrderPayload(
  values: ManualOrderForm,
  items: ManualOrderItemDraft[],
) {
  return {
    guestName: values.guestName,
    guestPhone: values.guestPhone,
    items: items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      customerNote: item.customerNote || null,
      addOns: item.addOnIds.map((addOnId) => ({ addOnId, quantity: 1 })),
    })),
    deliveryMethod: values.deliveryMethod,
    timing: values.timing,
    scheduledFor:
      values.timing === 'scheduled' && values.scheduledFor
        ? new Date(values.scheduledFor).toISOString()
        : null,
    address:
      values.deliveryMethod === 'delivery'
        ? {
            street: values.street ?? '',
            number: values.number ?? '',
            neighborhood: values.neighborhood ?? '',
            city: values.city ?? '',
            state: values.state ?? '',
            complement: values.complement || null,
            referencePoint: values.referencePoint || null,
          }
        : null,
    deliveryFeeCents:
      values.deliveryMethod === 'delivery'
        ? reaisToCents(values.deliveryFeeReais)
        : undefined,
    paymentMethod: values.paymentMethod,
    alreadyPaid: values.alreadyPaid,
    customerNote: noteWithSource(values),
  };
}
