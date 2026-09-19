import { describe, expect, it } from 'vitest';
import {
  calcDeliveryFeeCents,
  NEARBY_DELIVERY_FEE_CENTS,
} from '@/modules/delivery/fee';

describe('calcDeliveryFeeCents', () => {
  it('cobra R$ 3,00 dentro do raio de 1 km, incluindo o limite', () => {
    expect(calcDeliveryFeeCents(0, 1_000, 500)).toBe(NEARBY_DELIVERY_FEE_CENTS);
    expect(calcDeliveryFeeCents(1_000, 1_000, 500)).toBe(
      NEARBY_DELIVERY_FEE_CENTS,
    );
  });

  it('cobra R$ 5,00 acima de 1 km', () => {
    expect(calcDeliveryFeeCents(1_001, 1_000, 500)).toBe(500);
  });

  it('usa a taxa fixa para distâncias inválidas', () => {
    expect(calcDeliveryFeeCents(-1, 1_000, 500)).toBe(500);
  });
});
