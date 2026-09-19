import { describe, expect, it } from 'vitest';
import { normalizeOptionalEnvValue } from './env';

describe('normalizeOptionalEnvValue', () => {
  it('trata strings vazias como ausentes', () => {
    expect(normalizeOptionalEnvValue('')).toBeUndefined();
    expect(normalizeOptionalEnvValue('   ')).toBeUndefined();
    expect(normalizeOptionalEnvValue('https://example.com')).toBe(
      'https://example.com',
    );
  });
});
