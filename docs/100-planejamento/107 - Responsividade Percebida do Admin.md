# 107 — Responsividade Percebida do Admin

Criado em 2026-09-09 — só ler este doc quando for mexer em UI otimista do
admin, no store de preferências de UI (`useUiPref`) ou na consolidação de
Relatórios na Visão geral. Escopo: **só `apps/admin`** (o `apps/client` já usa
padrões de loading e está fora).

Origem: o usuário ia começar a trabalhar nisso; um plano maior foi montado em
outra máquina e revisado aqui. A parte de **kanban multi-avanço foi descartada**
— o quadro continua com avanço de **uma etapa por vez** e a estrutura atual
intacta.

## Estado

Branch `feat/admin-ui-otimista` (de `develop`, 2026-09-09). Ordem: **Parte 1 →
Parte 3 → Parte 2**, com a **Parte 1b** por último.

- **Parte 1 — FEITA** (commit `ae71438`). Verificada no admin com Supabase local.
- **Parte 3 — FEITA** (commit `3d734c7`). Verificada: Operação + Financeiro na
  Visão geral reagindo ao seletor de período; nav sem "Relatórios";
  `/relatorios` → 404; `pnpm --filter @zelo/admin build` limpo.
  Obs.: precisou aplicar 6 migrações pendentes no Supabase local
  (`pnpm exec supabase migration up --local`) — o endpoint financeiro dependia
  da migração `20260908150000_payment_financials`.
- **Parte 1b** e **Parte 2** — pendentes.

---

## Parte 1 — Tema e sidebar recolhível instantâneos (bug real)

### Causa raiz (confirmada linha a linha)

`packages/shared/src/hooks/useUiPref.ts`. O `write()` faz `cache = value`
**antes** de disparar o evento; o listener (`handle`) então compara
`read() !== cache` → sempre `false` → **nunca chama `onChange`**, então nenhum
componente com `useSyncExternalStore` re-renderiza até um refresh. Atinge
`useThemeToggle` (tema, chave `zelo:theme`) e `AdminShell` (recolher sidebar,
chave `zelo:admin-sidebar-collapsed`).

Bug secundário no mesmo arquivo: `cache` é uma variável compartilhada entre
todos os assinantes e cada `handle` a muta. Mesmo cross-tab, o primeiro
`handle` a rodar seta `cache` e os demais veem `next === cache` → só **um**
componente re-renderiza.

### Correção

Reescrever `getStore()` para manter um `Set` explícito de callbacks dos
assinantes e notificá-los direto no `write()`:

- `const listeners = new Set<() => void>()`; `let cache = fallback` (mantém
  hidratação SSR segura).
- `notify()` = `listeners.forEach((fn) => fn())`.
- `subscribe(onChange)`: adiciona ao set; no **primeiro** assinante registra
  `storage` + evento custom apontando para um `sync()`; roda `sync()` uma vez
  (pega valor persistido pós-hidratação); cleanup remove do set e, se vazio,
  remove os listeners de window.
- `sync()`: `const next = read(); if (next !== cache) { cache = next; notify(); }`
- `write(value)`: `if (value === cache) return; cache = value;
  localStorage.setItem(key, value); notify();
  window.dispatchEvent(new Event(event));`
  (o `dispatch` cobre outras abas via `storage`/evento custom; `notify()` cobre
  esta aba).

Nenhuma mudança de assinatura pública — `useUiPref`, `useThemeToggle`,
`AdminShell` continuam iguais e passam a atualizar na hora.

### Verificação

Abrir `/`, clicar em "Alternar tema" na sidebar → muda na hora, sem refresh;
idem recolher/expandir a sidebar; recarregar mantém a escolha.

---

## Parte 1b — Anti-flash de tema (separada, adiável)

**Não é trivial:** o admin usa **CSP com nonce** (`src/proxy.ts`) e
`apps/admin/src/app/layout.tsx` está `dynamic = 'force-dynamic'`. Um `<script>`
inline é **bloqueado pela CSP** sem o nonce do request.

- Ler o nonce no `RootLayout` (via `headers()` do request) e passá-lo num
  `<script nonce={nonce}>` no `<head>`, ou usar `next/script` com `nonce`.
- Script (~6 linhas): lê `localStorage['zelo:theme']`, aplica `.dark` no
  `<html>` antes da pintura.
- `<html>` e `<body>` já têm `suppressHydrationWarning`.

Fazer **por último** e revisar isolado — se der atrito com a CSP, é adiável.

---

## Parte 2 — UI otimista no catálogo

Todas as abas de `/catalogo` compartilham a query `adminKeys.catalog()`
(`apps/admin/src/app/catalogo/page.tsx`) que devolve
`{ categories, products, addons, promotions, coupons }`; hoje toda mutação só
faz `invalidateCatalog()` no fim — daí o atraso.

### 2a. Helper reutilizável

Novo `apps/admin/src/lib/admin/catalog-cache.ts`, genérico sobre
`CatalogResponse` (de `apps/admin/src/app/catalogo/catalog-forms.ts` —
**caminho correto**, não `_tabs/`):

```ts
patchCatalogItem(qc, collection, id, patch)   // merge raso num item
removeCatalogItem(qc, collection, id)          // remove da lista (archive/delete)
// cada uma: cancelQueries → snapshot → setQueryData → return { previous }
rollbackCatalog(qc, ctx)                        // restaura o snapshot
```

`collection ∈ keyof CatalogResponse`.

### 2b. Aplicar (prioridade = onde o usuário sente dor)

- **`apps/admin/src/app/catalogo/_tabs/useProductMutations.ts`** — passar o
  `queryClient` (prop nova ou `useQueryClient()` interno):
  - `patchMutation` é **dual-purpose** (toggle de campo **e** `archive: true`):
    `onMutate` ramifica em `input.body.archive` → `removeCatalogItem` se
    `archive === true`, senão `patchCatalogItem` (cobre o toggle de
    disponibilidade no card/linha); `onError` → `rollbackCatalog` +
    `onError(msg)`; `onSettled` → `invalidateCatalog()`.
  - `bulkMutation` (barra de seleção): `patchCatalogItem` para cada id em
    `onMutate`.
  - `reorderProductsMutation`: `setQueryData` reordenando `products` na hora.
  - `duplicateMutation`: manter invalidate; garantir spinner no botão.
  - **Antes de codar:** confirmar se `/api/v1/admin/catalog` **exclui**
    produtos arquivados da resposta (define `removeCatalogItem` vs
    `patchCatalogItem({ archived: true })`).
- **Demais abas** (`CategoriesTab`, `AddonsTab`, `CouponsTab`,
  `PromotionsTab`) — baseadas em formulário; aplicar só:
  - optimistic `removeCatalogItem` nos `archiveMutation`/`deleteMutation`;
  - auditar todo botão "Salvar" para refletir `mutation.isPending` (Coupons e
    Promotions já fazem; conferir Addons/Categories).

### 2c. Switch de disponibilidade do produto

`ProductGridCard.tsx` / `ProductListRow.tsx`: o `<button role="switch">` já
deriva de `product.isAvailable`; com o cache otimista ele vira na hora. Passar
um `pending`/`disabled` opcional durante o voo (evita clique duplo) —
`ProductsTab` sabe via `patchMutation.isPending` + id alvo.

> Kanban já é otimista via `setOptimisticStatus` em
> `apps/admin/src/app/pedidos/page.tsx` — **nada a fazer** nessa superfície.

### Verificação

Em `/catalogo`, alternar disponibilidade de um produto → o switch vira
instantâneo; arquivar um cupom → some da lista na hora; simular erro (offline)
→ estado volta e aparece mensagem.

---

## Parte 3 — Relatórios → Visão geral

Rota `/relatorios` deixa de existir; o conteúdo (Operação + Financeiro) vai
para a Visão geral. `/relatorios` passa a dar 404.

### 3a. Mover componentes (reaproveitar, não recriar)

`apps/admin/src/app/relatorios/_components/` →
`apps/admin/src/app/_components/`:
- `OperationsView.tsx` (Cancelamentos + Produção)
- `FinancialView.tsx` (Resultado, Formas de pagamento, Estornos, Pix)
- `ReportBar.tsx`

São autocontidos (cada um com seu `useQuery` contra `/api/v1/admin/reports`);
só ajustar os imports internos (`@/app/relatorios/_components/ReportBar` →
`@/app/_components/ReportBar`).

### 3b. Dashboard — `apps/admin/src/app/page.tsx`

- `DashboardPeriod` e `ReportPeriod` são unions idênticas
  (`'today' | '7d' | '30d'`). Passar `period as ReportPeriod` nos dois
  componentes (mais simples que unificar tipos e criar dependência entre
  módulos).
- Abaixo do bloco `SalesChart`/`TopProducts` e antes de "Pedidos ativos",
  duas seções com título:
  - **Operação** → `<OperationsView period={period} />`
  - **Financeiro** → `<FinancialView period={period} />`
- Atualizar o texto do `<header>`.
- Nota: a Visão geral ganha 2 `useQuery` novos (ambos já keyed por realtime) —
  tela fica mais pesada, aceitável.

### 3c. Remover a rota e a navegação

- Apagar `apps/admin/src/app/relatorios/` inteiro.
- `AdminSidebar.tsx` (linhas ~51-54) e `AdminBottomNav.tsx` (linhas ~35-38):
  remover a entrada `/relatorios` do array `NAV`/`TABS`; remover o import
  `BarChart3` (fica órfão nos dois).
- Conferência: `grep -rn "relatorios" apps/admin/src` sem sobras.

### Verificação

`/` mostra as métricas atuais + Operação + Financeiro reagindo ao seletor
Hoje/7d/30d; sidebar e barra inferior sem "Relatórios"; `/relatorios` dá 404;
`pnpm --filter @zelo/admin build` limpo.

---

## Arquivos-chave

| Área | Arquivos |
|---|---|
| Tema/pref | `packages/shared/src/hooks/useUiPref.ts` (+ 1b: `apps/admin/src/app/layout.tsx`) |
| Catálogo otimista | `apps/admin/src/lib/admin/catalog-cache.ts` (novo), `apps/admin/src/app/catalogo/_tabs/useProductMutations.ts`, `ProductsTab.tsx`, `ProductGridCard.tsx`, `ProductListRow.tsx`, `CategoriesTab.tsx`, `AddonsTab.tsx`, `CouponsTab.tsx`, `PromotionsTab.tsx` |
| Relatórios | mover `apps/admin/src/app/relatorios/_components/*` → `apps/admin/src/app/_components/`, `apps/admin/src/app/page.tsx`, `AdminSidebar.tsx`, `AdminBottomNav.tsx`, apagar `apps/admin/src/app/relatorios/` |

## Verificação final

- `pnpm --filter @zelo/admin lint && pnpm --filter @zelo/admin build`
- `pnpm --filter @zelo/admin dev` e testar manualmente: tema, sidebar, catálogo
  otimista, dashboard consolidado.

## Descartado (não fazer)

- **Kanban multi-avanço** (arrastar pulando colunas, cards de "Agendados"
  arrastáveis, encadear RPCs `transition_order_status`, menu "Avançar para…").
  Decisão de 2026-09-09: manter o avanço de **uma etapa por vez** e a estrutura
  atual do quadro.
