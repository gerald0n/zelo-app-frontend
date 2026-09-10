# _HANDOFF — Evolução do App (resumo curto)

Ponto de entrada pra abrir uma sessão nova sem re-explorar o código.
Reestruturado em 2026-09-04: o conteúdo detalhado de cada área saiu daqui e
foi pros docs **103, 104, 105, 106** desta pasta (agora arquivos de
verdade, não só texto vivendo neste handoff) — leia o doc específico só
quando for mexer naquela área. Este arquivo fica curto de propósito, pra
não pesar o contexto de toda sessão nova.

---

## Contexto do projeto

- **Repo:** `zelo-app-frontend` (confeitaria Zelo, Pereiro-CE). **Um único
  admin.** O painel `/admin` é usado **majoritariamente em tablet**.
- **Stack:** Next.js (versão modificada — ler `node_modules/next/dist/docs/`
  antes de codar, ver `AGENTS.md`), TypeScript strict, Tailwind v4, shadcn/ui,
  TanStack Query, Supabase (Postgres + RLS + funções RPC), react-hook-form +
  zod, Google Maps, Mercado Pago (Pix), Web Push (VAPID). Drag-and-drop do
  kanban é feito à mão (eventos de ponteiro) — nenhuma lib de DnD no repo.
- **Gerenciador:** pnpm. **Verificação por fase:**
  `pnpm typecheck && pnpm lint && pnpm build`. Commits Conventional em
  pt-BR, uma linha, sempre encerrando com `Co-Authored-By: Claude Sonnet 5
<noreply@anthropic.com>`.
- **Fluxo de deploy:** o assistente commita local em `develop` e faz `push`
  pra `origin/develop`; quem faz o **merge para `main`** e o deploy de fato
  (Vercel, ligado ao git) é o dono. Não presumir que um commit em `develop`
  já está em produção — checar `git log main..develop`.
- **Regra de escopo herdada da 102:** mexer só em apresentação quando
  possível; migrations/módulos só quando o recurso realmente exigir.

---

## Estado atual por doc

| Doc                                                         | Assunto                                                             | Status                                                                                                                                                                                                                                                                                                                |
| ----------------------------------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [103](103%20-%20Painel%20Administrativo.md)                 | Painel admin: kanban, estoque, comanda manual, impressão, melhorias | Kanban (reescrito 2026-09-06), estoque, melhorias no pedido, comanda manual, impressão térmica (WebUSB, **validada em hardware 2026-09-08**), **Catálogo (resto)**, **Loja/relatórios** e **Push do painel** (2026-09-08, push validado em produção com aparelho real) — **implementados**. **Doc 103 100% fechado.** |
| [104](104%20-%20Promoções,%20Cupons%20e%20Financeiro.md)    | Promoções, cupons, financeiro                                       | Promoções, **Cupons (PR #62) e Financeiro (PR #64) em produção** (2026-09-08, migrations aplicadas no remoto). Doc 104 fechado. Único follow-up: a taxa real do MP só valida num Pix de produção.                                                                                                                     |
| [105](105%20-%20Precisão%20do%20Frete.md)                   | Google Maps: geocodificação, mapa, área de entrega                  | (a)-(d) **implementados**, drag do pin **validado à mão 2026-09-08**. (e) suavizar taxa adiado; (f) componente único de endereço desbloqueado, não iniciado.                                                                                                                                                          |
| [106](106%20-%20Avaliações%20e%20Depoimentos.md)            | Avaliações de pedido + depoimentos                                  | **Fase 1** (PR #67, `20260909120000_order_reviews`) e **Fase 2 — nota por produto** (PR #90, `20260909130000_product_reviews`) **implementadas**. Follow-ups: resposta pública do admin ao comentário e foto na avaliação.                                                                                            |
| [107](107%20-%20Responsividade%20Percebida%20do%20Admin.md) | Responsividade percebida do admin                                   | **4 partes feitas** (PRs #69/#70 em produção): `useUiPref`, Relatórios→Visão geral, UI otimista no catálogo, anti-flash de tema. Depois: dashboard agregado no servidor (PR #93), debounce do realtime (PR #81), cache do catálogo (PRs #77/#79), densidade mobile (#89).                                             |

**Reconciliação da doc de referência** — **feita em 2026-09-09** (branch
`docs/reconciliacao-referencia`): `docs/10-funcional/05,07,08,09,11,12`,
`docs/20-tecnico/21,22,23,24,25,26,29`, `PRODUCT.md` e
`00-produto-e-dominio/00` foram atualizados contra o código. O doc
[`20-tecnico/31`](../20-tecnico/31%20-%20Estado%20da%20Implementação%20vs.%20Documentação%20de%20Referência.md)
tem a tabela de status e continua sendo o registro do delta.

**Commits em `develop` que ainda não foram pro `main`** — checar
`git log origin/main..origin/develop`. Em 2026-09-09: agendamento por
categoria (PR #98), fila de impressão da cozinha (`9aba06e`, **sem PR
ainda**), e dois fixes de horário com loja pausada (#95 + `c88adbc`).

**Migrations pendentes de `supabase db push`** — checar `supabase/migrations/`.
Em 2026-09-09, depois de `20260909120000_order_reviews`, entraram:
`20260909130000_product_reviews` (PR #90), `20260909140000_category_scheduling_rules`
(PR #98) e `20260909150000_order_kitchen_printed_at` (`9aba06e`). Confirmar
quais já foram aplicadas no remoto.

---

## Próximos passos sugeridos

1. Merge/deploy de `develop` → `main`: PR #98 (agendamento por categoria) +
   abrir PR da fila de impressão (`9aba06e`) + os 2 fixes de horário. Rodar
   `supabase db push` para as 3 migrations de 2026-09-09.
2. ~~103, 104, 105 (a–d), 106 (Fase 1 e 2), 107~~ — **todos em produção.**
3. ~~**Reconciliar a doc de referência**~~ — **feito em 2026-09-09**
   (branch `docs/reconciliacao-referencia`; ver tabela no `20-tecnico/31`).
4. **105 (e)** suavizar a taxa de entrega em faixas — adiado, sem fórmula.
   **105 (f)** componente único de endereço — desbloqueado, não iniciado.
5. **106 — follow-ups**: resposta pública do admin ao comentário; foto na
   avaliação.
6. A **repaginação visual do admin** (primitivos/tokens do redesign 102)
   ainda não chegou nas telas novas do admin — continua usando
   `<button>`/`<div>` crus, não os primitivos de `src/components/ui`.
7. O redesign **"Vidro Quente"** do cardápio (commit `4a85b11`) foi
   **revertido** — vale o plano 102 (editorial minimalista).

---

## Pegadinhas cross-cutting (vale ler antes de mexer em qualquer área)

- **Terminal do usuário mascara segredos colados** com `•` (U+2022) — nunca
  configurar env var de chave via pipe (`printf ... | vercel env add`);
  usar o dashboard web da Vercel. Conferir com `vercel env pull` + `cat`
  (sem máscara).
- **Drag-and-drop do kanban não usa lib** — `@dnd-kit` foi removido; o
  arraste é feito à mão com `onPointerDown` + limiar de 8px + clone em portal
  no `<body>` (`AdminKanbanBoard.tsx`). Não reintroduzir `@dnd-kit` /
  `react-beautiful-dnd` sem necessidade.
- Setup local, testes via `psql`, e pegadinhas de tooling (gen:types,
  `pnpm format` no repo inteiro, `pnpm build` derrubando dev server de
  outra sessão) estão na memória do assistente (`e2e-local-setup`), não
  aqui — são workflow, não estado do produto.
- Uma sessão registrou uma aba extra do navegador abrindo sozinha
  apontando pra produção com um captcha — não foi o assistente, investigar
  a origem se repetir.
