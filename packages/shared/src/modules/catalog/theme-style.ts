import type { CatalogStoreTheme } from '@/modules/catalog/types';

/**
 * White label (ADR-0001, Fase D) — sobrescreve só as CSS variables de marca
 * (`packages/shared/src/styles/globals.css`) que a loja definiu em
 * `stores.theme`; chave ausente mantém o valor estático do CSS. Usado pelos
 * `layout.tsx` de `apps/client` e `apps/admin` (mesmo formato de tema pros
 * dois apps).
 */
const THEME_CSS_VAR_KEYS: Record<keyof CatalogStoreTheme, string> = {
  primary: '--primary',
  primaryForeground: '--primary-foreground',
  secondary: '--secondary',
  secondaryForeground: '--secondary-foreground',
  accent: '--accent',
  accentForeground: '--accent-foreground',
  caramel: '--caramel',
  caramelForeground: '--caramel-foreground',
};

/** `null` quando não há nenhuma override (evita `<style>` vazio). */
export function buildThemeStyle(
  theme: CatalogStoreTheme | undefined,
): string | null {
  if (!theme) return null;
  const declarations = (
    Object.keys(THEME_CSS_VAR_KEYS) as Array<keyof CatalogStoreTheme>
  )
    .filter((key) => theme[key])
    .map((key) => `${THEME_CSS_VAR_KEYS[key]}:${theme[key]}`);
  if (declarations.length === 0) return null;
  return `:root{${declarations.join(';')}}`;
}
