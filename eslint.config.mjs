import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import eslintConfigPrettier from 'eslint-config-prettier';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  eslintConfigPrettier,
  {
    rules: {
      // Dívida técnica pré-existente (11 ocorrências em checkout/conta/
      // contexts). É um aviso de performance, não de correção — o React
      // documenta como "não recomendado", não "quebrado". Rebaixado para
      // `warn` para o CI poder barrar regressões novas; limpeza na Fase N.
      // Ver docs/100-planejamento e o inventário de lint no PR.
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    'supabase/.temp/**',
    'supabase/.branches/**',
  ]),
]);

export default eslintConfig;
