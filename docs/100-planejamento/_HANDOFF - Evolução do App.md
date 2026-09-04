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
- Mapa: `DeliveryLeafletMap` = Leaflet + **tiles raster do OSM**, ~180px. Pin
  fixo no centro. **Ainda não trocado por Google** (item 105-c).
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
| **103 — Evolução do Painel Administrativo** | Kanban de pedidos, estoque, comanda manual, impressão térmica + melhorias menores (troco/obs/histórico/WhatsApp, catálogo, config, relatórios, push) | escrito; decisões travadas; falta 3 decisões (impressora, MEI/nota, agendados-automático) |
| **104 — Promoções, Cupons e Controle Financeiro** | Promoções por especificidade; cupons %/fixo/frete-grátis sem acúmulo; financeiro com taxa real do MP | escrito; **todas as decisões travadas** |
| **105 — Precisão do Cálculo de Frete** | Ligar Google Maps de verdade: Places Autocomplete, mapa Google com satélite, Routes API, tratar confiança, origem da loja por pin | **item (a) FEITO e em produção**; (b)–(f) pendentes. Ver §8. |
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
   **(b) autocomplete — ✅ em `develop`**; **(área de entrega por raio +
   bairro opcional + raio máx/grátis editáveis no admin — ✅ em `develop`,
   ver §9)**; (c) mapa Google + satélite + reverse geocode + mapa grande;
   (d) tratar confiança (rooftop/interpolado); (e) suavizar a taxa (faixas/km);
   (f) extrair componente único.
2. **104 — Promoções** (necessária para o lançamento: loja toda −10%).
3. **103 — Bloco 1 (quadros de pedidos)** e demais blocos.
4. **104 — Cupons + Financeiro** (após o Bloco 3; cupons de preferência após o
   login por SMS).
5. **106 — Avaliações** (Fase 1 pode entrar cedo por ser barata; Fase 2 após o
   login por SMS).
- A **repaginação visual** do admin (primitivos, tokens, skeletons — pendência da
  102) acontece junto, tela por tela.

---

## 7. Próximo passo

**Subir `develop` para produção** (b + área por raio, ver §8 e §9). No deploy:
1. `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` da Vercel com **Places API (New)** habilitada.
2. CSP em produção ganhou `places.googleapis.com` no `connect-src`.
3. `supabase db push` (ou o fluxo de migração usado) aplica
   `20260904120000_store_max_delivery_radius.sql` — coluna `max_delivery_radius_meters`
   (default 3000). Depois, ajustar o raio grátis:
   `UPDATE public.stores SET free_delivery_radius_meters = 1000;` (era 2 km).
   Raio máx e raio grátis agora se editam em **Ajustes → loja** no admin.

Depois, **item 105-(c) — mapa Google + satélite** no lugar do Leaflet: reverse
geocode ao arrastar o pin, mapa maior, e CSP para os domínios do Maps JS.

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

### Feito — item (b), em `develop` (commits `ec330d4` + o desta sessão)
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
- `maps.ts:getDrivingDistanceMeters` e `geo.ts:estimateRoadDistanceMeters` ficaram
  sem uso (guardados para o item c).
