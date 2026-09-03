# Auditoria e correção do layout desktop — Zelo

Data: 2026-09-03 · Branch: `develop` · Viewport de referência: 1280×720

Auditoria visual de todas as telas do cliente + revisão de código do painel
`/admin`. Abaixo: o que estava errado e o que foi feito.

---

## Causas-raiz (corrigidas)

### S1 — Não existia um sistema de larguras de container
Cada rota inventava a própria `max-w-[NNNN]`: busca 896, carrinho 1024, conta
1120, pedidos 1180, checkout 640, admin 760/920/1050/1100.

**Correção:** três tokens em `src/lib/layout.ts`, uma decisão por tela:

| Token | Largura | Uso |
|---|---|---|
| `shellNarrowClass` | 40rem / 640px | fluxos de etapa, formulários, leitura, ajustes de conta, loja, cancelamento |
| `shellContentClass` | 56rem / 896px | visões gerais e listas (pedidos, busca) |
| `shellWideClass` | 64rem / 1024px | layouts de duas colunas (carrinho) |
| `adminContainerClass` / `adminFormContainerClass` | 72rem / 44rem | painel admin (dados vs. formulário) |

`checkoutDesktopContainerClass` virou alias de `shellNarrowClass` (mesmo valor).

### S2 — Breakpoint decidido em JS e em CSS, com valores diferentes
`useResponsiveLayout` calculava `isDesktop` (1024), `isTablet` (768) e um
`showPersistentCart` que ainda exigia `landscape && ≥900`. O hook começa em
"mobile" no SSR → **flash de layout** (sidebar, painel de carrinho, centragem de
/pedidos e /conta "pulavam" pra dentro depois de montar).

**Correção:**
- `useResponsiveLayout` reduzido a `{ width, isTablet, isDesktop }`, alinhado com
  os breakpoints do Tailwind. Removidos `isWideDesktop`, `isLandscape`,
  `showSideCategories`, `showPersistentCart`.
- Toda a **estrutura** virou CSS (`lg:` / `md:`): `HomeCatalog`, `BuscaClient`,
  `/pedidos`, `/conta` e as 5 páginas do admin não usam mais o hook para layout.
  Sem flash.

### S3 — `ProductCard` renderizava dois designs conforme a rota
Grade da home usava o modo horizontal em células de ~210px (texto quebrava em 3
linhas); `/busca` usava `vertical`.

**Correção:** prop única `responsive` — linha horizontal compacta no mobile que
vira cartão vertical (foto no topo) a partir de `lg`, tudo por CSS. Home e busca
usam a mesma grade (`lg:grid-cols-2 2xl:grid-cols-3`).

### S4 — Chrome global inconsistente entre mobile e desktop
- Marca "Zelo Confeitaria" duplicada na home (barra do topo + `StoreHeader`).
- 3 entradas de carrinho simultâneas no desktop.
- Checkout escondia a navegação no mobile mas mantinha a barra completa no desktop.

**Correção:**
- `shouldHideCustomerMobileNav` → `shouldHideCustomerNav`, agora aplicada também
  à `DesktopNavigation`. Checkout, produto, carrinho e acompanhamento ficam sem
  barra de navegação no desktop, como já era no mobile.
- Novo `StoreStrip` (`src/components/StoreStrip.tsx`): faixa enxuta do desktop
  (status, horário, área de entrega) sem repetir marca nem botões. O
  `StoreHeader` retrátil virou `lg:hidden` (inclusive a barra compacta em portal).

---

## Achados corrigidos por tela

| Tela | Antes | Depois |
|---|---|---|
| **Home** | marca duplicada, grade ilegível, trilhos entrando sob a navbar | `StoreStrip`, grade de cartões verticais 2 col, trilhos em `top-14` / `h-[calc(100dvh-3.5rem)]` |
| **Produto** | CTA "Adicionar" descolado no rodapé (herança do `flex-1` mobile) | CTA logo abaixo do conteúdo (`lg:flex-none` + `lg:self-start`); sem navbar |
| **Carrinho** | `lg:max-w-5xl` avulso | `shellWideClass`; sem navbar (fluxo com foco) |
| **/pedidos** | header full-bleed enquanto o corpo era `max-w-[1180px]`; segmented control esticado por 1280px | header e corpo no mesmo `shellContentClass`; segmented control `lg:max-w-xs`; `isDesktop` → CSS |
| **/conta** | `max-w-[1120px]` (largo demais p/ lista de uma coluna) | `shellNarrowClass` (640), igual às subpáginas de conta |
| **/busca** | `lg:max-w-4xl` avulso + `isTablet` p/ grade | `shellContentClass` + grade por CSS |
| **/checkout** | mantinha navbar completa no desktop | sem navbar; `shellNarrowClass` |
| **/loja, /cancelar-pedido** | largura avulsa / sem container no desktop | `shellNarrowClass` |
| **Admin** | 5 `max-w` diferentes, `isTablet` (768) centraliza mas sidebar só em `lg`, header não-fixo no desktop com `pt-14` na sidebar | `adminContainerClass` / `adminFormContainerClass`, centragem por CSS (`md:`), `AdminHeader` sticky no desktop |

---

## Pendências

- **Verificação visual do painel `/admin` no desktop** — as mudanças estão feitas
  e passam no typecheck/lint, mas não foram conferidas no navegador (exige login
  administrativo). Conferir: `/admin`, `/admin/pedidos`, `/admin/pedido/[id]`,
  `/admin/catalogo`, `/admin/configuracoes`.
- **Fotografia real de produto** — segue placeholder (fora do escopo desta pauta).
- `--radius` no CSS (`0.5rem`) diverge do que o PRODUCT.md cita (`0.625rem`) —
  drift cosmético, não mexido.

## Arquivos alterados

`src/lib/layout.ts`, `src/hooks/useResponsiveLayout.ts`,
`src/components/{HomeCatalog,ProductCard,BuscaClient,DesktopNavigation,DesktopCartPanel,StoreHeader,ProdutoClient,Providers,MobileBottomNav}.tsx`,
`src/components/StoreStrip.tsx` (novo), `src/components/admin/AdminHeader.tsx`,
`src/app/{conta,pedidos,carrinho,loja,cancelar-pedido}/page.tsx`,
`src/app/admin/**/page.tsx` (5).
