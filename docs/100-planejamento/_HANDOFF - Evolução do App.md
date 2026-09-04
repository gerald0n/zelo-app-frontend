# _HANDOFF — Evolução do App (resumo de sessão)

Resumo para abrir uma sessão nova sem re-explorar o código. Cobre o que foi
discutido: evolução do painel admin + frete + promoções/cupons/financeiro +
avaliações. Os planos detalhados estão nos docs **103, 104, 105, 106** desta
pasta.

---

## 1. Contexto do projeto

- **Repo:** `zelo-app-frontend` (confeitaria Zelo, Pereiro-CE). **Um único
  admin.** O painel `/admin` é usado **majoritariamente em tablet**.
- **Stack:** Next.js (versão modificada — ler `node_modules/next/dist/docs/`
  antes de codar, ver `AGENTS.md`), TypeScript strict, Tailwind v4 (`@theme` em
  `globals.css`), shadcn/ui, TanStack Query, Supabase (Postgres + RLS + funções
  RPC), react-hook-form + zod, Leaflet, Mercado Pago (Pix), Web Push (VAPID).
- **Gerenciador:** pnpm. **Verificação por fase:**
  `pnpm typecheck && pnpm lint && pnpm build`. Commits Conventional em pt-BR,
  uma linha.
- **Regra de escopo herdada da 102:** mexer só em apresentação quando possível;
  não tocar em `modules/`, rotas de API e migrations sem necessidade.

---

## 2. Fatos técnicos já levantados (não precisa re-explorar)

### Admin
- Rotas: `src/app/admin/{page,pedidos,pedido/[id],catalogo,configuracoes,login}`.
- Componentes: `src/components/admin/{AdminHeader,AdminBottomNav,AdminOrderCard}`.
- Módulos: `src/modules/admin/{orders,catalog,auth,audit,types}.ts`.
- O admin **não usa os primitivos** (`src/components/ui/{button,badge,card,
  input,skeleton,...}`) — usa `<button>`/`<div>` crus, valores avulsos
  (`rounded-[11px]`), `Loader2` no lugar de skeleton. O redesign 102 fez o app do
  cliente e **deixou o admin de fora de propósito**.

### Pedidos / status
- Enum de status: `received → confirmed → in_production →
  (ready_for_pickup | ready_for_delivery) → [ready_for_delivery →
  out_for_delivery] → delivered`; mais `cancelled`.
- **Transições são forward-only + cancelar**, validadas em
  `private.transition_order_status` (migration `20260809144928`). **Não há volta
  nem desfazer** sem migration nova.
- `delivery_method ∈ {pickup, delivery}`; `timing ∈ {immediate, scheduled}` +
  `scheduled_for`. **"Agendamento" é o `timing`, não um terceiro método.**
- Realtime: `useAdminOrdersRealtime` (`src/modules/realtime/hooks.ts`) é
  **só sinal** — incrementa um contador em qualquer mudança de
  `orders`/`order_status_history`; a página refaz o fetch. Não diz o que mudou
  (para detectar "pedido novo", comparar IDs no cliente).
- `getAdminOrder` **já devolve** `history` (order_status_history), `needsChange`/
  `changeForAmountCents` (troco), `customerNote`, `address.referencePoint`,
  `address.routeDistanceMeters`, `customer.phoneE164` — e a tela
  `pedido/[id]/page.tsx` **não renderiza nada disso**. É "expor o que já existe".
- **Não há sistema de toast** no projeto (só `AppDialogContext`:
  confirm/prompt/alert modais).

### Pedido / pagamento
- `private.create_order(payload jsonb)` recalcula todos os totais no servidor.
- `orders.customer_id` é **NOT NULL** → `customers` → `auth.users`. **Comanda
  manual precisa de mudança de schema** para "cliente sem conta".
- `products` **não tem coluna de estoque**. `product_images` **já** suporta
  várias imagens + `is_primary` + `sort_order` (a UI só faz upload de uma).
- Pix: `orders.mp_order_id`; `payment_events` guarda o payload completo do MP em
  jsonb, **mas o código não extrai a taxa**. `confirm_order_pix_payment` RPC.
  Estorno existe (`refundOrderPixPayment` + guarda de estado terminal).

### Frete / mapas
- `src/modules/delivery/{quote,maps,osm,pereiro,fee,geo}.ts`.
- **Chave do Google configurada e no ar** (item 105-a, ver §8). Cascata de
  geocodificação: pin do cliente → **Google Geocoding travado em Pereiro**
  (`components=locality:Pereiro|administrative_area:CE|country:BR`, endereço
  **sem** cidade no texto — senão o Google casa "Centro, CE" com Sobral) →
  Nominatim (viewbox recentrado em Pereiro real) → centroide de bairro fixo.
- Mapa: `DeliveryGoogleMap` = **Google Maps JS API** (satélite/híbrido), pin
  fixo no centro, ~256-320px. **Leaflet removido** (item 105-c, ver §10).
- Distância: **Google Routes API** (`routes.googleapis.com/directions/v2:computeRoutes`,
  `maps.ts:getDrivingDistanceMeters`) → fallback **linha reta × 1,3**
  (`geo.ts:estimateRoadDistanceMeters`). OSRM de demonstração **removido**.
- Taxa: **binária** — grátis até `freeDeliveryRadiusMeters` (2 km), senão fixa
  (`fixedDeliveryFeeCents`, R$5). `calcDeliveryFeeCents`. **Ainda binária** —
  suavizar é item futuro do 105 (não estava na lista original a–f).
- Env: `GOOGLE_MAPS_API_KEY` (servidor: Geocoding + Routes),
  `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (navegador: Maps JS + Places — **ainda sem
  uso**, entra no item b/c). `getGoogleMapsApiKey()` usa a de servidor e cai na
  pública se faltar — a pública tem restrição de referrer e **não serve** para
  Geocoding/Routes, então a de servidor precisa existir de verdade.
- Origem da loja: `stores.latitude/longitude`. **Corrigida** para
  `-6.048527, -38.461176` (R. Cap. Bandeira ~115, Pereiro-CE) — a antiga
  (`-5.977, -38.622`) estava ~28 km fora. Corrigida no seed **e** no banco de
  produção (UPDATE manual). `pereiro.ts` (7 bairros) e o viewbox do `osm.ts`
  também foram realinhados.
- CSP (`src/config/security-headers.ts`) libera `maps.googleapis.com` (connect).
  **Falta** `routes.googleapis.com` e os domínios do Maps JS — entram no item c
  (hoje as chamadas Google são server-side, CSP não as afeta).

### Outros
- Roadmap **Fase 14 = login do cliente por SMS** (Twilio Verify). Hoje a
  identidade do cliente é **temporária**. Limite de cupom por cliente e atribuição
  confiável de avaliação **dependem disso**.
- `docs/00-produto-e-dominio/00 - Produto.md` → "Evoluções Futuras" já lista:
  fidelidade, cupons, promoções, favoritos, gateways, confirmação automática de
  Pix, notificações WhatsApp, dashboard financeiro, relatórios, múltiplas lojas.
  **Não lista:** avaliações, estoque, comanda manual, impressão térmica.
- "controle **detalhado** de estoque" e "sistema financeiro completo" estão na
  lista de **fora de escopo** do 00-Produto — estoque básico e relatório
  financeiro simples são ok.

---

## 3. Os planos (docs 103–106)

| Doc | Assunto | Status |
| --- | --- | --- |
| **103 — Evolução do Painel Administrativo** | Kanban de pedidos, estoque, comanda manual, impressão térmica + melhorias menores (troco/obs/histórico/WhatsApp, catálogo, config, relatórios, push) | **Bloco 1 (quadro de pedidos) implementado, falta subir** (ver §13); resto do doc segue igual — falta 3 decisões (impressora, MEI/nota, agendados-automático) |
| **104 — Promoções, Cupons e Controle Financeiro** | Promoções por especificidade; cupons %/fixo/frete-grátis sem acúmulo; financeiro com taxa real do MP | **Promoções implementadas, falta subir** (ver §12); Cupons e Financeiro pendentes |
| **105 — Precisão do Cálculo de Frete** | Ligar Google Maps de verdade: Places Autocomplete, mapa Google com satélite, Routes API, tratar confiança, origem da loja por pin | **(a)-(c) em produção**; **(d) implementado, falta subir**; (e)-(f) pendentes. Ver §8/§10/§11. |
| **106 — Avaliações e Depoimentos** | Fase 1: avaliação do pedido + depoimentos curados. Fase 2: nota por produto (pós login SMS) | escrito; 3 decisões menores em aberto |

### 103 em uma linha cada
- **Quadro de pedidos:** dois quadros vivos (**Retirada** / **Delivery**, colunas
  diferentes no fim) + painel **Agenda** à parte. Arrastar e soltar **só pra
  frente**, não entre quadros. 3 primeiras colunas alinhadas. Recolhível + filtro
  de foco. Som ao entrar pedido, indicador "ao vivo". **Não mexe no banco.**
- **Estoque 🗄️:** opcional por produto; baixa ao criar o pedido; devolve no
  cancelamento; ajuste manual + histórico; "acabou" automático ao zerar.
- **Comanda manual 🗄️:** admin lança pedido de canal externo; cliente avulso
  (nome/telefone no pedido, sem conta); entra no quadro, baixa estoque, imprime.
- **Impressão térmica (EPSON TM-T20X) 🔌:** comprovante 80mm automático + botão
  reimprimir; dados do MEI + "não fiscal". Melhor caso: impressora na rede →
  impressão silenciosa (ePOS-Print). Fallback: `window.print()` com template.
- **Dentro do pedido 🖥️:** expor troco, obs. do cliente, obs. por item, ponto de
  referência, histórico; botão WhatsApp; editar nota interna; reimprimir.
- **Catálogo 🖥️:** "acabou" num toque, reordenar arrastando, várias fotos
  (banco já suporta), duplicar produto.
- **Loja/relatórios 🖥️:** pausar com tempo+motivo; config em abas; faturamento
  por período; produção do dia; relatório de cancelamentos.
- **Push no celular 🗄️:** notificar o admin ao entrar pedido (hoje só o cliente
  recebe push; `push_subscriptions` é chaveada por `customer_id`).

---

## 4. Decisões travadas

### Quadro de pedidos (103)
- Dois quadros (Retirada / Delivery) + painel Agenda separado; agendado não se
  mistura.
- Arrastar e soltar, forward-only, sem arrastar entre quadros. Cartão também tem
  botão de avançar. Cancelar = botão no cartão.
- Régua de urgência (cartão amarelo→vermelho por tempo parado).
- Celular: um fluxo por vez, em lista.

### Promoções (104)
- **Uma promoção efetiva por produto**, resolvida por **especificidade:
  produto > categoria > loja toda**. "Loja toda" cobre o que não está em outra.
  Admin bloqueia o mesmo produto em duas do mesmo nível.
- Abrangência: loja toda / categorias / produtos. Percentual + período + ativa.
- **Arredondar por unidade**, em centavos.
- "Loja toda −10% no lançamento" = uma promoção com data de fim.

### Cupons (104)
- Tipos: **percentual, valor fixo, frete grátis** (sim, mantém "frete grátis").
- Incide sobre subtotal de produtos (não sobre frete; "frete grátis" zera o
  frete).
- **Sem acúmulo com promoção:** carrinho com item em promoção → cupom recusado.
- **Só limite total de usos** (sem limite por cliente até o login por SMS).
- Uso contado junto com a criação do pedido (atômico); cancelamento devolve.

### Financeiro (104)
- **Taxa real do Mercado Pago**, gravada por transação (1 chamada extra ao MP na
  confirmação do Pix): grava taxa (R$) e líquido (R$) no pedido.
- Campo configurável de taxa (padrão **0,99%**) só para estimar onde não há o
  número real.
- Estorno não devolve a taxa — relatório mostra como custo.
- Dinheiro / cartão na entrega: separados (sem taxa MP).
- **Aba "Financeiro" própria** no admin.

### Frete (105)
- Conta de faturamento no Google Cloud **criada**; duas chaves ativas (servidor
  e navegador). Caminho é Google Maps Platform.
- **Satélite sim** no mapa de confirmação.
- **Trocar o mapa inteiro por Google** (não manter Leaflet).
- Geocodificação **travada na cidade da loja** via `components` + endereço sem
  cidade no texto (decisão tomada durante a implementação do item a).
- Fallback de rota = **linha reta × 1,3** (substituiu OSRM de demonstração).

---

## 5. Decisões em aberto

### 103
1. **Impressora — conexão:** USB no tablet, cabo de rede ou Wi-Fi? Define
   impressão silenciosa × com janelinha. (impressora chega "amanhã" a partir de
   ~2026-09-04)
2. **Nota — dados do MEI:** quais entram (CNPJ, nome empresarial, endereço)?
   Emite NFC-e/NF-e hoje ou é só comprovante interno?
3. **Agendados:** aparecem sozinhos no quadro no dia (sugestão) + botão "Passar
   para produção" antes; ou só manual?

### 106
1. Nome no depoimento: primeiro nome + inicial (sugestão) / completo / cliente
   escolhe.
2. Mínimo de avaliações para mostrar estrela no card do produto (sugestão: 3).
3. Push "como foi seu pedido?" após entrega — quer, ou só convite na tela de
   acompanhamento?

---

## 6. Ordem de prioridade acordada

1. **105 — Frete.** Fura a fila: bug de dinheiro (taxa binária nos 2 km) e de
   confiança; pré-requisito da comanda manual (103) e do financeiro (104).
   Ordem interna: **(a) chave Google + geocodificação — ✅ em produção**;
   **(b) autocomplete — ✅ em produção**; **(área de entrega por raio +
   bairro opcional + raio máx/grátis editáveis no admin — ✅ em produção,
   PR #31, ver §9)**; **(c) mapa Google + satélite + reverse geocode + mapa
   grande — ✅ em produção, PR #32, ver §10**; **(d) tratar confiança do
   geocode — ✅ implementado, pendente commit/deploy, ver §11**; **(e) suavizar
   a taxa — adiado a pedido do dono** (sem fórmula/faixas definidas ainda;
   retomar quando houver uma decisão de preço); (f) extrair componente único
   (bloqueado até existir comanda manual, 103).
2. **104 — Promoções — ✅ implementado, pendente commit/deploy, ver §12**
   (a promoção do lançamento, "loja toda −10%", já pode ser cadastrada pelo
   admin assim que subir).
3. **103 — Bloco 1 (quadros de pedidos) — ✅ implementado, pendente commit/deploy,
   ver §13** — e demais blocos (estoque, comanda manual, impressão, melhorias
   dentro do pedido, catálogo, loja/relatórios, push — ainda não iniciados).
4. **104 — Cupons + Financeiro** (após o Bloco 3; cupons de preferência após o
   login por SMS).
5. **106 — Avaliações** (Fase 1 pode entrar cedo por ser barata; Fase 2 após o
   login por SMS).
- A **repaginação visual** do admin (primitivos, tokens, skeletons — pendência da
  102) acontece junto, tela por tela.

---

## 7. Próximo passo

**Itens (a) + (b) + área por raio — ✅ EM PRODUÇÃO** (PR #31, deploy 04/09/2026).
Verificado no ar: CSP com `places.googleapis.com`; migração `20260904120000`
aplicada; `stores` com `free_delivery_radius_meters=1000` e
`max_delivery_radius_meters=3000`; `/api/v1/addresses/validate` a 0,4/2,0/5,0 km
→ grátis / R$5 / fora da área.

**Item (c) — mapa Google + satélite — ✅ EM PRODUÇÃO** (PR #32, merge direto
`develop → main`, confirmado por fora nesta sessão via `curl` na produção:
CSP com `maps.gstatic.com`/`khms0/khms1.googleapis.com`; `POST
/api/v1/addresses/validate` com `latitude`/`longitude` devolve
`formattedAddress` de reverse geocode real, não o texto digitado). Falta só
**arrastar o pin manualmente num aparelho real** — não confirmado por
automação em nenhuma das duas sessões (a ferramenta de navegador trava ao
simular arraste sobre o canvas do Google Maps; ver §10). A lógica em si (usa
os mesmos eventos padrão da Maps JS API) e o endpoint por trás dela (reverse
geocode, testado por `curl`) estão verificados — falta só a interação humana
de fato.

**Item (d) — tratar confiança do geocode — ✅ implementado nesta sessão**
(ver §11), ainda não commitado/subido.

Depois, **(e) suavizar a taxa** (hoje ainda tem o degrau em 1 km) e
**(f) extrair componente único** (checkout + comanda manual).

---

## 8. Estado da implementação do 105 (sessão 2026-09-04)

### Feito — item (a), em produção
- **Chaves Google Maps Platform criadas** (conta de faturamento ativa):
  - servidor `GOOGLE_MAPS_API_KEY` — restrição de API: Geocoding + Routes;
    restrição de aplicativo: Nenhuma. **Não pode ter restrição de referrer**
    (Geocoding/Routes recusam chave com referrer).
  - navegador `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` — restrição de API: Maps JS +
    Places; restrição de referrer: domínio da loja.
  - Ambas na Vercel como **tipo `config`** (Production + Preview) e no
    `.env.local`.
- `maps.ts`: `getDrivingDistanceMeters` migrado de **Distance Matrix → Routes
  API** (a Distance Matrix nem está habilitada na chave). Trata `distanceMeters`
  omitido (=0, proto3). `geocodeAddress` ganhou opção `components`. `describeError`
  loga a `cause` aninhada do undici.
- `geo.ts` (novo): `haversineDistanceMeters` + `estimateRoadDistanceMeters`
  (× 1,3) — fallback de rota no lugar do OSRM de demonstração.
- `quote.ts`: Routes API é sempre o caminho principal com chave;
  `composeStreetAddress` (rua+número+bairro, **sem** cidade) alimenta o Google
  junto com `components=locality:Pereiro|...`; OSM continua com endereço completo.
- `osm.ts`: `getDrivingDistanceOsm` removido; `PEREIRO_VIEWBOX` recentrado
  (`-38.49,-6.075,-38.44,-6.025`).
- `pereiro.ts`: 7 bairros realinhados por translação até a Pereiro real +
  distâncias recalculadas.
- **Origem da loja corrigida** (`-6.048527, -38.461176`) no `seed.sql`,
  `seed-operacional.sql` **e no banco de produção** (UPDATE manual rodado).
- Commits em `develop` (**pushados**): `3ecafc5` feat · `3f84c30` log de causa ·
  `ec840d3` trava de cidade v1 · `6fa7847` geocodifica só rua+bairro.
- Verificado em produção via `POST /api/v1/addresses/validate`:
  "Rua Coronel Jose Sabino, 100, Centro" → `-6.0476, -38.4614`, rota 392 m,
  frete R$ 0, `source: google_maps`. (Antes ia pra **Sobral**, 465 km, R$ 5.)

### Feito — item (b) + área por raio, EM PRODUÇÃO (PR #31, commits ec330d4..8674f9b)
- `src/modules/delivery/places.ts` (novo, **client-safe**): `fetchPlaceSuggestions`
  (POST `places:autocomplete`, `locationBias` circular em Pereiro, raio 15 km,
  `includedRegionCodes:['br']`), `fetchPlaceDetails` (GET `places/{id}`,
  `X-Goog-FieldMask` obrigatório), `createPlacesSessionToken` (`crypto.randomUUID`),
  parser dos `addressComponents`. Guarda de cidade: se `administrative_area_level_2`
  ≠ "Pereiro", devolve o texto mas com coordenada `NaN`. Lê
  `process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` **direto** (literal inlined) — não
  criou helper em `config/env.ts` porque nenhum client component importa de lá.
- `src/components/checkout/AddressAutocomplete.tsx` (novo): combobox acessível
  (`role="combobox"`, ↑/↓/Enter/Esc, `aria-activedescendant`), debounce 300 ms,
  `AbortController`, session token renovado após o Place Details. **Sem chave →
  `<Input>` puro** (degradação testada).
- Checkout (`checkout/recebimento/page.tsx`) e conta (`AccountAddressForm.tsx`):
  campo "Rua" → `AddressAutocomplete`. Ao escolher a sugestão, preenche rua (+ nº
  e bairro quando o Google traz) e fixa a coordenada.
- **Coordenada "presa à rua"**: os handlers de nº e bairro **não limpam mais**
  lat/lng (só a redigitação da rua limpa). (O `<select>` de bairro citado aqui
  foi removido logo depois — ver §9.)
- `security-headers.ts`: `+ https://places.googleapis.com` no `connect-src`.
- Verificado no dev (chave de navegador no `.env.local`): sugestões enviesadas
  pra Pereiro, 1 Place Details com o mesmo session token, `POST /addresses/validate`
  recebe `latitude/longitude` do `placeId` e responde `source: google_maps`.
  Teclado e degradação sem chave OK. Nenhuma violação de CSP.

### Aprendizados / pegadinhas
- **Seed local desatualizado**: o `stores.latitude/longitude` do banco local ainda
  é o valor **errado antigo** (`-5.977, -38.622`, ~25 km fora) — o `seed.sql` foi
  corrigido mas este banco não foi re-semeado. Quotes locais dão distância/tarifa
  erradas; **produção já está certa**. Re-semear (`pnpm db:reset` + seed) ou rodar
  o UPDATE manual pra testar frete localmente.
- Place Details (GET `places/{id}`) **exige** `X-Goog-FieldMask` — sem ele é 400.
  No autocomplete (POST) o field mask é opcional.
- Em Pereiro o Google não devolve bairro (`sublocality*`) para os endereços —
  `administrative_area_level_4` costuma repetir "Pereiro". (Foi o que motivou
  trocar a trava por bairro pela trava por raio — ver §9.)
- **Terminal do usuário mascara segredos colados** com `•` (U+2022) — a máscara
  foi salva na env var da Vercel e a Routes API quebrou com
  `TypeError: Cannot convert argument to a ByteString`. **Configurar env de chave
  só pelo dashboard web**, nunca `printf ... | vercel env add`. Conferir depois
  com `vercel env pull` + `cat` (sem máscara).
- **`components:locality` só funciona se o endereço-texto não trouxer
  cidade/estado** — com "Centro, CE, Brasil" no texto o Google ignora o filtro
  e vai pra Sobral.
- Vercel CLI 59.x: env `preview` trava no prompt "Git branch?" quando o valor
  vem por pipe; env `NEXT_PUBLIC_*` com cara de credencial exige
  `--type config`. Dashboard evita os dois.
- Deploy foi por `vercel --prod --force` (CLI, a partir do working dir local).
  Node local é v20 (o projeto quer ≥22) — não bloqueia.

### Falta no 105
- (c) mapa Google + satélite + reverse geocode + mapa grande + CSP (domínios
  Maps JS) · (d) tratar confiança (rooftop/interpolado; obrigar confirmar pin) ·
  (e) suavizar a taxa (faixas por km / R$ por km — hoje ainda tem o degrau em 1 km) ·
  (f) extrair componente único (checkout + comanda manual).

---

## 9. Área de entrega por raio + bairro opcional (sessão 2026-09-04, `develop`)

Decisão do dono: os nomes da lista de 7 bairros não batem com o uso local. Em vez
de arrumar a lista, a **área de entrega deixou de ser "está num dos bairros" e
passou a ser raio a partir da loja** (a coordenada já vem do autocomplete/pin).

- **Linha reta** (haversine, sem × 1,3, sem Routes API no caminho do quote).
- **Grátis ≤ 1 km**, **R$ 5 fixo** de 1 a 3 km, **> 3 km = fora** (só retirada).
- Migração `20260904120000_store_max_delivery_radius.sql`: coluna
  `stores.max_delivery_radius_meters` (default 3000). Raio máx **e** raio grátis
  agora editáveis em **Ajustes → loja** (`admin/configuracoes`); o admin valida
  `máx ≥ grátis` (mensagem amigável em `updateAdminStore` + `superRefine` na rota).
- Raio grátis no banco: **2000 → 1000** (seed + `UPDATE` manual no deploy).
- `quoteDelivery` lê `store.maxDeliveryRadiusMeters` (a constante do código sumiu).
- **Campo bairro virou `<Input>` opcional** ("Bairro / localidade (opcional)")
  no checkout e no `AccountAddressForm` — sumiu o `<select>`. Só rótulo pro
  entregador; não entra na cotação. `''` é aceito em todo o caminho
  (`create_order` só exige *uma string*; sem migração).
- `quoteDelivery` reescrito: exige só rua + número; resolve coordenada
  (input → geocode travado em Pereiro → OSM → **centro de Pereiro** como âncora);
  `routeDistanceMeters` do retorno agora carrega a distância em **linha reta**.
- `pereiro.ts` enxugado (só `id`+`name`, usado só pelo `findPereiroNeighborhood`
  do autocomplete); `isPereiroUrbanNeighborhood` removido.
- Schemas com `neighborhood` `.min(1)` → `.optional().default('')`:
  `create-order.ts`, `api/v1/addresses/{route,[addressId],validate}`.
- `formatAddress` (admin + customer-orders) e telas de endereço toleram bairro `''`
  (sem " – ,").
- `CheckoutContext.setAddressDetails`: mudar bairro/complemento/ponto de referência
  não invalida mais a cotação nem o pin confirmado.
- Verificado no dev: autocomplete → sem select → pin → quote por raio; faixas
  0,5/1,5/2,8/4 km dão grátis/R$5/R$5/fora; **pedido #1000 fechado com
  `neighborhood: ''`**; admin renderiza o endereço limpo; mudar o raio máx no
  admin para 2 km fez o endereço de 2,8 km cair pra fora da área na hora.

### Falta / fast-follow
- Suavizar a taxa (faixas por km / R$ por km) — hoje ainda tem o degrau em 1 km.
- `maps.ts:getDrivingDistanceMeters` e `geo.ts:estimateRoadDistanceMeters` seguem
  sem uso (ficaram de fora quando a área virou raio em vez de rota — não é
  o item c: esse já usa a Geocoding API via `reverseGeocodeCoords`, não a
  Routes API).

---

## 10. Item 105-(c) — mapa Google + satélite + reverse geocode (sessão 2026-09-04, `develop`)

Trocado o mapa de confirmação (checkout + cadastro de endereço da conta) de
Leaflet/OSM para a **Google Maps JavaScript API**, em modo híbrido
(satélite + rótulos). Pacote `leaflet`/`@types/leaflet` removido;
`@types/google.maps` (dev) adicionado.

- `src/modules/delivery/google-maps-loader.ts` (novo, client-safe): injeta o
  `<script>` da Maps JS API uma única vez por página (`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`,
  `v=weekly`, `loading=async` + callback), com `loadPromise` singleton.
- `src/components/checkout/DeliveryGoogleMap.tsx` (novo, substitui
  `DeliveryLeafletMap.tsx`, **removido**): mesma interface/props (`latitude`,
  `longitude`, `onReady`, `onError`, `onCenterChange`); `mapTypeId: HYBRID`,
  `disableDefaultUI` + `zoomControl`, `gestureHandling: 'greedy'`. Pin fica fixo
  no centro (overlay `<MapPin>` do Lucide, como antes) — o mapa arrasta por
  baixo; `dragstart`/`dragend` + debounce de 280 ms + limiar de 8 m disparam
  `onCenterChange`, replicando 1:1 a lógica do Leaflet.
- `src/modules/delivery/maps.ts`: nova `reverseGeocodeCoords(lat, lng)`
  (Geocoding API, parâmetro `latlng`). `quote.ts`: quando a coordenada já vem
  pronta (autocomplete ou pin arrastado) e há chave de servidor, `resolveCoordinates`
  agora chama o reverse geocode de verdade em vez de ecoar o texto digitado —
  `formattedAddress` reflete o endereço real do ponto. Sem chave de servidor
  (dev local sem `GOOGLE_MAPS_API_KEY`), cai no fallback anterior (compõe a
  partir dos campos do formulário).
- `DeliveryMapConfirm.tsx`: mapa maior (`h-44/h-52` → `h-64/h-80`); nova prop
  `addressPreview` mostra o `formattedAddress` abaixo do mapa ("Local do pin:
  ..."), passada pelo checkout (`checkout.addressDetails.formattedAddress`) e
  pelo `AccountAddressForm` (`quote.formattedAddress`, novo campo em
  `QuotePreview`).
- `LockMobileZoom.tsx`: a checagem de "isso é a área do mapa" (que libera
  pinch-zoom no mobile) trocou de `.leaflet-container` (classe do Leaflet) para
  `[data-map-container]` — atributo próprio no `<div>` do mapa, independente da
  lib. Reaproveitável se o mapa mudar de novo no futuro.
- CSP (`security-headers.ts`): `connect-src`/`img-src` ganharam
  `maps.gstatic.com`, `khms0/khms1.googleapis.com` (tiles de satélite);
  `script-src` (branch sem nonce) ganhou `maps.googleapis.com`. O script
  injetado dinamicamente pelo loader já era coberto por `strict-dynamic` no
  branch com nonce (produção).
- Verificado no dev (Supabase local, sem `GOOGLE_MAPS_API_KEY` de servidor):
  autocomplete → quote grátis/0,1 km → mapa carrega em satélite, pin centrado,
  zoom +/− funcionam, `addressPreview` mostra o endereço composto (fallback
  sem chave de servidor). `pnpm typecheck && pnpm lint && pnpm build` limpos.

### Pegadinha nova
- `@types/google.maps` declara `google.maps` como namespace ambiente global,
  mas neste projeto (TS "^6", `moduleResolution: "bundler"`) não é pego
  automaticamente por inclusão implícita de `@types/*` — precisou de
  `/// <reference types="google.maps" />` explícito no topo dos dois arquivos
  que usam o tipo (`google-maps-loader.ts`, `DeliveryGoogleMap.tsx`).

### Atualização (sessão seguinte, mesmo dia): verificado em produção
Depois do deploy (PR #32, merge direto em `main`), confirmado **por fora**
(sem abrir o app, só `curl`):
- CSP ao vivo já traz `maps.gstatic.com`/`khms0/khms1.googleapis.com`.
- `POST https://cardapio.zeloconfeitaria.com.br/api/v1/addresses/validate`
  com `latitude`/`longitude` (simulando pin arrastado) devolve
  `formattedAddress` de **reverse geocode real** (ex.: `"R. Cel. José Freire,
  87 - Pereiro, CE, 63460-000, Brasil"`), não o texto de rua/número enviado —
  prova que `reverseGeocodeCoords` funciona de ponta a ponta em produção
  (`GOOGLE_MAPS_API_KEY` de servidor está correta lá).
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` responde no endpoint da Maps JS API
  (`maps.googleapis.com/maps/api/js`) — Maps JavaScript API está habilitada.

**Ainda não confirmado**: arrastar o pin de fato (`dragstart`/`dragend` →
`onCenterChange`) por interação humana/real. A ferramenta de automação do
navegador travou nas duas tentativas ao simular arraste sobre o canvas do
Google Maps (mouse-down parece nunca soltar) — limitação da ferramenta em uso
nesta sessão, não reproduzida fora da área do mapa (cliques normais fora do
canvas funcionam). Como o endpoint por trás do gesto já foi validado por
`curl` e o código usa os eventos padrão e documentados da Maps JS API
(idênticos aos que o Leaflet já usava, validados em produção antes), o risco
residual é baixo — mas vale um arrasto manual num tablet/celular real.

### Falta no 105 (antes do item d)
- (e) suavizar a taxa (faixas por km / R$ por km) · (f) extrair componente
  único (checkout + comanda manual). Item (d) — ver §11.

---

## 11. Item 105-(d) — tratar confiança do geocode (sessão seguinte, mesmo dia)

Contexto: o checkout **já** exigia clicar "Confirmar localização no mapa" pra
qualquer endereço de entrega (`deliveryReady` em `recebimento/page.tsx` checa
`checkout.locationConfirmed` sempre, não só quando a confiança é baixa) — essa
parte de "obrigar confirmar pin" já existia antes deste item. O que faltava
era **explicar por que** confirmar importa: hoje o cliente não tem nenhum
sinal de que o Google "chutou" a localização vs. achou o endereço exato.

- `src/modules/delivery/maps.ts`: `GeocodeResult` ganhou `locationType`
  (`ROOFTOP` / `RANGE_INTERPOLATED` / `GEOMETRIC_CENTER` / `APPROXIMATE`, o
  `geometry.location_type` da Geocoding API), parseado em `geocodeAddress`
  (a chamada por **texto**, antes de existir um pin). `reverseGeocodeCoords`
  não ganhou o campo de propósito — uma vez que o cliente já apontou o pin
  (autocomplete ou arrasto), a posição é confiável por definição, reverse
  geocode ali só traz o endereço em texto.
- `src/modules/delivery/quote.ts`: novo tipo `LocationPrecision = 'high' | 'low'`
  em `DeliveryQuote`. `resolveCoordinates` decide a precisão por ramo:
  - coordenada já pronta (autocomplete/pin) → sempre `'high'` (o cliente
    apontou o lugar; não tem "chute" a avaliar).
  - geocode por texto via Google → `'low'` só se `locationType` for
    `GEOMETRIC_CENTER`/`APPROXIMATE`; `ROOFTOP`/`RANGE_INTERPOLATED` → `'high'`.
  - Nominatim (OSM) → sempre `'low'` (não devolve um sinal de precisão
    comparável ao do Google).
  - âncora no centro de Pereiro (`local_fallback`) → sempre `'low'` (já tinha
    mensagem própria, mantida como estava).
  - Quando `inServiceArea` é `true` e a precisão é `'low'` (e não é o caso
    `local_fallback`, que já tem sua mensagem), `message` vira "Localização
    aproximada — confira com atenção se o pin está no lugar certo.".
- Checkout (`recebimento/page.tsx`) e conta (`AccountAddressForm.tsx`): a
  caixa de aviso (`quoteMessage`/`quote.message`) agora aparece **também** no
  caminho de sucesso (`inServiceArea === true`), não só no de "fora da área".
  Removida a sufixo `(confirme o pin)` que só cobria o caso `local_fallback` —
  a caixa de mensagem agora cobre os dois casos (fallback e baixa precisão) de
  forma consistente.
- `DeliveryQuote`/`ValidationResult`/`QuotePreview` ganharam o campo
  `locationPrecision` (tipado, ainda não usado na UI além do `message` já
  computado no servidor — reservado pra uma eventual diferenciação visual
  futura, ex. ícone diferente).
- Verificado:
  - Local (`curl` no dev): endereço sem pin cai no `local_fallback` (sem
    `GOOGLE_MAPS_API_KEY` de servidor no `.env.local` e sem acesso à internet
    pro Nominatim no sandbox) → `locationPrecision: "low"`, mensagem exibida.
  - Produção (`curl`, antes deste deploy — baseline): pin com coordenada →
    `source: "google_maps"`, sem `locationPrecision`/`message` (comportamento
    anterior a este item; será `"high"`/sem mensagem depois do deploy).
  - `pnpm typecheck && pnpm lint && pnpm build` limpos.
- **Não verificado**: um caso real de `locationType` `APPROXIMATE`/
  `GEOMETRIC_CENTER` vindo do Google em produção (difícil de forçar sem um
  endereço ambíguo de verdade) — a lógica segue a documentação oficial do
  campo `geometry.location_type`, mas vale conferir com um endereço de fato
  impreciso depois do deploy.

---

## 12. Item 104 — Promoções (sessão seguinte, mesmo dia)

Implementadas as promoções por especificidade (decisões do §4): abrangência
loja toda / categorias / produtos; uma efetiva por produto (produto >
categoria > loja toda, sem acúmulo); arredondamento por unidade em centavos;
admin bloqueado de criar duas promoções do mesmo nível cobrindo o mesmo alvo
no mesmo período.

- Migration `supabase/migrations/20260904170000_promotions.sql`: tabelas
  `promotions` (`scope` check `store|category|products`, `discount_percent`
  numeric 0-100, `starts_at`/`ends_at` opcionais, `is_active`),
  `promotion_categories` e `promotion_products` (junções N:N, já que
  `products.category_id` é 1:1 — a "categoria" de uma promoção de escopo
  `category` é uma lista arbitrária de categorias, não a do produto). RLS no
  mesmo padrão de `categories`/`products` (`_public_read` com `is_active` +
  período; `_admin_manage` via `private.is_admin()`).
- `private.effective_price_cents(price_cents, category_id, product_id)`
  (nova função `stable`): resolve o desconto por especificidade entre
  promoções ativas e dentro do período (`now() between starts_at/ends_at`,
  null = sem limite), arredonda com `round()`. Empate no mesmo nível pega o
  maior desconto (defensivo — a validação do admin já devia impedir).
- `private.create_order` foi **redefinido por inteiro** nesta migration (só
  assim dá pra `create or replace function`) trocando as duas leituras de
  `v_product.price_cents` cru pelos dois loops por
  `private.effective_price_cents(...)`, guardado em `v_unit_price` novo. Todo
  o resto da função é idêntico ao original
  (`20260809144928_initial_schema.sql`) — só essa troca pontual. É a fonte de
  verdade: o preço gravado em `order_items.unit_price_cents` já sai correto.
- **Catálogo público** (`src/modules/catalog/`):
  - `promotions.ts` (novo): `resolveDiscountPercent` (mesma especificidade em
    TS) + `applyDiscount` (mesmo arredondamento) — usados só para **exibir**
    o preço com desconto no catálogo/carrinho/checkout; o pedido em si sempre
    recalcula pela função SQL.
  - `catalog-repository.ts`: `listActivePromotions()` (novo) faz um select em
    `promotions` (a RLS pública já filtra ativa+no período) com
    `promotion_categories`/`promotion_products` aninhados; chamado em paralelo
    com a query de produtos em `listPublicProducts` e
    `getPublicProductBySlugOrId`.
  - `mappers.ts::mapProduct` ganhou um 2º parâmetro opcional `promotions`;
    calcula `discountPercent` e devolve `price` já com desconto,
    `originalPrice`/`discountPercent` só quando há desconto ativo.
  - `types.ts::CatalogProduct` ganhou `originalPrice?`/`discountPercent?`.
    **Carrinho e checkout não precisaram mudar** — já consomem `product.price`
    (o preço final), então herdam o desconto automaticamente
    (`cart-store.ts`, `revalidate-cart.ts`, `persist-cart.ts`).
  - UI: `ProductCard.tsx`, `HomeCatalog.tsx` (destaques) e `ProdutoClient.tsx`
    (página do produto) ganharam o preço original riscado ao lado do preço
    com desconto, quando `originalPrice` existe.
- **Admin**:
  - `src/modules/admin/promotions.ts` (novo, mesmo padrão de `catalog.ts`):
    `listAdminPromotions`, `createAdminPromotion`, `updateAdminPromotion`,
    `deleteAdminPromotion`. Validação de forma (categoria/produto exige lista
    não vazia; fim > início) + `findOverlapConflict` (busca outras promoções
    ativas do mesmo `scope`, calcula sobreposição de período em JS tratando
    `null` como sem limite, e para `category`/`products` checa interseção de
    IDs) — mensagem de erro nomeia a promoção conflitante.
  - Rotas `src/app/api/v1/admin/promotions/{route.ts,[promotionId]/route.ts}`
    no padrão usual (zod no topo, `Result` → `httpStatusFor`).
  - `GET /api/v1/admin/catalog` (agregador que a página já usa) ganhou
    `promotions` na resposta — sem endpoint novo pro front buscar.
  - Aba **"Promoções"** nova em `admin/catalogo/page.tsx` (entre Categorias e
    Adicionais): mesmo padrão inline-form das outras abas (sem modal); campo
    de abrangência muda o formulário (mostra checklist de categorias ou de
    produtos); datas em `<input type="datetime-local">` convertidas para
    ISO só no submit.
- **Tipos gerados**: `src/types/database.ts` regenerado via
  `npx supabase gen types typescript --local` (supabase CLI não está
  instalado globalmente neste ambiente, mas roda via `npx`; sem isso o
  arquivo teria que ser editado à mão). Cuidado ao gerar: mandar só o stdout
  pro arquivo (`> arquivo.ts`, nunca `2>&1 > arquivo.ts`) — o CLI novo
  imprime "Connecting to db..." no stderr, que polui o arquivo se for
  redirecionado junto; e rodar `prettier --write` depois, porque a versão do
  CLI usada aqui (2.116) gera sem `;` (formatação antiga do arquivo tinha
  `;`, então um `git diff` cru fica gigante por reformatação se pular esse
  passo).
- Verificado de ponta a ponta no dev (Supabase local via Docker):
  - `private.effective_price_cents` direto por `psql`: loja 10% → categoria
    20% (vence) → produto 50% (vence) — especificidade correta; produto sem
    vínculo próprio ainda pega o desconto de categoria (não "vaza" pra loja
    toda incorretamente, só quando não há categoria nem produto aplicável).
  - Admin → aba Promoções → criou "Loja toda -10% no lançamento" → catálogo
    (`/`) mostrou `R$ 6,30` riscado `R$ 7,00` em todos os produtos, na home
    (destaques) e na grade principal — `curl /api/v1/catalog/products`
    confirmou `price`/`originalPrice`/`discountPercent` no JSON.
  - Carrinho já com 1 item antes da promoção existir: ao abrir `/carrinho`
    depois, o preço já apareceu atualizado (R$ 6,30) — o mecanismo de
    revalidação do carrinho (`revalidateCartAgainstCatalog`) absorveu o
    desconto sem precisar de código novo.
  - Tentativa de criar uma 2ª promoção "loja toda" ativa: bloqueada com
    `"Já existe uma promoção ativa para a loja toda no mesmo período
    (\"Loja toda -10% no lançamento\")."` — confirma a validação de
    sobreposição.
  - `pnpm typecheck && pnpm lint && pnpm build` limpos (0 erros; os 456
    warnings pré-existentes de `react-hooks/set-state-in-effect` não mudaram).
- **Não verificado**: um pedido completo (`private.create_order`) com uma
  promoção ativa — testei a função de preço isoladamente por `psql` e revisei
  a substituição na função, mas não finalizei um checkout de ponta a ponta
  pelo navegador nesta sessão para ver o total do pedido gravado. Vale
  conferir antes de anunciar a promoção do lançamento.

### Falta em 104
- Cupons (%/fixo/frete-grátis, sem acúmulo com promoção) e Controle
  Financeiro (taxa real do MP) — decisões já travadas no §4, não implementado.

---

## 13. Item 103 — Bloco 1: quadro de pedidos (sessão seguinte, mesmo dia)

Trocada a lista simples de `/admin/pedidos` por dois quadros vivos (Retirada
Delivery) + painel Agenda, seguindo as decisões travadas no §4. **Só
apresentação — nenhuma migration, nenhuma tabela nova, nenhuma mudança em
`private.transition_order_status`.** Os únicos ajustes de "banco" foram no
`SELECT` de listagem (coluna já existente).

- `src/lib/admin/order-columns.ts` (novo): `BOARD_COLUMNS` — as colunas de
  cada quadro, na ordem de exibição. As 3 primeiras (`received/confirmed/
  in_production`) são as mesmas nos dois quadros; a cauda muda por
  `deliveryMethod` (retirada: `ready_for_pickup → delivered`; delivery:
  `ready_for_delivery → out_for_delivery → delivered`). `nextAdminStatus`
  (já existia em `admin/types.ts`) já cobria essa bifurcação — não precisou
  de lógica nova de transição, só de agrupamento visual.
- **Régua de urgência** (`src/lib/admin/order-urgency.ts`): cor do card por
  minutos parado no status atual — `updated_at` do pedido como proxy (o
  projeto não tem "timestamp de entrada no status atual" dedicado; qualquer
  update no pedido reseta o relógio, não só transição de status — é uma
  aproximação, não um dado exato). ≥15 min = aviso (amarelo), ≥30 min =
  crítico (vermelho); pedidos `delivered`/`cancelled` nunca ficam urgentes.
  Esses limiares (15/30 min) são um chute razoável, não uma decisão do dono —
  ajustar se a cozinha achar sensível demais ou de menos.
- `updated_at` **adicionado ao `LIST_SELECT` e ao `AdminOrderListItem`**
  (`src/modules/admin/orders.ts`, `src/modules/admin/types.ts`) — única
  mudança em código de acesso a dados; a coluna já existia na tabela
  `orders`, só não era exposta na listagem.
- **Agenda** (decisão em aberto #3 do 103, resolvida como "manual" por
  padrão): mostra só pedidos `timing='scheduled' AND status='received'`,
  ordenados por `scheduled_for`. Não têm quadro nem posição por status — é
  uma lista simples (reaproveita `AdminOrderCard` existente) com um botão
  "Passar para produção" que chama o mesmo `nextAdminStatus`/transição usada
  nos quadros. Depois de avançar (deixa de ser `received`), o pedido some da
  Agenda e passa a aparecer no quadro certo (Retirada/Delivery) na coluna
  correspondente — **não existe** o comportamento "aparece sozinho no quadro
  no dia" cogitado como alternativa; ficou 100% manual. Fácil de trocar depois
  se o dono preferir o outro modo.
- **Drag-and-drop**: `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities`
  (novo, nenhuma lib de D&D existia no projeto — `react-beautiful-dnd` está
  descontinuado, `@dnd-kit` tem melhor suporte a React 19).
  `src/components/admin/AdminOrderKanbanCard.tsx` (`useDraggable`) +
  `AdminKanbanColumn.tsx` (`useDroppable`), só no quadro desktop — a lista
  mobile fica **fora** do `DndContext` (`draggable={false}` no card,
  sem grip) porque lá não há colunas pra soltar, só o botão "avançar".
  `onDragEnd` só aceita o drop se `over.id === nextAdminStatus(...)` — soltar
  em qualquer outra coluna (inclusive pra trás) não faz nada; o backend
  (`private.transition_order_status`) também rejeitaria, mas a checagem no
  cliente evita a chamada à toa.
  - Avanço **otimista**: tanto o botão quanto o drag atualizam um
    `optimisticStatus` local na hora do clique/drop (o card já "salta" pra
    coluna nova), e só reverte se a chamada falhar — sem isso, o delay da
    rede faria o card voltar à posição antiga por um instante antes de
    reaparecer no lugar certo.
- **Cancelar**: usa o `prompt()` do `AppDialogContext` (minLength 3, igual à
  validação do backend) — não tinha um jeito de coletar o motivo direto do
  quadro antes.
- **Indicador "ao vivo"**: `useAdminOrdersRealtime` já existia e já expunha
  `status` (`idle/connecting/subscribed/reconnecting/error`), mas a tela não
  usava — só o `version` (pra invalidar a query). Agora um ponto verde +
  "Ao vivo" quando `status === 'subscribed'`.
- **Som de pedido novo**: `src/lib/admin/notification-sound.ts` — dois tons
  curtos via Web Audio API (osciladores), sem arquivo de áudio pra
  servir/manter. Detecção de "é novo" compara o `Set` de IDs do fetch atual
  com o do fetch anterior **do mesmo `scope`** (guardado num `useRef` por
  scope) — ignora o primeiro carregamento de cada scope (não temos histórico
  antes disso) e não dispara ao trocar de aba Retirada↔Delivery (ambas usam
  `scope=all`, então compartilham a mesma entrada de cache/comparação — o som
  toca independente de qual quadro está aberto quando chega um pedido de
  qualquer tipo). Autoplay bloqueado pelo navegador falha em silêncio (try/
  catch) — o indicador visual "ao vivo" cobre esse caso.
- **"Ocultar entregues"**: checkbox simples que tira a coluna `delivered` da
  lista de colunas exibidas (desktop e mobile). Isso cobre "recolhível +
  filtro de foco" do jeito mais barato possível — **não é** um colapso por
  coluna individual (cada coluna dobrável separadamente); se o dono quiser
  esse nível de controle depois, dá pra evoluir.
- **Mobile** ("um fluxo por vez, em lista"): pills horizontais com o nome do
  status + contagem, e abaixo a lista plana só daquele status — mesmo padrão
  visual dos outros filtros pill do admin (`admin/catalogo`, filtro antigo de
  pedidos). O quadro completo lado a lado só aparece em `lg:` (1024px+); abaixo
  disso é sempre a visão de lista por status.
- **Fetch**: os quadros Retirada/Delivery usam `scope=all` (200 pedidos mais
  recentes, todos os status) e filtram por `deliveryMethod` no cliente — isso
  reaproveita o endpoint existente sem mudar nada no backend, ao custo de só
  "ver" os 200 mais recentes (aceitável: um dia de operação real não deve
  chegar perto disso, e pedidos `delivered` antigos saem da janela sozinhos
  conforme novos entram). A Agenda usa `scope=scheduled` (já existia).
- Verificado no dev (Supabase local, dados de teste inseridos via SQL direto
  — sem `psql` no ambiente, usado `docker exec ... psql`; removidos depois
  com `supabase db reset`):
  - Quadro Retirada com 5 colunas, contagens corretas, card no "Entregue" sem
    botão de avançar ("Concluído").
  - Troca de aba Delivery → colunas certas (6, com `ready_for_delivery`/
    `out_for_delivery`), urgência crítica (borda vermelha) num pedido com
    `updated_at` de 40 min atrás.
  - Botão "avançar": `received → confirmed → in_production`, cada clique
    validado contra o banco (`select status from orders` após cada ação).
  - Agenda: pedido agendado listado sozinho, "Passar para produção" o tirou
    da Agenda e o pôs em "Pedido confirmado" no quadro certo, com a etiqueta
    "Agendado para DD/MM, HH:mm" visível no card.
  - Cancelar: prompt pediu o motivo, `POST .../cancel` gravou
    `status=cancelled` e `cancellation_reason` no banco (conferido por SQL),
    card sumiu do quadro.
  - "Ocultar entregues": coluna `delivered`/pill some dos dois layouts.
  - Layout mobile (viewport 900px, abaixo do `lg`): pills + lista por status
    testados via clique de mouse (sem emulação de toque) — troca de status e
    avançar funcionaram.
  - `pnpm typecheck && pnpm lint && pnpm build` limpos.

### Não verificado
- **Arrastar e soltar de fato** (mouse ou toque) — três tentativas nesta
  sessão (`left_click_drag` da ferramenta, sensor `Mouse`/`TouchSensor` do
  dnd-kit, e até despachar `mousedown`/`mousemove`/`mouseup` via
  `dispatchEvent` manualmente) não fizeram o card mudar de coluna. Mesmo
  padrão do problema já visto na sessão do item 105-(c) (arrastar o pin do
  mapa): esta ferramenta de automação parece não conseguir sustentar um
  gesto de arraste até o fim de um jeito que bibliotecas JS de D&D
  reconheçam — não é um erro do app (sem exceptions no console, a mutação de
  avançar por botão usa exatamente o mesmo código de destino e funciona).
  **Precisa de um teste manual num tablet/mouse de verdade antes de confiar
  no arrastar em produção.**
- **Emulação de toque da ferramenta trava cliques simples** nesta sessão:
  qualquer `left_click` com o viewport no preset `mobile` (ou largura <768px,
  que ativa toque automaticamente) veio com timeout de 30s — a aba sempre se
  recuperava depois (screenshot seguinte funcionava normal), mas o clique em
  si nunca completava. Contornado testando o layout mobile numa largura
  intermediária (900px, abaixo do `lg` mas sem emulação de toque) — o layout
  e os cliques ali funcionaram. Vale um teste manual num tablet/celular real
  antes de confiar cegamente no fluxo mobile também.
- **Som de pedido novo**: implementado e sem erros, mas não há como um
  agente automatizado "ouvir" áudio — só a lógica de detecção de pedido novo
  foi revisada por código; nunca ouvi o bipe de fato.

### Observação lateral (fora do escopo desta sessão)
Durante os testes desta sessão, uma aba extra do navegador abriu sozinha
apontando para a **produção** (`cardapio.zeloconfeitaria.com.br`), numa tela
de identificação com captcha — não fui eu que abri, não interagi com ela
(não preencheria telefone nem resolveria o captcha de um ambiente de
produção a partir de testes automatizados) e voltei pra aba do
`localhost:3000`. Se isso não foi você mexendo na mesma janela, vale
investigar de onde veio.
