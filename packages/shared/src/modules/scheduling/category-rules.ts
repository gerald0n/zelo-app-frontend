/**
 * Regras de agendamento por categoria.
 *
 * Cada categoria carrega como a agenda do checkout se comporta para os seus
 * produtos. O admin edita esses campos na categoria (aba Catálogo → Categorias);
 * o cliente e a validação do pedido derivam datas/horários a partir daqui — não
 * existe mais lista fixa de horários na loja.
 *
 * Default = comportamento "cookie": pode ser no mesmo dia, a agenda de hoje
 * abre 2h antes do expediente, sem piso de horário, de 30 em 30 minutos.
 */

const HHMM = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

export function isHhmm(value: unknown): value is string {
  return typeof value === 'string' && HHMM.test(value);
}

export type CategorySchedulingRule = {
  /** `false` = nunca no mesmo dia (só a partir de amanhã). Ex.: pudins. */
  allowSameDay: boolean;
  /**
   * Antecedência (min) em que a agenda de hoje "abre": só aparecem horários de
   * hoje quando faltam no máximo N minutos para o expediente começar. Depois de
   * aberto o expediente, vale o "próximo bloco" e este campo é ignorado.
   */
  sameDayLeadMinutes: number;
  /** Piso de horário nos dias de semana (seg–sex), HH:MM ou `null`. */
  weekdayEarliest: string | null;
  /** Piso de horário no fim de semana (sáb–dom), HH:MM ou `null`. */
  weekendEarliest: string | null;
  /** Intervalo entre horários oferecidos, em minutos. */
  slotIntervalMinutes: number;
};

export const DEFAULT_CATEGORY_SCHEDULING_RULE: CategorySchedulingRule = {
  allowSameDay: true,
  sameDayLeadMinutes: 120,
  weekdayEarliest: null,
  weekendEarliest: null,
  slotIntervalMinutes: 30,
};

type RawRule = {
  allowSameDay?: unknown;
  sameDayLeadMinutes?: unknown;
  weekdayEarliest?: unknown;
  weekendEarliest?: unknown;
  slotIntervalMinutes?: unknown;
};

function clampInt(value: unknown, min: number, max: number, fallback: number) {
  const n = typeof value === 'number' ? Math.round(value) : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function normalizeCategorySchedulingRule(
  raw: RawRule | null | undefined,
): CategorySchedulingRule {
  const d = DEFAULT_CATEGORY_SCHEDULING_RULE;
  if (!raw) return { ...d };
  return {
    allowSameDay:
      typeof raw.allowSameDay === 'boolean' ? raw.allowSameDay : d.allowSameDay,
    sameDayLeadMinutes: clampInt(
      raw.sameDayLeadMinutes,
      0,
      24 * 60,
      d.sameDayLeadMinutes,
    ),
    weekdayEarliest: isHhmm(raw.weekdayEarliest) ? raw.weekdayEarliest : null,
    weekendEarliest: isHhmm(raw.weekendEarliest) ? raw.weekendEarliest : null,
    slotIntervalMinutes: clampInt(
      raw.slotIntervalMinutes,
      5,
      240,
      d.slotIntervalMinutes,
    ),
  };
}

/** Assinatura estável de uma regra — categorias com a mesma assinatura formam
 *  o mesmo "grupo de agendamento" (e podem dividir um pedido). */
export function schedulingRuleSignature(rule: CategorySchedulingRule): string {
  return [
    rule.allowSameDay ? '1' : '0',
    rule.sameDayLeadMinutes,
    rule.weekdayEarliest ?? '-',
    rule.weekendEarliest ?? '-',
    rule.slotIntervalMinutes,
  ].join('|');
}
