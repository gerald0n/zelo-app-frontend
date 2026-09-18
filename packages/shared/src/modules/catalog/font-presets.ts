/**
 * White label (ADR-0001, Fase D) — conjunto fixo de combinações de fonte
 * que um tenant pode escolher. `next/font/google` exige import estático
 * resolvido em build-time (não dá pra aceitar uma fonte arbitrária vinda do
 * banco), então "fonte por tenant" é uma seleção entre estas opções, todas
 * pré-importadas nos layouts de `apps/client`/`apps/admin`.
 *
 * Cada preset mapeia pro par de papéis já usado no design system
 * (`--font-serif` = títulos/marca/preços, `--font-sans` = corpo/UI — ver
 * `packages/shared/src/styles/globals.css`). O preset `'zelo'` é o padrão
 * atual (Fraunces + Geist) e não precisa de override nenhum.
 */
export type FontPresetId = 'zelo' | 'classico' | 'artesanal';

export const DEFAULT_FONT_PRESET: FontPresetId = 'zelo';

export const FONT_PRESETS: Array<{
  id: FontPresetId;
  label: string;
  description: string;
}> = [
  {
    id: 'zelo',
    label: 'Zelo (padrão)',
    description: 'Fraunces (serifa) + Geist (sans) — o visual atual.',
  },
  {
    id: 'classico',
    label: 'Clássico editorial',
    description: 'Playfair Display + Inter — elegante, mais formal.',
  },
  {
    id: 'artesanal',
    label: 'Artesanal',
    description: 'Caveat (manuscrita) + Nunito — acolhedor, feito à mão.',
  },
];

export function isFontPresetId(value: string): value is FontPresetId {
  return FONT_PRESETS.some((preset) => preset.id === value);
}
