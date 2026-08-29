# 26 - Estrutura de Pastas

# Objetivo

Este documento define a organização esperada do repositório.

A estrutura deve favorecer modularidade, rastreabilidade e desenvolvimento assistido por IA.

---

# Estrutura Principal

```text
/
├── app/
├── src/
├── public/
├── supabase/
├── docs/
├── scripts/
├── .env.example
├── package.json
├── tsconfig.json
└── README.md
```

---

# Diretório `app`

Contém apenas roteamento, layouts, páginas e endpoints do App Router.

```text
app/
├── (public)/
│   ├── page.tsx
│   ├── produto/[slug]/page.tsx
│   └── carrinho/page.tsx
├── (customer)/
│   ├── checkout/page.tsx
│   ├── pedidos/page.tsx
│   └── pedidos/[id]/page.tsx
├── admin/
│   ├── login/page.tsx
│   ├── layout.tsx
│   ├── page.tsx
│   ├── pedidos/
│   ├── produtos/
│   ├── categorias/
│   ├── adicionais/
│   └── configuracoes/
├── api/
│   └── v1/
│       ├── auth/
│       ├── cart/
│       ├── checkout/
│       ├── orders/
│       ├── addresses/
│       ├── push/
│       ├── admin/
│       ├── hooks/
│       └── webhooks/
├── manifest.ts
├── layout.tsx
└── globals.css
```

Rotas não devem conter regras de negócio complexas.

---

# Diretório `src`

```text
src/
├── modules/
├── components/
├── lib/
├── hooks/
├── providers/
├── styles/
├── types/
└── config/
```

---

# Módulos de Domínio

```text
src/modules/
├── auth/
├── customers/
├── catalog/
├── carts/
├── checkout/
├── orders/
├── delivery/
├── scheduling/
├── payments/
├── notifications/
├── store/
└── admin/
```

Cada módulo pode conter:

```text
orders/
├── domain/
│   ├── entities/
│   ├── value-objects/
│   ├── policies/
│   └── errors/
├── application/
│   ├── use-cases/
│   ├── dto/
│   └── ports/
├── infrastructure/
│   ├── repositories/
│   ├── mappers/
│   └── services/
├── presentation/
│   ├── components/
│   ├── hooks/
│   └── schemas/
└── index.ts
```

Nem todo módulo precisa de todas as subpastas.

Evitar criar diretórios vazios ou abstrações sem uso.

---

# Componentes Compartilhados

```text
src/components/
├── ui/
├── layout/
├── feedback/
└── shared/
```

## `ui`

Componentes base do shadcn/ui.

## `layout`

Header, navegação, containers e estruturas globais.

## `feedback`

Loading, empty state, error state, alertas e toasts.

## `shared`

Componentes reutilizados em diferentes módulos.

Componentes específicos devem permanecer no módulo de origem.

---

# Biblioteca Compartilhada

```text
src/lib/
├── supabase/
│   ├── browser.ts
│   ├── server.ts
│   ├── admin.ts
│   └── types.ts
├── meta/
├── maps/
├── push/
├── sentry/
├── money/
├── dates/
├── validation/
└── errors/
```

---

# Providers

```text
src/providers/
├── query-provider.tsx
├── auth-provider.tsx
└── realtime-provider.tsx
```

Criar provider somente quando necessário.

---

# Estado Zustand

```text
src/modules/carts/presentation/store/
└── cart-store.ts
```

O estado do Carrinho deve permanecer dentro do módulo.

Não criar uma pasta global de stores para tudo.

---

# Supabase

```text
supabase/
├── config.toml
├── migrations/
├── seed.sql
├── functions/
└── tests/
```

Migrations devem ser:

- pequenas;
- ordenadas;
- reversíveis quando possível;
- revisadas;
- sem edição posterior após aplicadas em produção.

---

---

# Documentação

```text
docs/
├── product/
├── domain/
├── functional/
├── technical/
├── decisions/
└── agents/
```

As decisões arquiteturais relevantes podem ser registradas em ADRs.

---

# Configuração

```text
src/config/
├── env.ts
├── feature-flags.ts
└── constants.ts
```

Variáveis de ambiente devem ser validadas no startup.

---

# Arquivos de Índice

Usar `index.ts` apenas para expor API pública de módulo.

Evitar barrels globais que:

- dificultam rastreamento;
- criam ciclos;
- aumentam bundle;
- escondem dependências.

---

# Dependências entre Módulos

Permitido:

```text
presentation → application → domain
infrastructure → application/domain
app → módulos
```

Proibido:

```text
domain → infrastructure
domain → Next.js
domain → React
módulo A → arquivos internos de módulo B
```

Integração entre módulos deve ocorrer por APIs públicas ou portas bem definidas.

---

# Nomenclatura

- componentes React: `PascalCase.tsx`;
- hooks: `use-*.ts`;
- funções e módulos: `kebab-case.ts`;
- schemas: `*.schema.ts`;
- casos de uso: verbo no infinitivo ou ação explícita;
- testes: `*.test.ts` ou `*.spec.ts`;
- Route Handlers: `route.ts`;
- Server Actions: `actions.ts` apenas quando agrupamento for coeso.

---

# Regra de Proximidade

Código deve permanecer próximo ao contexto em que é usado.

Não mover para compartilhado apenas porque pode ser reutilizado no futuro.

Compartilhar somente após reutilização real ou responsabilidade claramente transversal.
