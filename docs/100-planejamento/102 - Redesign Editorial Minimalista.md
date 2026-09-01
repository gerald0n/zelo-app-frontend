# 102 - Redesign Editorial Minimalista

Direção escolhida: **editorial minimalista** (monocromático quente, contraste tipográfico, superfícies planas, pastéis dessaturados, movimento discreto).
Escopo: **app inteiro** — loja do cliente + painel administrativo.
Branch: `feat/redesign-editorial-minimalista`.

Regras: mexer só em apresentação (`app/`, `components/`, `globals.css`). **Não tocar em `modules/`, rotas de API, migrations.** Buildar entre fases.

## Status: fases 1–7 concluídas (2026-08-29)

Todas as 7 fases implementadas na branch `feat/redesign-editorial-minimalista` (10 commits). `pnpm build` verde, `pnpm typecheck` limpo, `pnpm lint` sem regressão (mesmos 11 erros pré-existentes). Exceção de escopo: `STATUS_COLORS` em `modules/orders/types.ts` foi remapeado para os tokens `tone-*` (é só um mapa de classes de apresentação) e o bug de prerender do `CartSync` foi corrigido para destravar o build.

### Polimento adicional (feito após as 7 fases)

- `tracking-[]` / `leading-[]` avulsos → utilitários da escala (17 arquivos).
- Skeleton loaders reais em `/pedidos` e `/acompanhamento/[id]` (substituem spinner `Loader2`).
- Stagger sutil de entrada no grid do catálogo (`.reveal-rise`, `motion-safe`, cortado em 8 itens).

### Deixado de fora — por decisão, não por falta de tempo

- **Migração Lucide → Phosphor/Radix**: 64 ícones distintos em 42 arquivos, sem mapeamento 1:1 (nomes e prop de peso diferem), adiciona dependência. Alto risco de deriva semântica para ganho visual marginal — Lucide é um set consistente e adequado. **Não recomendado.**
- **Redesign profundo de `admin/catalogo` (997 ln) e `admin/configuracoes` (659 ln)**: ferramentas internas usadas por uma pessoa; já receberam tokens + press-feedback + paleta. Reestruturar 1.6k linhas de formulários CRUD é esforço/risco alto para benefício restrito. **Melhor parar no passe leve.**

---

## 1. Diagnóstico do estado atual

O front **não é "AI slop"** — já tem pareamento Fraunces (serif) + Nunito (sans), paleta OKLCH quente, HTML semântico, navbar "liquid glass" iOS e header com scroll animado via WAAPI + `prefers-reduced-motion`. O trabalho é **consolidar e afiar**, não reconstruir.

### Achados quantificados

| Problema | Evidência | Impacto |
| --- | --- | --- |
| **Escala tipográfica ad-hoc** | ~150 usos de `text-[NNpx]` avulsos (13, 11, 15, 10, 17, 12, 9, 22, 23px) em vez de escala Tailwind | Alto — inconsistência nº 1 |
| **Raio de borda ad-hoc** | 40 `rounded-[Npx]` avulsos (7, 9, 10, 11, 12, 18px) + escala de token `--radius` ignorada | Alto |
| **Excesso de acentos de cor** | `primary` + `caramel` + `pistachio` + `success` + `whatsapp` + `destructive` + 5 `chart-*`; `categoryTone` colore thumbnails por categoria | Médio — minimalismo pede cor escassa |
| **Sombras dispersas** | 16 usos: `shadow-sm`×9, `shadow-md`×4, `shadow-xl`×2, `shadow-lg`×1 | Médio — direção pede sombra quase inexistente (<0.05) |
| **Sem feedback de toque** | 1 único `active:scale` em todo o app; `Button` só tem `transition-colors` | Médio — interface não "responde" |
| **Glassmorphism pesado** | `.liquid-glass` (blur 120px, saturate 240%, 4 sombras), `LiquidGlassTabs` com bolha spring; 6 arquivos com `backdrop-blur`/`liquid-glass` | Decisão de direção (ver §2) |
| **Estados ausentes** | Sem `not-found.tsx`, `loading.tsx`, `error.tsx`, `global-error.tsx` no App Router | Médio |
| **Ícones** | 42 arquivos importam `lucide-react`; direção pede Phosphor/Radix Icons | Baixo — fase final, opcional |
| **Nunito** | Sans arredondado e macio; editorial pede sans geométrico com mais caráter | Decisão de direção (ver §2) |

### O que já está bom (preservar)

- Fraunces como display serif — combina com confeitaria e com editorial.
- Paleta base warm monochrome em OKLCH.
- HTML semântico (`article`, `section`, `nav`, `aside`, `aria-labelledby`).
- Header com scroll-reveal e tratamento de `prefers-reduced-motion`.
- `cn()` + padrão shadcn/CVA no `Button`.

---

## 2. Decisões a confirmar antes da execução

1. **Fonte sans.** Trocar Nunito → **Geist Sans** (ou Switzer) para ganhar frieza editorial, mantendo Fraunces no display. Alternativa: manter Nunito pela pegada "quente/artesanal". → *Recomendação: trocar para Geist.*
2. **Navbar liquid-glass.** Manter a assinatura de vidro (só suavizar blur/sombra) **ou** substituir por tab bar plana com `border-top` e indicador simples. → *Recomendação: suavizar, não remover — é identidade e o custo de refazer o movimento é alto.*
3. **`categoryTone` (cor por categoria nos thumbs).** Manter como único ponto de cor lúdica **ou** neutralizar para o mesmo pastel. → *Recomendação: manter, é o "spot pastel" da direção.*

---

## 3. Plano por fases

Ordem = maior impacto visual / menor risco primeiro.

### Fase 1 — Fundação de tokens (`globals.css`, 1 arquivo)
- Escala tipográfica em `@theme`: `--text-xs…--text-4xl` com `line-height` e `letter-spacing` (tracking negativo no display, positivo em labels).
- Escala de raio única (`--radius` 8px; sm 4 / md 6 / lg 8 / xl 12); remover o dente de 14px.
- Reduzir sombras a duas: `--shadow-hairline` (0 1px 2px / .04) e `--shadow-raised` (0 2px 8px / .04). Aposentar `shadow-md/lg/xl`.
- Consolidar acentos: `primary` + um trio de pastéis dessaturados (`--accent-red/blue/green` estilo Notion) + `success`/`whatsapp` só onde há semântica real. Rebaixar saturação do `primary`.
- Trocar fonte sans (decisão §2.1) em `layout.tsx` + `@theme`.
- `@media (prefers-reduced-motion)` já existe — manter.

### Fase 2 — Primitivos (`components/ui/*`, 6 arquivos)
- `Button`: adicionar `active:scale-[0.98]`, `transition` completo (não só cores), foco visível consistente, variante `tertiary` (link discreto). Radius `--radius-sm`.
- `Input`/`Textarea`/`Label`: borda `1px` hairline, foco com `ring` de 2px na cor `primary`, altura e padding padronizados.
- `Badge`: pílula `text-xs` uppercase tracking-wide sobre pastel — padronizar todos os status (pedido, loja, disponibilidade).
- Criar `Card` primitivo (hoje é `div` repetida): sem borda OU só background OU só espaçamento — elevação só quando comunica hierarquia.
- Criar `Skeleton` para estados de carregamento.

### Fase 3 — Vitrine do cliente
`app/page.tsx`, `HomeCatalog`, `ProductCard`, `MenuHeroCarousel`, `StoreHeader`, `busca/`, `produto/[id]/`, `product-thumb`.
- Substituir `text-[NNpx]` pela escala nova.
- `ProductCard`: reduzir moldura (remover borda OU sombra, não ambos), press feedback, tipografia editorial no nome/preço, `text-wrap: pretty` nas descrições.
- Chips de filtro: manter pílula (ok para tags), padronizar altura/tracking, estado ativo com `primary` sólido.
- Entrada de listas com stagger sutil (`translateY(12px)` + fade, 600ms, `cubic-bezier(0.16,1,0.3,1)`, `IntersectionObserver`, respeitando reduced-motion).

### Fase 4 — Carrinho + checkout
`carrinho/`, `checkout/*` (identificacao, otp, nome, recebimento, revisao, pagamento), `CheckoutProgress`, `CartQtyStepper`, `DeliveryMapConfirm`.
- `CheckoutProgress`: stepper editorial (numeração tabular, linha fina, sem bolhas pesadas).
- Padronizar densidade e espaçamento vertical dos formulários; mensagens de erro inline (nunca `alert`).
- `CartQtyStepper`: press feedback, tabular-nums na quantidade.
- Revisão do pedido: hierarquia tipográfica forte, totais com `font-variant-numeric: tabular-nums`.

### Fase 5 — Conta + acompanhamento
`conta/*` (dados, enderecos, notificacoes), `acompanhamento/[id]`, `pedidos/`, `OrderCard`, `pedido-recebido/`, `cancelar-pedido/`.
- `OrderCard` e `AccountPageHeader`: mesma linguagem da vitrine.
- Timeline de acompanhamento: linha fina + marcadores discretos, tabular-nums nos horários.

### Fase 6 — Painel administrativo
`app/admin/*` (login, page, pedidos, pedido/[id], catalogo 997 ln, configuracoes 659 ln), `admin/AdminHeader`, `AdminOrderCard`, `AdminBottomNav`.
- Aplicar tokens; admin é data-dense → densidade maior é correta, mas alinhar rhythm e tipografia.
- `AdminOrderCard`: remover `rounded-[11px]` avulso, tabular-nums em número/preço/idade, badge de status padronizado.
- Tabelas/listas de catálogo: linhas com `border-bottom` hairline, sem cards aninhados.

### Fase 7 — Estados globais + acabamento
- Criar `app/not-found.tsx` (404 branded), `app/loading.tsx`, `app/error.tsx`, `app/global-error.tsx`, `app/offline` (já existe — revisar).
- Skeletons por rota onde há fetch.
- Revisão de movimento com `review-animations` (header, navbar, toasts, stagger).
- Opcional: migrar ícones Lucide → Phosphor/Radix (42 arquivos, mecânico).
- Passe final de tipografia (tracking, `text-wrap: balance` em títulos, órfãs).

---

## 4. Verificação por fase

Ao fim de cada fase: `pnpm typecheck && pnpm lint && pnpm build`, e conferir a(s) tela(s) afetada(s) via `pnpm dev`. Commit único por fase, Conventional Commits em pt-BR (uma linha).

---

## 5. Skills de apoio

- `minimalist-ui` — spec da direção estética.
- `redesign-existing-projects` — checklist de auditoria e upgrades.
- `emil-design-eng` / `apple-design` — polimento de componentes e decisões de detalhe.
- `animate` / `review-animations` — movimento (Fases 3 e 7).
