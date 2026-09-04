# _HANDOFF — Evolução do App (resumo de sessão)

Resumo para abrir uma sessão nova sem re-explorar o código. Cobre a evolução
do painel admin + frete + promoções/cupons/financeiro + avaliações. Reescrito
em 2026-09-04 para condensar o histórico acumulado de sessões anteriores —
o que importa é o **estado atual**, não a ordem em que foi feito. Os planos
originais e mais detalhados estão nos docs **103, 104, 105, 106** desta
pasta (nunca chegaram a existir como arquivos — o conteúdo deles vive só
aqui).

---

## 1. Contexto do projeto

- **Repo:** `zelo-app-frontend` (confeitaria Zelo, Pereiro-CE). **Um único
  admin.** O painel `/admin` é usado **majoritariamente em tablet**.
- **Stack:** Next.js (versão modificada — ler `node_modules/next/dist/docs/`
  antes de codar, ver `AGENTS.md`), TypeScript strict, Tailwind v4 (`@theme`
  em `globals.css`), shadcn/ui, TanStack Query, Supabase (Postgres + RLS +
  funções RPC), react-hook-form + zod, Google Maps (Places + Maps JS +
  Geocoding), `@dnd-kit` (drag-and-drop), Mercado Pago (Pix), Web Push
  (VAPID).
- **Gerenciador:** pnpm. **Verificação por fase:**
  `pnpm typecheck && pnpm lint && pnpm build`. Commits Conventional em pt-BR,
  uma linha, sempre encerrando com `Co-Authored-By: Claude Sonnet 5
  <noreply@anthropic.com>`.
- **Fluxo de deploy:** o assistente commita local em `develop`; quem faz
  `push`/PR/merge para `main` e o deploy de fato é o dono (via Vercel, ligado
  ao git). Não presumir que um commit local já está em produção sem
  confirmar (`git log origin/main`, ou testar a URL de produção).
- **Regra de escopo herdada da 102:** mexer só em apresentação quando
  possível; não tocar em `modules/`, rotas de API e migrations sem
  necessidade — mas os itens abaixo (frete, promoções, kanban) já exigiram
  migrations e mudanças de módulo quando o recurso pedia.

---

## 2. Fatos técnicos essenciais

### Pedidos / status
- Enum: `received → confirmed → in_production →
  (ready_for_pickup | ready_for_delivery) → [ready_for_delivery →
  out_for_delivery] → delivered`; mais `cancelled`.
- **Transições são forward-only + cancelar**, validadas em
  `private.transition_order_status` (schema definido na migration inicial,
  função redefinida por inteiro na migration de promoções — ver §4). Não há
  volta nem desfazer sem migration nova. `nextAdminStatus(status,
  deliveryMethod)` (`src/modules/admin/types.ts`) já resolve a bifurcação
  pickup/delivery e o resto da cadeia até `delivered`.
- `delivery_method ∈ {pickup, delivery}`; `timing ∈ {immediate, scheduled}` +
  `scheduled_for`. "Agendamento" é o `timing`, não um terceiro método.
- Realtime: `useAdminOrdersRealtime` (`src/modules/realtime/hooks.ts`) expõe
  `{ version, status }` — `version` incrementa em qualquer mudança de
  `orders`/`order_status_history` (sem dizer o quê mudou; comparar IDs no
  cliente pra detectar pedido novo), `status` é
  `idle/connecting/subscribed/reconnecting/error` (usado no indicador "ao
  vivo" do kanban, ver §5).
- `getAdminOrder` devolve `history`, `needsChange`/`changeForAmountCents`,
  `customerNote`, `address.referencePoint`, `customer.phoneE164` — a tela
  `pedido/[id]/page.tsx` ainda não renderiza tudo isso.
- Não há sistema de toast no projeto (só `AppDialogContext`:
  `confirm`/`prompt`/`alert` modais).

### Pedido / pagamento
- `private.create_order(payload jsonb)` recalcula todos os totais no
  servidor — inclusive o preço com desconto de promoções (§4).
- `orders.customer_id` é NOT NULL → `customers` → `auth.users`. Comanda
  manual (103, não iniciado) precisa de mudança de schema pra "cliente sem
  conta".
- `products` não tem coluna de estoque. `product_images` já suporta várias
  imagens + `is_primary` + `sort_order` (a UI só faz upload de uma).
- Pix: `orders.mp_order_id`; `payment_events` guarda o payload completo do MP
  em jsonb, mas o código não extrai a taxa (item financeiro do 104, não
  iniciado). Estorno existe (`refundOrderPixPayment`).

### Frete / mapas — Google Maps Platform, 100% migrado
- `src/modules/delivery/{quote,maps,osm,pereiro,fee,geo,places,
  google-maps-loader}.ts`.
- **Autocomplete** (`places.ts`, client-safe, chave `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`):
  Places API (New), enviesado pra Pereiro, session token cobrindo
  autocomplete + Place Details.
- **Geocodificação por texto** (`maps.ts:geocodeAddress`, chave de servidor
  `GOOGLE_MAPS_API_KEY`): travada na cidade via `components=locality:
  Pereiro|...` + endereço sem cidade no texto (senão o Google casa "Centro,
  CE" com Sobral, ~250 km). Expõe `locationType` (ROOFTOP/RANGE_INTERPOLATED/
  GEOMETRIC_CENTER/APPROXIMATE) pra sinalizar confiança baixa.
- **Reverse geocode** (`maps.ts:reverseGeocodeCoords`): quando a coordenada
  já vem pronta (autocomplete ou pin arrastado), resolve o endereço real do
  ponto em vez de ecoar o texto digitado.
- **Mapa de confirmação**: `DeliveryGoogleMap.tsx` (Google Maps JS API,
  modo híbrido/satélite) + `google-maps-loader.ts` (injeta o script uma vez
  por página). Leaflet foi **removido do projeto**. Pin fixo no centro,
  arrasto do mapa (`dragstart`/`dragend`) dispara reverse geocode +
  recotação. `[data-map-container]` é o atributo que libera pinch-zoom no
  mobile (`LockMobileZoom.tsx`) — não depende mais de classe de nenhuma lib.
- **Área de entrega**: raio em linha reta a partir da loja (não mais "está
  num dos 7 bairros"). Grátis até `store.freeDeliveryRadiusMeters`, fixo até
  `store.maxDeliveryRadiusMeters`, acima disso só retirada. Ambos os raios
  editáveis em **Ajustes → loja** no admin (`max ≥ grátis` validado).
  `calcDeliveryFeeCents` ainda é **binário** (sem/com taxa fixa) — suavizar
  em faixas está adiado a pedido do dono, sem fórmula definida ainda.
  Bairro é `<Input>` opcional, só rótulo pro entregador, não entra na
  cotação.
- **Confiança do geocode**: `LocationPrecision = 'high'|'low'` em
  `DeliveryQuote` — `'low'` quando o Google geocodifica por texto com baixa
  precisão, ou quando cai em OSM/âncora local; sempre `'high'` quando a
  coordenada já veio de um pin que o cliente apontou. Quando `'low'`, o
  checkout mostra "Localização aproximada — confira com atenção se o pin
  está no lugar certo." O checkout **já** exige clicar "Confirmar
  localização no mapa" pra qualquer pedido de entrega, independente da
  precisão.
- Origem da loja: `stores.latitude/longitude` = `-6.048527, -38.461176`
  (R. Cap. Bandeira ~115, Pereiro-CE) — já corrigida em produção.
- CSP (`security-headers.ts`) libera `maps.googleapis.com`,
  `places.googleapis.com`, `maps.gstatic.com`, `khms0/khms1.googleapis.com`.

### Promoções — implementadas
- Tabela `promotions` (`scope`: `store`/`category`/`products`,
  `discount_percent`, `starts_at`/`ends_at` opcionais, `is_active`) +
  junções `promotion_categories`/`promotion_products`. RLS no padrão
  `categories`/`products`.
- `private.effective_price_cents(price_cents, category_id, product_id)`
  resolve por especificidade (produto > categoria > loja toda, nunca
  acumula) e arredonda por unidade em centavos — chamada dentro de
  `private.create_order`, que é a fonte de verdade do preço gravado no
  pedido.
- Catálogo público espelha a mesma resolução em TypeScript
  (`src/modules/catalog/promotions.ts`) só pra exibir preço com desconto —
  carrinho/checkout herdam automaticamente via `CatalogProduct.price`
  (que já vem com desconto aplicado; `originalPrice`/`discountPercent`
  aparecem só quando há desconto ativo, usados pra mostrar preço riscado).
- Admin: aba **Promoções** em `admin/catalogo` — bloqueia duas promoções do
  mesmo nível (mesmo escopo) cobrindo o mesmo alvo no mesmo período.

### Painel de pedidos — kanban
- `/admin/pedidos` é um kanban com 3 abas: **Retirada**, **Delivery**
  (colunas por status; as 3 primeiras — `received/confirmed/in_production`
  — são iguais nos dois quadros, a cauda muda pelo método de entrega) e
  **Agenda** (pedidos `timing='scheduled' AND status='received'`, lista
  simples com botão "Passar para produção" — 100% manual, não existe
  "aparece sozinho no quadro no dia").
- Arrastar (`@dnd-kit`, só no quadro desktop) ou o botão "avançar" em cada
  card fazem a mesma transição (`nextAdminStatus` + `POST
  /api/v1/admin/orders/[id]/status`); só aceita mover pra frente. Cancelar é
  um botão que abre um `prompt()` pedindo o motivo (mín. 3 caracteres).
  Avanço é **otimista** no cliente (reverte se a chamada falhar).
- Régua de urgência: borda do card muda de cor por minutos parado, usando
  `orders.updated_at` como proxy de "tempo no status atual" (não é exato —
  qualquer update no pedido reseta; ≥15 min aviso, ≥30 min crítico — chute
  razoável, ajustável).
- Indicador "ao vivo" (ponto verde quando o realtime está `subscribed`) +
  bipe (Web Audio API, sem arquivo de som) quando chega um pedido novo (por
  diff de IDs entre fetches do mesmo `scope`).
- Checkbox "Ocultar entregues" tira a coluna `delivered` da vista — é a
  versão simplificada de "recolhível + filtro de foco" (não é colapso por
  coluna individual).
- Mobile (abaixo de `lg`, 1024px): pills de status + lista de um status por
  vez, sem drag (o card não entra em `DndContext` nesse modo).
- Fetch: quadros usam `scope=all` (200 pedidos mais recentes) filtrados por
  `deliveryMethod` no cliente; Agenda usa `scope=scheduled`. Nenhuma
  migration nova — só `updated_at` passou a ser exposto no
  `AdminOrderListItem`/`LIST_SELECT` (coluna já existia).

### Outros
- Roadmap Fase 14 = login do cliente por SMS (Twilio Verify). Hoje a
  identidade do cliente é temporária. Limite de cupom por cliente e
  atribuição confiável de avaliação dependem disso.
- `docs/00-produto-e-dominio/00 - Produto.md` → "Evoluções Futuras" já lista
  fidelidade, cupons, promoções, favoritos, gateways, confirmação automática
  de Pix, WhatsApp, financeiro, relatórios, múltiplas lojas. Não lista:
  avaliações, estoque, comanda manual, impressão térmica. "Controle
  detalhado de estoque" e "sistema financeiro completo" estão fora de
  escopo — estoque básico e relatório financeiro simples são ok.

---

## 3. Estado por doc (103–106)

| Doc | Assunto | Status |
| --- | --- | --- |
| **103 — Painel Administrativo** | Kanban de pedidos, estoque, comanda manual, impressão térmica + melhorias menores | **Bloco 1 (quadro de pedidos) pronto, commitado localmente, falta subir.** Resto (estoque, comanda manual, impressão, dentro-do-pedido, catálogo, loja/relatórios, push) não iniciado. Faltam 3 decisões — ver §5. |
| **104 — Promoções, Cupons e Financeiro** | Promoções por especificidade; cupons; financeiro com taxa real do MP | **Promoções prontas, commitadas localmente, falta subir.** Cupons e Financeiro não iniciados (decisões já travadas — ver §4). |
| **105 — Precisão do Frete** | Google Maps: autocomplete, mapa satélite, tratar confiança, origem da loja por pin | **(a)-(d) prontos.** (a)-(c) confirmados em produção; (d) commitado localmente, falta subir. (e) suavizar taxa **adiado a pedido do dono**; (f) extrair componente único **bloqueado** até existir comanda manual (103). |
| **106 — Avaliações e Depoimentos** | Fase 1: avaliação do pedido + depoimentos curados. Fase 2: nota por produto (pós login SMS) | Não iniciado. 3 decisões menores em aberto — ver §5. |

**Commits pendentes de push/deploy** (todos em `develop`, local):
`8dc207d` (105-d), `e1b0a41` (104 promoções), `601fd10` (103 kanban).
Confira `git log origin/develop..develop` no início da sessão pra saber se
já foram subidos.

---

## 4. Decisões travadas

### Quadro de pedidos (103)
- Dois quadros (Retirada/Delivery) + painel Agenda separado; agendado não se
  mistura — **implementado**.
- Arrastar e soltar forward-only, sem arrastar entre quadros; botão de
  avançar no card; cancelar = botão no card — **implementado**.
- Régua de urgência (card muda de cor por tempo parado) — **implementado**
  com `updated_at` como proxy.
- Celular: um fluxo por vez, em lista — **implementado**.

### Promoções (104)
- Uma promoção efetiva por produto, por especificidade: produto > categoria
  > loja toda. Admin bloqueia duas do mesmo nível cobrindo o mesmo alvo —
  **implementado**.
- Abrangência: loja toda / categorias / produtos. Percentual + período +
  ativa — **implementado**.
- Arredondar por unidade, em centavos — **implementado**.

### Cupons (104) — não implementado
- Tipos: percentual, valor fixo, frete grátis.
- Incide sobre subtotal de produtos (não sobre frete; "frete grátis" zera o
  frete).
- Sem acúmulo com promoção: carrinho com item em promoção → cupom recusado.
- Só limite total de usos (sem limite por cliente até o login por SMS).
- Uso contado junto com a criação do pedido (atômico); cancelamento devolve.

### Financeiro (104) — não implementado
- Taxa real do Mercado Pago, gravada por transação (1 chamada extra ao MP na
  confirmação do Pix): grava taxa (R$) e líquido (R$) no pedido.
- Campo configurável de taxa (padrão 0,99%) só pra estimar onde não há o
  número real.
- Estorno não devolve a taxa — relatório mostra como custo.
- Dinheiro/cartão na entrega: separados (sem taxa MP).
- Aba "Financeiro" própria no admin.

### Frete (105)
- Google Maps Platform (não OSM/Leaflet) — **implementado**.
- Satélite no mapa de confirmação — **implementado**.
- Geocodificação travada na cidade da loja — **implementado**.
- Fallback de rota = linha reta × 1,3 (não mais usado no caminho principal
  do quote, que agora é raio puro — ver §2).

---

## 5. Decisões em aberto

### 103
1. **Impressora — conexão:** USB no tablet, cabo de rede ou Wi-Fi? Define
   impressão silenciosa × com janelinha.
2. **Nota — dados do MEI:** quais entram (CNPJ, nome empresarial, endereço)?
   Emite NFC-e/NF-e hoje ou é só comprovante interno?
3. ~~Agendados: aparecem sozinhos no quadro no dia, ou só manual?~~
   **Resolvido por padrão como "só manual"** ao implementar o kanban (painel
   Agenda com botão "Passar para produção") — revisar com o dono se ele
   preferir o outro modo.

### 106
1. Nome no depoimento: primeiro nome + inicial (sugestão) / completo /
   cliente escolhe.
2. Mínimo de avaliações pra mostrar estrela no card do produto (sugestão: 3).
3. Push "como foi seu pedido?" após entrega — quer, ou só convite na tela de
   acompanhamento?

---

## 6. Ordem de prioridade e próximos passos

1. **Subir os 3 commits pendentes** (`develop` → PR → `main` → deploy):
   105-(d), 104-Promoções, 103-kanban. Nenhum deles tem migration que exija
   passo manual extra além do deploy normal (Vercel + `supabase db push`
   das migrations `20260904170000_promotions.sql` — a única nova desde o
   último deploy confirmado).
2. **105-(c) drag do pin** e **103-kanban drag-and-drop**: verificar num
   aparelho real (tablet/celular ou mouse de verdade) — não foram
   confirmados por automação em nenhuma sessão (ver §7, "Limitações de
   teste").
3. Depois de subir: **103 — demais blocos** (estoque, comanda manual,
   impressão térmica, melhorias dentro do pedido, catálogo, loja/relatórios,
   push) ou **104 — Cupons + Financeiro** — a ordem entre os dois não está
   travada; comanda manual (103) e financeiro (104) dependem de frete
   preciso (105), que já está pronto, então ambos estão desbloqueados.
4. **106 — Avaliações**: Fase 1 pode entrar a qualquer momento (barata);
   Fase 2 depende do login por SMS (Fase 14 do roadmap).
5. A **repaginação visual do admin** (primitivos, tokens, skeletons —
   pendência do redesign 102) ainda não aconteceu em nenhuma tela nova
   (catálogo, promoções, kanban incluídos) — o admin inteiro ainda usa
   `<button>`/`<div>` crus, não os primitivos de `src/components/ui`.

---

## 7. Notas técnicas e pegadinhas (vale ler antes de mexer)

- **Terminal do usuário mascara segredos colados** com `•` (U+2022) — nunca
  configurar env var de chave via pipe (`printf ... | vercel env add`); usar
  o dashboard web da Vercel. Conferir com `vercel env pull` + `cat` (sem
  máscara).
- **`components:locality` da Geocoding API** só funciona se o endereço-texto
  não trouxer cidade/estado — com "Centro, CE, Brasil" no texto o Google
  ignora o filtro e vai pra Sobral.
- **`@types/google.maps`** não é incluído automaticamente neste projeto (TS
  "^6", `moduleResolution: "bundler"`) — precisa de `/// <reference
  types="google.maps" />` explícito no topo de qualquer arquivo novo que use
  `google.maps.*` sem importar o pacote.
- **`supabase` CLI não está instalado globalmente** neste ambiente, mas roda
  via `npx supabase ...`. Pra regenerar `src/types/database.ts`:
  `npx supabase gen types typescript --local > src/types/database.ts`
  (nunca `2>&1 >` — o CLI novo escreve "Connecting to db..." no stderr, que
  polui o arquivo se for redirecionado junto) e depois `npx prettier --write`
  (a versão 2.116 do CLI gera sem `;`, então pular o prettier infla o diff
  à toa).
- **Place Details (GET `places/{id}`) exige `X-Goog-FieldMask`** — sem ele é
  400. No autocomplete (POST) o field mask é opcional.
- **Em Pereiro o Google não devolve bairro** (`sublocality*`) pros
  endereços — foi o que motivou trocar a área de entrega de "lista de
  bairros" pra "raio a partir da loja".
- **`react-beautiful-dnd` está descontinuado** — o projeto usa `@dnd-kit`
  (melhor suporte a React 19) pro drag-and-drop do kanban.

### Limitações de teste conhecidas (ferramenta de automação do navegador)
Em pelo menos duas sessões, a ferramenta de automação do navegador não
conseguiu completar um **gesto de arrastar** (drag) de ponta a ponta —
trava por 30s simulando arrasto sobre o canvas do Google Maps, e não produz
efeito nenhum ao simular arrasto sobre cards do `@dnd-kit` (nem com
`left_click_drag`, nem trocando os sensores, nem despachando eventos de
mouse manualmente via JS). Também trava em cliques simples quando o
viewport está em emulação de toque (preset `mobile` ou largura <768px) —
recupera depois, mas o clique em si não completa. **Nenhum dos dois parece
ser bug do app** (o código usa APIs padrão e a mesma lógica de destino
funciona perfeitamente via clique de botão) — mas os dois recursos
(arrastar o pin do mapa, arrastar cards do kanban) só foram verificados por
revisão de código + o endpoint por trás funcionando, nunca pelo gesto real.
**Testar os dois manualmente num aparelho de verdade antes de confiar
cegamente em produção.**

Também vale registrar: numa sessão, uma aba extra do navegador abriu sozinha
apontando pra produção (`cardapio.zeloconfeitaria.com.br`) com um captcha de
identificação — não foi o assistente que abriu, e ele não interagiu com
ela. Se isso se repetir, vale investigar a origem (outra sessão, extensão,
o próprio usuário).
