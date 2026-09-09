import type { AdminAuditLog } from '@/modules/admin/types';

/** Ação do log → frase curta em pt-br. */
const ACTION_LABELS: Record<string, string> = {
  'product.create': 'Produto criado',
  'product.update': 'Produto atualizado',
  'product.archive': 'Produto arquivado',
  'product.duplicate': 'Produto duplicado',
  'product.reorder': 'Produtos reordenados',
  'product.image.upload': 'Imagem adicionada ao produto',
  'product.image.set_primary': 'Imagem principal do produto definida',
  'product.image.reorder': 'Imagens do produto reordenadas',
  'product.image.delete': 'Imagem do produto removida',
  'category.create': 'Categoria criada',
  'category.update': 'Categoria atualizada',
  'category.archive': 'Categoria arquivada',
  'category.reorder': 'Categorias reordenadas',
  'addon.create': 'Adicional criado',
  'addon.update': 'Adicional atualizado',
  'addon.archive': 'Adicional arquivado',
  'coupon.create': 'Cupom criado',
  'coupon.update': 'Cupom atualizado',
  'coupon.delete': 'Cupom excluído',
  'promotion.create': 'Promoção criada',
  'promotion.update': 'Promoção atualizada',
  'promotion.delete': 'Promoção excluída',
  'store.update': 'Configurações da loja atualizadas',
  'store.business_hours.update': 'Horário de funcionamento atualizado',
  'store.blackout.create': 'Bloqueio de agenda criado',
  'store.blackout.delete': 'Bloqueio de agenda removido',
  'store.pause': 'Loja pausada',
  'store.resume': 'Loja reaberta',
  'review.moderate': 'Avaliação moderada',
};

export function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

/** Chave do "patch" (coluna do banco ou campo do form) → rótulo em pt-br. */
const FIELD_LABELS: Record<string, string> = {
  name: 'nome',
  description: 'descrição',
  slug: 'endereço (slug)',
  price_cents: 'preço',
  category_id: 'categoria',
  sort_order: 'ordem',
  is_active: 'ativo',
  is_available: 'disponibilidade',
  weight_min_grams: 'peso mínimo',
  weight_max_grams: 'peso máximo',
  stock_quantity: 'estoque',
  addonIds: 'adicionais',
  priceChanged: 'preço',
  availabilityChanged: 'disponibilidade',
  price_cents_min: 'preço',
  // cupom
  code: 'código',
  discount_type: 'tipo de desconto',
  discount_value: 'valor do desconto',
  min_order_cents: 'pedido mínimo',
  max_redemptions: 'limite de usos',
  expires_at: 'validade',
  // loja
  phone_e164: 'telefone',
  whatsapp_e164: 'WhatsApp',
  address_line: 'endereço',
  city: 'cidade',
  state: 'estado',
  postal_code: 'CEP',
  latitude: 'latitude',
  longitude: 'longitude',
  fixed_delivery_fee_cents: 'taxa de entrega',
  free_delivery_radius_meters: 'raio de entrega grátis',
  max_delivery_radius_meters: 'raio máximo de entrega',
  payment_fee_estimate_bps: 'estimativa de taxa de pagamento',
  accepts_pix: 'aceita Pix',
  accepts_cash: 'aceita dinheiro',
  accepts_card: 'aceita cartão',
  is_open_override: 'abrir/fechar manual',
  paused_until: 'pausa até',
  pause_reason: 'motivo da pausa',
  schedule_slot_times: 'horários de agendamento',
  cnpj: 'CNPJ',
};

function fieldLabel(key: string): string {
  return FIELD_LABELS[key] ?? key;
}

const REVIEW_STATUS_PT: Record<string, string> = {
  pending: 'pendente',
  approved: 'aprovada',
  hidden: 'ocultada',
};

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Campos "meta" do patch que não são alterações de verdade. */
const META_KEYS = new Set(['priceChanged', 'availabilityChanged']);

/** Lista legível dos campos alterados num `*.update`. */
function changedFields(meta: Record<string, unknown>): string | null {
  const keys = Object.keys(meta).filter((key) => {
    if (META_KEYS.has(key)) return false;
    if (key === 'addonIds' && meta[key] == null) return false;
    return meta[key] !== undefined;
  });
  if (keys.length === 0) return null;
  const labels = Array.from(new Set(keys.map(fieldLabel)));
  const shown = labels.slice(0, 5);
  const rest = labels.length - shown.length;
  return `Alterou: ${shown.join(', ')}${rest > 0 ? ` e mais ${rest}` : ''}`;
}

/**
 * Frase de detalhe do evento (o "o quê"), em pt-br — o nome da entidade, os
 * campos mexidos, o motivo de uma pausa etc. `null` = sem detalhe útil.
 */
export function auditDetail(log: AdminAuditLog): string | null {
  const meta = log.metadata ?? {};

  if (log.action === 'store.pause') {
    const until = asString(meta.pausedUntil) ?? asString(meta.paused_until);
    const reason = asString(meta.reason) ?? asString(meta.pause_reason);
    const parts: string[] = [];
    if (until) parts.push(`até ${formatDateTime(until)}`);
    if (reason) parts.push(reason);
    return parts.length ? parts.join(' · ') : null;
  }

  if (log.action === 'review.moderate') {
    const status = asString(meta.status);
    const parts: string[] = [];
    if (status) parts.push(REVIEW_STATUS_PT[status] ?? status);
    if (meta.isFeatured === true) parts.push('marcada como destaque');
    if (meta.isFeatured === false) parts.push('destaque removido');
    return parts.length ? parts.join(' · ') : null;
  }

  if (log.action.endsWith('.reorder')) {
    const count =
      typeof meta.count === 'number'
        ? meta.count
        : Array.isArray(meta.order)
          ? meta.order.length
          : null;
    return count != null ? `${count} ${count === 1 ? 'item' : 'itens'}` : null;
  }

  // Nome da entidade (produto, categoria, adicional, promoção).
  const name = asString(meta.name);
  if (name) {
    const changed =
      log.action.endsWith('.update') &&
      changedFields(meta as Record<string, unknown>);
    return changed
      ? `“${name}” · ${changed.replace('Alterou: ', '')}`
      : `“${name}”`;
  }

  // Cupom: identifica pelo código.
  const code = asString(meta.code);
  if (code) return `Cupom ${code}`;

  // `*.update` sem nome (loja, cupom por id) — lista os campos.
  if (log.action.endsWith('.update')) {
    return changedFields(meta as Record<string, unknown>);
  }

  return null;
}
