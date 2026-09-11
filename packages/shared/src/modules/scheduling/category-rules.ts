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

import { z } from 'zod';

const HHMM = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

export function isHhmm(value: unknown): value is string {
  return typeof value === 'string' && HHMM.test(value);
}

/**
 * Limites de uma CategorySchedulingRule válida — única fonte de verdade,
 * usada tanto pelo schema de escrita (rejeita fora do intervalo) quanto pelo
 * normalizador de leitura (clampa pro intervalo).
 */
export const SAME_DAY_LEAD_MINUTES_RANGE = [0, 24 * 60] as const;
export const SLOT_INTERVAL_MINUTES_RANGE = [5, 240] as const;
export const MIN_LEAD_MINUTES_RANGE = [0, 24 * 60] as const;

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
  /**
   * Antecedência mínima (min) para **qualquer** horário de hoje: um horário só
   * é oferecido se faltar pelo menos N minutos para ele, contados de agora.
   * Ao contrário de `sameDayLeadMinutes` (que só decide se a agenda de hoje
   * "abre" antes do expediente), este piso vale o dia inteiro — inclusive já
   * dentro do expediente, empurrando o próximo bloco disponível para frente
   * quando ele estiver muito perto.
   */
  minLeadMinutes: number;
};

export const DEFAULT_CATEGORY_SCHEDULING_RULE: CategorySchedulingRule = {
  allowSameDay: true,
  sameDayLeadMinutes: 120,
  weekdayEarliest: null,
  weekendEarliest: null,
  slotIntervalMinutes: 30,
  minLeadMinutes: 30,
};

type RawRule = {
  allowSameDay?: unknown;
  sameDayLeadMinutes?: unknown;
  weekdayEarliest?: unknown;
  weekendEarliest?: unknown;
  slotIntervalMinutes?: unknown;
  minLeadMinutes?: unknown;
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
      ...SAME_DAY_LEAD_MINUTES_RANGE,
      d.sameDayLeadMinutes,
    ),
    weekdayEarliest: isHhmm(raw.weekdayEarliest) ? raw.weekdayEarliest : null,
    weekendEarliest: isHhmm(raw.weekendEarliest) ? raw.weekendEarliest : null,
    slotIntervalMinutes: clampInt(
      raw.slotIntervalMinutes,
      ...SLOT_INTERVAL_MINUTES_RANGE,
      d.slotIntervalMinutes,
    ),
    minLeadMinutes: clampInt(
      raw.minLeadMinutes,
      ...MIN_LEAD_MINUTES_RANGE,
      d.minLeadMinutes,
    ),
  };
}

const hhmmSchema = z.string().refine(isHhmm, { message: 'Use HH:MM.' });

/** Uma CategorySchedulingRule completa e válida — usado ao criar do zero. */
export const categorySchedulingRuleSchema = z.object({
  allowSameDay: z.boolean(),
  sameDayLeadMinutes: z
    .number()
    .int()
    .min(SAME_DAY_LEAD_MINUTES_RANGE[0])
    .max(SAME_DAY_LEAD_MINUTES_RANGE[1]),
  weekdayEarliest: hhmmSchema.nullable(),
  weekendEarliest: hhmmSchema.nullable(),
  slotIntervalMinutes: z
    .number()
    .int()
    .min(SLOT_INTERVAL_MINUTES_RANGE[0])
    .max(SLOT_INTERVAL_MINUTES_RANGE[1]),
  minLeadMinutes: z
    .number()
    .int()
    .min(MIN_LEAD_MINUTES_RANGE[0])
    .max(MIN_LEAD_MINUTES_RANGE[1]),
});

/**
 * Payload de escrita de uma CategorySchedulingRule (PATCH: só o que mudou).
 * Única fonte de verdade da validação — rotas e módulos de admin delegam
 * aqui em vez de reimplementar os limites.
 */
export const categorySchedulingRuleInputSchema =
  categorySchedulingRuleSchema.partial();

export type CategorySchedulingInput = z.infer<
  typeof categorySchedulingRuleInputSchema
>;

/** Assinatura estável de uma regra — categorias com a mesma assinatura formam
 *  o mesmo "grupo de agendamento" (e podem dividir um pedido). */
export function schedulingRuleSignature(rule: CategorySchedulingRule): string {
  return [
    rule.allowSameDay ? '1' : '0',
    rule.sameDayLeadMinutes,
    rule.weekdayEarliest ?? '-',
    rule.weekendEarliest ?? '-',
    rule.slotIntervalMinutes,
    rule.minLeadMinutes,
  ].join('|');
}
