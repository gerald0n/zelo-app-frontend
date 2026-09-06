import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import eslintConfigPrettier from 'eslint-config-prettier';

import quality from './eslint-rules/index.cjs';

// eslint-config-next escopa seus plugins com `files`, então um objeto de
// regras solto não enxerga `react-hooks`. Reaproveitamos a MESMA instância
// registrada pelo preset (importar o pacote de novo dispara "Cannot
// redefine plugin").
const reactHooksPlugin = nextVitals.find((c) => c.name === 'next')?.plugins?.[
  'react-hooks'
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  eslintConfigPrettier,
  {
    files: ['src/**/*.{js,jsx,ts,tsx,mjs,cjs}'],
    plugins: { quality },
    rules: {
      // Teto de 350 linhas por arquivo. Copiado de
      // soumatheusgomes/vibe-coding-toolkit (prompt 08), regra byte-a-byte.
      // Linha de base: 17 arquivos acima de 350 linhas (ver relatório do
      // prompt 08). Fica em "warn" até zerar, aí volta para "error".
      'quality/max-lines': ['warn', { max: 350 }],
      'quality/no-direct-console': [
        // 2 violações na linha de base (src/config/env.ts,
        // src/contexts/PrinterContext.tsx). Volta para "error" quando zerar.
        'warn',
        { logger: 'o logger de src/lib/logger.ts' },
      ],
      'quality/no-direct-data-access': [
        // 0 violações — nasce em "error".
        'error',
        {
          modules: [
            '@/lib/supabase/client',
            '@/lib/supabase/server',
            '@/lib/supabase/admin',
          ],
          bindings: [
            'createBrowserSupabaseClient',
            'createServerSupabaseClient',
            'createAdminSupabaseClient',
          ],
          layers: ['/src/components/'],
          extensions: ['.tsx'],
        },
      ],
    },
  },
  {
    // O próprio adaptador de log pode usar console diretamente. Precisa vir
    // DEPOIS do bloco que liga a regra (flat config aplica o último match).
    files: ['src/lib/logger.ts'],
    rules: {
      'quality/no-direct-console': 'off',
    },
  },
  {
    files: ['**/*.{js,jsx,mjs,ts,tsx,mts,cts}'],
    plugins: { 'react-hooks': reactHooksPlugin },
    rules: {
      // Dívida técnica pré-existente (11 ocorrências em checkout/conta/
      // contexts). É um aviso de performance, não de correção — o React
      // documenta como "não recomendado", não "quebrado". Rebaixado para
      // `warn` para o CI poder barrar regressões novas; limpeza na Fase N.
      // Ver docs/100-planejamento e o inventário de lint no PR.
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
  {
    // Regras de lint caseiras: CommonJS de propósito (ESLint carrega sem
    // build). O preset next/typescript proíbe `require()` — desligado aqui.
    files: ['eslint-rules/**/*.cjs'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: { module: 'readonly', require: 'readonly' },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
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
    // Tipos gerados pelo Supabase (`pnpm gen:types`) — não são código
    // autoral, o tamanho não diz nada sobre fatoração.
    'src/types/database.ts',
  ]),
]);

export default eslintConfig;
