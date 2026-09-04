# _HANDOFF — Evolução do App (resumo de sessão)

Resumo para abrir uma sessão nova sem re-explorar o código. Cobre a evolução
do painel admin + frete + promoções/cupons/financeiro + avaliações. Reescrito
em 2026-09-04 para condensar o histórico acumulado de sessões anteriores —
o que importa é o **estado atual**, não a ordem em que foi feito. Atualizado
de novo mais tarde no mesmo dia (2026-09-04) após estoque básico, melhorias
na tela do pedido e comanda manual. Os planos originais e mais detalhados
estão nos docs **103, 104, 105, 106** desta pasta (nunca chegaram a existir
como arquivos — o conteúdo deles vive só aqui).

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
- **Fluxo de deploy:** o assistente commita local em `develop` e faz `push`
  pra `origin/develop`; quem faz o **merge para `main`** e o deploy de fato é
  o dono (via Vercel, ligado ao git). Não presumir que um commit em
  `develop` já está em produção sem confirmar (`git log main..develop`, ou
  testar a URL de produção).
- **Regra de escopo herdada da 102:** mexer só em apresentação quando
  possível; não tocar em `modules/`, rotas de API e migrations sem
  necessidade — mas vários itens abaixo (frete, promoções, kanban, estoque,
  comanda manual) já exigiram migrations e mudanças de módulo quando o
  recurso pedia.

---

## 2. Fatos técnicos essenciais

### Pedidos / status
- Enum: `received → confirmed → in_production →
  (ready_for_pickup | ready_for_delivery) → [ready_for_delivery →
  out_for_delivery] → delivered`; mais `cancelled`.
- **Transições são forward-only + cancelar**, validadas em
  `private.transition_order_status` (schema definido na migration inicial,
  função redefinida por inteiro nas migrations de promoções e de estoque —
  ver §4). Não há volta nem desfazer sem migration nova. `nextAdminStatus(status,
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
  `customerNote`, `address.referencePoint`, `customer.phoneE164`, `guest`
  (nome/telefone avulso quando o pedido não tem `customer` vinculado) e
  `isGuest` — a tela `pedido/[id]/page.tsx` **já renderiza tudo isso**
  (implementado, ver §4).
- Não há sistema de toast no projeto (só `AppDialogContext`:
  `confirm`/`prompt`/`alert` modais).

### Pedido / pagamento
- `private.create_order(payload jsonb)` recalcula todos os totais no
  servidor — inclusive o preço com desconto de promoções e o
  estoque (§4).
- `orders.customer_id` agora é **nullable**. Pedido de **comanda manual**
  (admin cria pra cliente sem conta) grava `guest_name`/`guest_phone_e164`
  em vez de `customer_id` — a não ser que o telefone já bata com um
  `customers.phone_e164` existente, caso em que vincula normalmente
  (implementado, ver §4). `customers.id` continua exigindo `auth.users`
  correspondente — pedido avulso nunca cria linha em `customers`.
- `products.stock_quantity` (integer nullable, `null` = ilimitado) —
  **implementado** (ver §4). `product_images` já suporta várias imagens +
  `is_primary` + `sort_order` (a UI só faz upload de uma).
- Pix: `orders.mp_order_id`; `payment_events` guarda o payload completo do MP
  em jsonb, mas o código não extrai a taxa (item financeiro do 104, não
  iniciado). Estorno existe (`refundOrderPixPayment`).
- **Comanda manual** (admin) só aceita `payment_method` `cash`/`card` —
  Pix fica de fora desse fluxo (não dá pra gerar cobrança dinâmica sem o
  checkout do cliente).

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
  cotação. **Entrega de comanda manual** (admin) não passa por essa
  cotação — endereço digitado livre + taxa digitada pelo admin (ver §4).
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
  `private.create_order` e `private.create_manual_order`, que são a fonte
  de verdade do preço gravado no pedido.
- Catálogo público espelha a mesma resolução em TypeScript
  (`src/modules/catalog/promotions.ts`) só pra exibir preço com desconto —
  carrinho/checkout herdam automaticamente via `CatalogProduct.price`
  (que já vem com desconto aplicado; `originalPrice`/`discountPercent`
  aparecem só quando há desconto ativo, usados pra mostrar preço riscado).
- Admin: aba **Promoções** em `admin/catalogo` — bloqueia duas promoções do
  mesmo nível (mesmo escopo) cobrindo o mesmo alvo no mesmo período.

### Estoque — implementado
- `products.stock_quantity` (integer nullable). `null` = ilimitado/não
  controlado (ex.: bolo sob encomenda); preenchido = quantidade controlada.
- `private.create_order`/`private.create_manual_order` checam
  disponibilidade com `for update` (trava a linha) e decrementam com um
  `UPDATE ... where stock_quantity >= v_qty` que também serve de validação
  atômica final (cobre o caso de duas linhas do mesmo produto no mesmo
  pedido). Estoque zerado → `is_available = false` automaticamente.
- `private.transition_order_status`: ao cancelar, devolve a soma das
  quantidades por produto (agregada) e reativa `is_available` se o estoque
  voltar a ficar > 0.
- Admin: campo "Estoque (deixe vazio para ilimitado)" no formulário de
  produto (`admin/catalogo`) + badge de estoque atual/esgotado na listagem.

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
- Botão **"Nova comanda"** no header do kanban abre `/admin/pedidos/novo`
  (comanda manual — ver §4).
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
- Cards mostram badge **"Avulso"** quando o pedido é de comanda manual sem
  vínculo com customer (`order.isGuest`).
- Mobile (abaixo de `lg`, 1024px): pills de status + lista de um status por
  vez, sem drag (o card não entra em `DndContext` nesse modo).
- Fetch: quadros usam `scope=all` (200 pedidos mais recentes) filtrados por
  `deliveryMethod` no cliente; Agenda usa `scope=scheduled`.

### Comanda manual — implementada
- `/admin/pedidos/novo`: admin cria pedido pra cliente sem conta (liga,
  aparece na loja, pede por WhatsApp).
- Se o telefone digitado já bater com um `customers.phone_e164` existente,
  o pedido vincula a esse `customer_id` (aparece no histórico do cliente no
  app). Senão fica avulso (`guest_name`/`guest_phone_e164`).
- `private.create_manual_order(payload)` (nova RPC, admin-only via
  `private.is_admin()`) é uma cópia adaptada de `private.create_order` —
  mesma lógica de preço/promoção/estoque, mas sem `auth.uid()`/carrinho, com
  `payment_method` restrito a `cash`/`card`, e opção "já pago" que grava
  `payment_status = 'confirmed'` direto na criação.
- Suporta retirada, entrega (endereço digitado, sem geocodificação — usa
  lat/lng da loja como placeholder e taxa digitada pelo admin) e
  agendamento, igual o pedido normal do cliente.
- UI: `AdminManualOrderItemPicker` (`src/components/admin/`) monta os itens
  a partir do catálogo (`GET /api/v1/admin/catalog`), com seleção de
  adicionais permitidos por produto.

### Outros
- Roadmap Fase 14 = login do cliente por SMS (Twilio Verify). Hoje a
  identidade do cliente é temporária. Limite de cupom por cliente e
  atribuição confiável de avaliação dependem disso.
- `docs/00-produto-e-dominio/00 - Produto.md` → "Evoluções Futuras" já lista
  fidelidade, cupons, promoções, favoritos, gateways, confirmação automática
  de Pix, WhatsApp, financeiro, relatórios, múltiplas lojas. Não lista:
  avaliações, comanda manual, impressão térmica (estoque básico já saiu
  desta lista, foi implementado). "Controle detalhado de estoque" e
  "sistema financeiro completo" continuam fora de escopo.

---

## 3. Estado por doc (103–106)

| Doc | Assunto | Status |
| --- | --- | --- |
| **103 — Painel Administrativo** | Kanban de pedidos, estoque, comanda manual, impressão térmica + melhorias menores | **Kanban, estoque, melhorias na tela do pedido e comanda manual prontos** — commitados e enviados a `origin/develop`, falta merge/deploy pra `main`. Restam: impressão térmica (bloqueada por decisão do dono, ver §5), catálogo (resto), loja/relatórios, push. |
| **104 — Promoções, Cupons e Financeiro** | Promoções por especificidade; cupons; financeiro com taxa real do MP | **Promoções prontas**, commitadas e enviadas a `origin/develop`, falta merge/deploy pra `main`. Cupons e Financeiro não iniciados (decisões já travadas — ver §4). |
| **105 — Precisão do Frete** | Google Maps: autocomplete, mapa satélite, tratar confiança, origem da loja por pin | **(a)-(d) prontos**, todos já enviados a `origin/develop`. (a)-(c) confirmados em produção; (d) falta merge/deploy pra `main`. (e) suavizar taxa **adiado a pedido do dono**; (f) extrair componente único de endereço agora **desbloqueado** (comanda manual já existe), mas não iniciado. |
| **106 — Avaliações e Depoimentos** | Fase 1: avaliação do pedido + depoimentos curados. Fase 2: nota por produto (pós login SMS) | Não iniciado. 3 decisões menores em aberto — ver §5. |

**Commits em `develop` que ainda não foram pro `main`** (já enviados a
`origin/develop`, faltando só o merge/deploy do dono):
`efdc964` (docs handoff), `335a5ca` (fix CSP), `ad31fe4` (103-estoque),
`69f2180` (103-melhorias no pedido), `da908e7` (103-comanda manual).
Confira `git log main..develop` no início da sessão pra saber se já foram
mergeados.

**Migrations novas desde o último deploy confirmado** (precisam de
`supabase db push` no deploy): `20260904170000_promotions.sql`,
`20260904180000_product_stock_quantity.sql`,
`20260904190000_manual_orders.sql`.

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

### Estoque (103)
- Campo único `stock_quantity` nullable em `products` (vazio = ilimitado,
  não um checkbox "controla estoque" separado) — **implementado**.
- Estoque zerado marca `is_available = false` (reaproveita a UI existente,
  não esconde o produto do catálogo público) — **implementado**.
- Cancelar pedido devolve o estoque debitado e reativa `is_available` —
  **implementado**.

### Melhorias na tela do pedido (103)
- Expor no admin tudo que `getAdminOrder` já retornava e a tela não
  mostrava: observação por item, ponto de referência do endereço,
  agendamento, troco, observação do cliente, motivo de cancelamento,
  histórico de status — **implementado** (mudança só de apresentação, sem
  schema/API nova).

### Comanda manual (103)
- Telefone que já bate com customer existente **vincula** o pedido a essa
  conta (aparece no histórico do cliente no app); senão fica avulso — **implementado**.
- Admin marca "já pago" (dinheiro/cartão físico) → `payment_status` direto
  `confirmed`; Pix fica fora do escopo (`payment_method` restrito a
  `cash`/`card`) — **implementado**.
- Botão "Nova comanda" no header do kanban de `/admin/pedidos` —
  **implementado**.
- Suporta retirada, entrega (endereço digitado sem geocodificação, taxa
  digitada pelo admin) e agendamento — **implementado**.

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
   impressão silenciosa × com janelinha. **Bloqueia o início do bloco de
   impressão térmica.**
2. **Nota — dados do MEI:** quais entram (CNPJ, nome empresarial, endereço)?
   Emite NFC-e/NF-e hoje ou é só comprovante interno?

### 106
1. Nome no depoimento: primeiro nome + inicial (sugestão) / completo /
   cliente escolhe.
2. Mínimo de avaliações pra mostrar estrela no card do produto (sugestão: 3).
3. Push "como foi seu pedido?" após entrega — quer, ou só convite na tela de
   acompanhamento?

---

## 6. Ordem de prioridade e próximos passos

1. **Merge/deploy de `develop` pra `main`**: 5 commits pendentes (ver §3) —
   inclui 3 migrations novas que precisam de `supabase db push` no deploy.
2. **105-(c) drag do pin** e **103-kanban drag-and-drop**: verificar num
   aparelho real (tablet/celular ou mouse de verdade) — não foram
   confirmados por automação em nenhuma sessão (ver §7, "Limitações de
   teste").
3. **103 — impressão térmica**: pergunte ao dono sobre a conexão da
   impressora (decisão em aberto §5) antes de planejar.
4. **103 — resto**: catálogo, loja/relatórios, push — sem decisões
   pendentes conhecidas, pode entrar a qualquer momento.
5. **104 — Cupons + Financeiro**: decisões já travadas, desbloqueado (frete
   preciso e comanda manual, dependências do 103, já prontos).
6. **106 — Avaliações**: Fase 1 pode entrar a qualquer momento (barata);
   Fase 2 depende do login por SMS (Fase 14 do roadmap).
7. A **repaginação visual do admin** (primitivos, tokens, skeletons —
   pendência do redesign 102) ainda não aconteceu em nenhuma tela nova
   (catálogo, promoções, kanban, pedido, comanda manual incluídos) — o
   admin inteiro ainda usa `<button>`/`<div>` crus, não os primitivos de
   `src/components/ui`.

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
  via `npx supabase ...`. Pra aplicar migration local: `npx supabase
  migration up`. Pra regenerar `src/types/database.ts`: `pnpm gen:types`
  (script já configurado, equivalente a `supabase gen types typescript
  --local > src/types/database.ts` — nunca `2>&1 >`, o CLI escreve
  "Connecting to db..." no stderr, que polui o arquivo se for redirecionado
  junto).
- **`pnpm format` roda `prettier --write .` no repo INTEIRO** — se a
  versão/config local do prettier divergir levemente do que gerou o último
  commit, reformata dezenas de arquivos não relacionados com diffs de puro
  estilo (aconteceu em 2026-09-04). Preferir `npx prettier --write
  <arquivos específicos>` escopado só aos arquivos tocados na tarefa. Se
  `pnpm format` já rodou sem querer: comparar `git status`, confirmar por
  amostragem que os diffs extras são só estilo (`git diff <arquivo>`), e
  restaurar com `git checkout --pathspec-from-file=<lista> --pathspec-file-nul --`
  (gerar a lista com `tr '\n' '\0'` — nomes de arquivo com acento/espaço
  quebram o parsing padrão de `--pathspec-from-file`).
- **Testar RPCs SQL isoladamente via `psql`**, sem precisar montar UI:
  `docker exec -i supabase_db_zelo psql -U postgres -d postgres` (container
  do Supabase local). Pra simular um usuário autenticado (customer ou
  admin) dentro de uma transação: inserir a linha correspondente em
  `auth.users` (+ `customers`/`admin_profiles` conforme o caso), depois
  `perform set_config('request.jwt.claims', json_build_object('sub',
  v_user_id, 'role', 'authenticated')::text, true); perform
  set_config('role', 'authenticated', true);` antes de chamar a função
  `public.*`. Rodar em `begin`/`rollback` quando for só teste, pra não
  sujar o banco.
- **Rodar `pnpm build` derruba temporariamente o dev server de outra sessão
  ativa** (compartilham `.next/`) — o dev server se recupera sozinho no
  próximo request, mas pode exigir limpar service worker/cache do browser
  (`navigator.serviceWorker.getRegistrations()` + `caches.keys()`) e
  recarregar com força.
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
