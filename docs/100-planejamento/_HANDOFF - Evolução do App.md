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

| Doc | Assunto | Status |
| --- | --- | --- |
| [103](103%20-%20Painel%20Administrativo.md) | Painel admin: kanban, estoque, comanda manual, impressão, melhorias | Kanban (reescrito 2026-09-06), estoque, melhorias no pedido, comanda manual, impressão térmica (WebUSB, **validada em hardware 2026-09-08**), **Catálogo (resto)**, **Loja/relatórios** e **Push do painel** (2026-09-08, push validado em produção com aparelho real) — **implementados**. **Doc 103 100% fechado.** |
| [104](104%20-%20Promoções,%20Cupons%20e%20Financeiro.md) | Promoções, cupons, financeiro | Promoções, **Cupons (PR #62) e Financeiro (PR #64) em produção** (2026-09-08, migrations aplicadas no remoto). Doc 104 fechado. Único follow-up: a taxa real do MP só valida num Pix de produção. |
| [105](105%20-%20Precisão%20do%20Frete.md) | Google Maps: geocodificação, mapa, área de entrega | (a)-(d) **implementados**, drag do pin **validado à mão 2026-09-08**. (e) suavizar taxa adiado; (f) componente único de endereço desbloqueado, não iniciado. |
| [106](106%20-%20Avaliações%20e%20Depoimentos.md) | Avaliações de pedido + depoimentos | Não iniciado. 3 decisões em aberto. |

**Commits em `develop` que ainda não foram pro `main`** — checar
`git log main..develop`. Em 2026-09-08 tudo de 103/104 já foi pro `main`
(último merge: PR #65).

**Migrations pendentes de `supabase db push`** — checar `supabase/migrations/`
por arquivos mais recentes que o último deploy confirmado. Em 2026-09-08
todas foram aplicadas no remoto: `20260908120000_store_pause.sql`,
`20260908130000_admin_push_subscriptions.sql`,
`20260908140000_coupons.sql`, `20260908150000_payment_financials.sql`.

---

## Próximos passos sugeridos

1. Merge/deploy de `develop` pra `main` (commits + migrations pendentes,
   ver acima).
2. ~~Validar em aparelho real: drag do pin do mapa, drag do kanban,
   impressão térmica~~ — **feito em 2026-09-08**, tudo OK.
3. ~~**103** — Catálogo (resto), loja/relatórios e push~~ — **feitos em
   2026-09-08. Doc 103 100% fechado** (push validado em produção com
   aparelho real; VAPID próprio do admin já setado no Vercel).
4. ~~**104**~~ — Promoções, Cupons e Financeiro **feitos**. **106 —
   Avaliações Fase 1** é o próximo bloco desbloqueado (3 decisões em aberto).
5. **106 — Avaliações**: Fase 1 pode entrar a qualquer momento; Fase 2
   depende do login por SMS (Fase 14 do roadmap).
6. A **repaginação visual do admin** (primitivos/tokens do redesign 102)
   ainda não chegou em nenhuma tela nova do admin — continua usando
   `<button>`/`<div>` crus, não os primitivos de `src/components/ui`.

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
