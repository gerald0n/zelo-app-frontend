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
| [103](103%20-%20Painel%20Administrativo.md) | Painel admin: kanban, estoque, comanda manual, impressão, melhorias | Kanban (reescrito 2026-09-06), estoque, melhorias no pedido, comanda manual, impressão térmica (WebUSB, **validada em hardware 2026-09-08**), **Catálogo (resto)** e **Loja/relatórios** (2026-09-08: pausa com prazo/motivo, aba `/relatorios`, auditoria com filtros) — **implementados**. Só **push** não iniciado. |
| [104](104%20-%20Promoções,%20Cupons%20e%20Financeiro.md) | Promoções, cupons, financeiro | Promoções **implementadas**. Cupons e Financeiro não iniciados (decisões travadas). |
| [105](105%20-%20Precisão%20do%20Frete.md) | Google Maps: geocodificação, mapa, área de entrega | (a)-(d) **implementados**, drag do pin **validado à mão 2026-09-08**. (e) suavizar taxa adiado; (f) componente único de endereço desbloqueado, não iniciado. |
| [106](106%20-%20Avaliações%20e%20Depoimentos.md) | Avaliações de pedido + depoimentos | Não iniciado. 3 decisões em aberto. |

**Commits em `develop` que ainda não foram pro `main`** (já enviados a
`origin/develop`, faltando só o merge/deploy do dono) — checar
`git log main..develop` pra confirmar se ainda vale.

**Migrations pendentes de `supabase db push` no próximo deploy** — checar
`supabase/migrations/` por arquivos mais recentes que o último deploy
confirmado. Nova em 2026-09-08: `20260908120000_store_pause.sql`
(`stores.paused_until` / `pause_reason`).

---

## Próximos passos sugeridos

1. Merge/deploy de `develop` pra `main` (commits + migrations pendentes,
   ver acima).
2. ~~Validar em aparelho real: drag do pin do mapa, drag do kanban,
   impressão térmica~~ — **feito em 2026-09-08**, tudo OK.
3. ~~**103 — Catálogo (resto)**~~ e ~~**loja/relatórios**~~ — **feitos em
   2026-09-08**.
4. **103 — push** ou **104 — Cupons + Financeiro**: desbloqueados, sem
   ordem travada entre si.
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
