import { describe, expect, it } from 'vitest';
import {
  categorySchedulingRuleInputSchema,
  categorySchedulingRuleSchema,
  DEFAULT_CATEGORY_SCHEDULING_RULE,
  MIN_LEAD_MINUTES_RANGE,
  normalizeCategorySchedulingRule,
  SAME_DAY_LEAD_MINUTES_RANGE,
  schedulingRuleSignature,
  SLOT_INTERVAL_MINUTES_RANGE,
} from './category-rules';

const VALID_RULE = {
  allowSameDay: false,
  sameDayLeadMinutes: 90,
  weekdayEarliest: '08:00',
  weekendEarliest: null,
  slotIntervalMinutes: 15,
  minLeadMinutes: 45,
};

describe('categorySchedulingRuleSchema', () => {
  it('aceita uma regra completa e válida', () => {
    expect(categorySchedulingRuleSchema.safeParse(VALID_RULE).success).toBe(
      true,
    );
  });

  it.each([
    ['sameDayLeadMinutes', SAME_DAY_LEAD_MINUTES_RANGE[1] + 1],
    ['slotIntervalMinutes', SLOT_INTERVAL_MINUTES_RANGE[1] + 1],
    ['minLeadMinutes', MIN_LEAD_MINUTES_RANGE[1] + 1],
  ])('rejeita %s acima do limite', (field, value) => {
    const result = categorySchedulingRuleSchema.safeParse({
      ...VALID_RULE,
      [field]: value,
    });
    expect(result.success).toBe(false);
  });

  it.each([
    ['sameDayLeadMinutes', SAME_DAY_LEAD_MINUTES_RANGE[0] - 1],
    ['slotIntervalMinutes', SLOT_INTERVAL_MINUTES_RANGE[0] - 1],
    ['minLeadMinutes', MIN_LEAD_MINUTES_RANGE[0] - 1],
  ])('rejeita %s abaixo do limite', (field, value) => {
    const result = categorySchedulingRuleSchema.safeParse({
      ...VALID_RULE,
      [field]: value,
    });
    expect(result.success).toBe(false);
  });

  it('rejeita horário fora do formato HH:MM', () => {
    const result = categorySchedulingRuleSchema.safeParse({
      ...VALID_RULE,
      weekdayEarliest: '8:00',
    });
    expect(result.success).toBe(false);
  });

  it('aceita horário nulo (sem piso)', () => {
    const result = categorySchedulingRuleSchema.safeParse({
      ...VALID_RULE,
      weekdayEarliest: null,
      weekendEarliest: null,
    });
    expect(result.success).toBe(true);
  });
});

describe('categorySchedulingRuleInputSchema (patch parcial)', () => {
  it('aceita um único campo alterado', () => {
    const result = categorySchedulingRuleInputSchema.safeParse({
      minLeadMinutes: 60,
    });
    expect(result.success).toBe(true);
  });

  it('aceita objeto vazio (nenhuma alteração)', () => {
    expect(categorySchedulingRuleInputSchema.safeParse({}).success).toBe(
      true,
    );
  });

  it('rejeita campo presente porém inválido', () => {
    const result = categorySchedulingRuleInputSchema.safeParse({
      slotIntervalMinutes: 1000,
    });
    expect(result.success).toBe(false);
  });
});

describe('normalizeCategorySchedulingRule', () => {
  it('devolve os defaults quando raw é nulo/undefined', () => {
    expect(normalizeCategorySchedulingRule(null)).toEqual(
      DEFAULT_CATEGORY_SCHEDULING_RULE,
    );
    expect(normalizeCategorySchedulingRule(undefined)).toEqual(
      DEFAULT_CATEGORY_SCHEDULING_RULE,
    );
  });

  it('clampa valores numéricos fora do intervalo em vez de rejeitar', () => {
    const normalized = normalizeCategorySchedulingRule({
      sameDayLeadMinutes: SAME_DAY_LEAD_MINUTES_RANGE[1] + 500,
      slotIntervalMinutes: SLOT_INTERVAL_MINUTES_RANGE[0] - 5,
      minLeadMinutes: -100,
    });
    expect(normalized.sameDayLeadMinutes).toBe(SAME_DAY_LEAD_MINUTES_RANGE[1]);
    expect(normalized.slotIntervalMinutes).toBe(SLOT_INTERVAL_MINUTES_RANGE[0]);
    expect(normalized.minLeadMinutes).toBe(MIN_LEAD_MINUTES_RANGE[0]);
  });

  it('descarta horário malformado, caindo para null', () => {
    const normalized = normalizeCategorySchedulingRule({
      weekdayEarliest: 'não é hora',
    });
    expect(normalized.weekdayEarliest).toBeNull();
  });

  it('mantém um valor já válido sem alterar', () => {
    const normalized = normalizeCategorySchedulingRule(VALID_RULE);
    expect(normalized).toEqual(VALID_RULE);
  });
});

describe('schedulingRuleSignature', () => {
  it('inclui minLeadMinutes na assinatura (campos com o mesmo agrupamento)', () => {
    const a = schedulingRuleSignature(VALID_RULE);
    const b = schedulingRuleSignature({ ...VALID_RULE, minLeadMinutes: 46 });
    expect(a).not.toBe(b);
  });

  it('produz a mesma assinatura para regras idênticas', () => {
    expect(schedulingRuleSignature(VALID_RULE)).toBe(
      schedulingRuleSignature({ ...VALID_RULE }),
    );
  });
});
