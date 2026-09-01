# Design — Zelo Confeitaria

<!-- impeccable:design-schema 1 -->

Sistema visual **"Vidro Quente"**: a estrutura e a contenção do design system
da Apple (Liquid Glass) sobre a paleta e o wordmark reais da Zelo. Nasceu na
tela de **Cardápio** (`src/components/HomeCatalog.tsx`) e é a base para as
demais telas.

> Substitui o sistema incumbente (vinho/framboesa + caramelo/pistache, Fraunces
> como display, `--radius` 0.5rem). A identidade oficial da Zelo (post de
> cardápio, logo, embalagem) é a fonte da paleta; o layout segue as regras de
> materiais e movimento da Apple.

## Princípios

1. **Deferência.** O conteúdo manda, o cromo recua. Cabeçalho e categorias são
   uma camada de vidro translúcida com o cardápio rolando por baixo; a borda é
   névoa/sombra, não filete.
2. **Um acento só.** Terracota-rosê (`--primary`) carrega toda a ação —
   Adicionar, aba ativa, categoria ativa, favoritar. Verde-sálvia (`--success`)
   aparece **apenas** como "Aberto".
3. **Material > borda.** Cartões brancos sobre papel morno, sombra suave
   (offset + blur), cantos generosos. Sem filetes decorativos, sem block-shadow.
4. **Movimento de mola.** Feedback no toque (pointer-down), contínuo durante o
   gesto. Mola crítica (`damping 1.0 · response ~0.35`) para toques; leve bounce
   só quando o gesto carregou momentum.
5. **Degrada com honestidade.** `prefers-reduced-transparency` → vidro vira
   sólido; `prefers-reduced-motion` → cross-fade curto; `prefers-contrast: more`
   → superfície opaca com borda.

## Tokens (`src/app/globals.css`)

| Token | Valor | Uso |
| --- | --- | --- |
| `--background` | `oklch(0.925 0.016 74)` | Papel morno — fundo do app |
| `--card` | `oklch(0.985 0.006 78)` | Superfície de cartão (branco morno) |
| `--foreground` | `oklch(0.27 0.013 55)` | Texto (marrom-cacau quase-preto) |
| `--muted-foreground` | `oklch(0.48 0.02 58)` | Texto secundário — tingido do quente, nunca cinza puro |
| `--primary` | `oklch(0.555 0.105 33)` | Terracota-rosê — o único acento |
| `--success` | `oklch(0.55 0.07 140)` | Sálvia — só "Aberto" |
| `--border` | `oklch(0.87 0.02 74)` | Hairline (usar com parcimônia) |
| `--radius` | `0.75rem` | Base; cartões usam `rounded-2xl`/`rounded-3xl` |
| `--glass-bg` / `--glass-border` | `oklch(0.95 0.012 76 / 0.68)` / `oklch(1 0 0 / 0.5)` | Camadas `.liquid-glass` e `.glass-chrome` |

Preservados do sistema anterior (usados em outras telas): `--caramel`,
`--pistachio`, `--whatsapp`, `--tone-*`, escala tipográfica (`--text-*`), sombras
tingidas (`--shadow-*`), animação `reveal-rise`.

## Tipografia

- **Fraunces** (`font-serif`) — só como voz editorial/estrutural: wordmark
  "Zelo", títulos de seção do cardápio, nome do destaque.
- **Geist** (`font-sans`) — corpo e interface: nome de produto, descrição,
  preço, labels. Números com `tabular-nums`.
- **Geist Mono** — dados tabulares pontuais (mantido do incumbente).
- Regra Apple: tracking negativo cresce com o tamanho; leading aperta no display.
  Já embutido na escala `--text-*`.

## Materiais de vidro

- `.glass-chrome` — camada estrutural (cabeçalho do cardápio). `blur(24px)
  saturate(180%)`, aresta clara no topo (`inset 0 1px 0`), sem borda inferior.
  O conteúdo rola por baixo; sticky `top-0`.
- `.liquid-glass` — vidro mais leve (barra de abas `MobileBottomNav`, cápsula
  "Ver sacola", navbar desktop). Retom o mesmo `--glass-bg`.
- **Nunca** empilhar vidro claro sobre vidro claro.
- Fallbacks em `@media (prefers-reduced-transparency / prefers-contrast)`.

## Padrões da tela de Cardápio

- **Cabeçalho** (`StoreHeader`): wordmark + pílula de status + discos de ação
  (busca, info, sacola). Sem horário — vai no cartão de aviso.
- **Cartão de aviso**: disco (sálvia/terracota) + status + horário/regra 17h.
- **Destaque de hoje** (`FeatureCard`): 1 produto, foto 16:9, nome serifado,
  preço, "Adicionar". Só no filtro "Todos". Substituiu o carrossel de slogans.
- **Cards de produto** (`ProductCard`): foto-primeiro 16:10, favoritar em vidro
  sobre a foto, nome sans, descrição 2 linhas, preço + peso, `+` / stepper
  terracota. Esgotado = card a 55% + "Esgotado hoje", sem botão.
- **Categorias**: pílulas roláveis dentro do vidro; ativa = terracota sólida.
  Em "Todos" a lista agrupa por categoria; senão, grade única.
- **Cápsula "Ver sacola"**: flutua acima da `MobileBottomNav` quando há itens.
- Placeholder de foto (`ProductThumb`): superfície `--secondary` neutra +
  ícone de categoria. **Trocar por foto real assim que a Zelo fornecer** — é a
  maior fraqueza atual do layout.

## Pendências de propagação

`ProductCard` já é compartilhado com a busca. As demais telas (produto,
carrinho, checkout, pedidos, conta, admin) herdam os tokens automaticamente mas
não foram revisadas tela a tela — próximo passo do redesign.
