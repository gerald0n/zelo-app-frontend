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
      // Linha de base zerada (prompt 09, 15 arquivos quebrados). Promovida
      // para "error": nenhum arquivo passa de 350 linhas.
      'quality/max-lines': ['error', { max: 350 }],
      'quality/no-direct-console': [
        // Linha de base zerada (prompt 02): PrinterContext usa o logger,
        // env.ts está no bloco `off` abaixo (bootstrap, ciclo com o logger).
        'error',
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
    // O adaptador de log e o bootstrap de env podem usar console diretamente:
    // logger.ts É o wrapper, e env.ts roda `assertProductionEnv()` no load do
    // módulo, antes do logger estar disponível (logger.ts importa env.ts —
    // usar o logger aqui criaria um ciclo). Precisa vir DEPOIS do bloco que
    // liga a regra (flat config aplica o último match).
    files: ['src/lib/logger.ts', 'src/config/env.ts'],
    rules: {
      'quality/no-direct-console': 'off',
    },
  },
  {
    files: ['**/*.{js,jsx,mjs,ts,tsx,mts,cts}'],
    plugins: { 'react-hooks': reactHooksPlugin },
    rules: {
      // Linha de base zerada (prompt 02): estados sincronizados por effect
      // viraram derivação no render, e as buscas viraram effect events que
      // só retornam dado (setState de dentro de IIFE guardada). Uma única
      // supressão pontual em PwaInstallContext (capacidade do navegador só
      // conhecível pós-mount). Promovida para "error".
      'react-hooks/set-state-in-effect': 'error',
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
