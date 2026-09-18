import type { CatalogStoreFontConfig } from '@/modules/catalog/types';
import { DEFAULT_FONT_PRESET, type FontPresetId } from '@/modules/catalog/font-presets';

/**
 * Mesmo padrão de `theme-style.ts` (sobrescreve CSS variables via `<style>`
 * inline, sem rebuild), mas com uma pegadinha própria de fonte: o
 * `@theme inline` do Tailwind (`globals.css`) declara `--font-serif: var(
 * --font-fraunces)` — e o `@theme inline` "resolve" essa referência em
 * build-time, gerando a utilidade `.font-serif` já apontando direto pra
 * `--font-fraunces`, não pra `--font-serif`. Sobrescrever `--font-serif`
 * em runtime não muda nada (a classe nunca lê essa variable de novo);
 * quem precisa mudar é `--font-fraunces`/`--font-geist` mesmo — as
 * variables "de origem" que o `@theme inline` referenciou.
 *
 * As variables dos presets (`--font-playfair`, `--font-inter` etc.) só
 * existem porque `apps/client`/`apps/admin` importam TODAS as fontes no
 * layout (`next/font/google` exige import estático) — aqui só decide qual
 * delas fica ativa pro tenant atual.
 */
const PRESET_FONT_VARS: Record<
  Exclude<FontPresetId, 'zelo'>,
  { serif: string; sans: string }
> = {
  classico: { serif: '--font-playfair', sans: '--font-inter' },
  artesanal: { serif: '--font-caveat', sans: '--font-nunito' },
};

/** `null` quando o preset é o padrão (`'zelo'`) ou desconhecido. */
export function buildFontStyle(
  fontConfig: CatalogStoreFontConfig | undefined,
): string | null {
  const preset = fontConfig?.preset;
  if (!preset || preset === DEFAULT_FONT_PRESET) return null;
  const vars = PRESET_FONT_VARS[preset as Exclude<FontPresetId, 'zelo'>];
  if (!vars) return null;
  return `:root{--font-fraunces:var(${vars.serif});--font-geist:var(${vars.sans})}`;
}
