# 26 - Estrutura de Pastas

> Reconciliado com o código em **2026-09-09**. O repositório é um **monorepo
> pnpm** com dois apps Next.js e um pacote compartilhado. Os módulos de
> domínio são **planos** (arquivos `*.ts` diretos, não a árvore
> `domain/application/infrastructure` que a versão anterior deste doc
> propunha). Os princípios de modularidade, proximidade e nomenclatura no
> fim continuam valendo.

# Estrutura Principal

```text
/
├── apps/
│   ├── client/          # zelo-app  (loja do cliente)  — projeto Vercel
│   └── admin/           # zelo-admin (painel)          — projeto Vercel
├── packages/
│   └── shared/          # @zelo/shared — Supabase, tipos, domínio, UI, config
├── supabase/            # migrations + cron + seed, compartilhado pelos apps
├── docs/
├── package.json         # scripts do monorepo (pnpm -r)
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

Cada app tem seu próprio `package.json`, `next.config.ts`, `vercel.json`,
`tsconfig.json`, `public/`, `eslint.config.mjs` e `verify.mjs`.

---

# `apps/client` e `apps/admin`

```text
apps/<app>/src/
├── app/                 # App Router: rotas, layouts, páginas, route handlers
│   └── api/v1/...        # endpoints
├── components/           # componentes do app (subpastas por área)
├── contexts/             # React contexts (providers) do app
├── hooks/
└── lib/                  # helpers locais do app (ex.: admin/print-queue.ts)
```

- `apps/admin/src/modules/admin/` — módulos server-only exclusivos do painel
  (auth, auditoria, dashboard, reviews, catálogo…).
- Rotas não carregam regra de negócio complexa: chamam módulos de
  `@zelo/shared` ou de `src/modules`.

---

# `packages/shared` (`@zelo/shared`)

```text
packages/shared/src/
├── modules/             # domínio (planos, não em camadas)
│   ├── auth/
│   ├── carts/
│   ├── catalog/
│   ├── customers/
│   ├── delivery/
│   ├── notifications/
│   ├── orders/
│   ├── payments/
│   ├── printing/
│   ├── realtime/
│   ├── reviews/
│   ├── scheduling/
│   └── security/
├── components/ui/        # primitivos compartilhados (padrão shadcn)
├── contexts/
├── hooks/
├── providers/
├── lib/
│   ├── supabase/         # browser.ts, server.ts, admin.ts, public.ts
│   ├── geo/
│   ├── push/
│   ├── errors.ts, http.ts, query-keys.ts, phone.ts, logger.ts, ...
├── config/              # env.ts (validação de ambiente)
├── styles/              # globals.css (tokens OKLCH, fontes)
└── types/               # database.ts (gerado), domínio
```

Cada módulo expõe sua API por `index.ts`; arquivos internos não são
importados de fora do módulo. Código `server-only` é marcado como tal.

---

# `supabase/`

```text
supabase/
├── config.toml
├── migrations/           # SQL ordenado por timestamp; não editar após aplicado
├── cron/                 # jobs do Supabase Cron (reconcile-pix)
├── seed.sql
├── seed-operacional.sql
└── snippets/
```

Migrations: pequenas, ordenadas, reversíveis quando possível, sem edição
posterior após aplicadas em produção.

---

# Nomenclatura

- componentes React: `PascalCase.tsx`;
- hooks: `useX.ts` (camelCase com prefixo `use`);
- outros módulos/funções: `kebab-case.ts`;
- Route Handlers: `route.ts`;
- migrations: `<timestamp>_<slug>.sql`.

---

# Regra de Proximidade

Código fica próximo de onde é usado. Só sobe para `packages/shared` depois de
reutilização real entre os apps ou responsabilidade claramente transversal —
não "porque pode ser reaproveitado". Componente específico de uma tela
permanece na tela.

---

# Dependências entre camadas

Permitido: `app → src/modules → @zelo/shared`. Um módulo de domínio não
depende de Next.js nem de React (os de `modules/` que precisam de React
expõem hooks/components isolados). Um módulo não importa arquivos internos de
outro — só a API pública (`index.ts`).
