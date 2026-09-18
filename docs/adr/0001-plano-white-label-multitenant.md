# ADR-0001 — Transformar o app em white label multi-tenant

- Status: proposta (não iniciada)
- Data: 2026-09-16 · revisado 2026-09-16
- Contexto: hoje o app serve uma única empresa (Zelo Confeitaria). Outras confeitarias
  pediram para contratar o mesmo app. Este documento registra a decisão de arquitetura
  para virar multi-tenant e o plano de execução.

> 📌 **Revisão.** A Fase 0 (MVP manual, um deploy/banco por cliente) foi
> **descartada** nesta revisão: o custo operacional de repetir provisionamento
> manual por cliente piloto foi considerado maior do que o valor de adiar a
> engenharia real. O caminho agora é construir direto o banco único + deploy
> único (Fases A-D), com o cuidado adicional de fazer isso sem regredir a Zelo
> real em produção (ver "Plano de migração da Zelo real" abaixo). A Fase 0
> continua registrada no fim do documento como histórico da decisão.

## Decisão

- **Infra**: banco único compartilhado (Supabase atual), isolamento por `store_id` +
  Row Level Security — não banco por tenant, não instância por tenant. Justificativa:
  uma migration só serve todos os clientes, custo linear em dado e não em
  infraestrutura, e o app já roda em produção sobre essa base. Instância dedicada só
  se um cliente futuro exigir isolamento contratual/compliance forte — tratado como
  exceção, não como regra.
- **Gestão de tenants**: um app novo no monorepo (`apps/gestor`), reusando
  auth/Supabase já existentes, dono da tabela `tenants`/`stores` e do provisionamento
  (criar empresa, ver uso/armazenamento, ativar features).
- **Branding**: tema/logo/fontes deixam de ser arquivo estático e passam a ser dado
  por tenant, buscado em runtime (login / primeiro load) e injetado como CSS
  variables — sem rebuild por cliente. Mesmo padrão observado em outro app white
  label: a empresa configura o design system no backend e o client monta a tela a
  partir disso.
- **Features específicas**: cada funcionalidade não-core vira um flag por tenant,
  não um `if` de código por cliente.

## Situação atual (levantamento de acoplamento)

| Área | Onde está | Acoplamento |
|---|---|---|
| Cores/tema | [`packages/shared/src/styles/globals.css`](../../packages/shared/src/styles/globals.css) | CSS variables estáticas (`--primary`, `--caramel`...), sem tabela |
| Fontes | `layout.tsx` de cada app (client e admin, duplicado) | `next/font/google` hardcoded (Fraunces, Geist, Geist Mono) |
| Logo/selo | `apps/client/public/brand/*.png/jpg` | path fixo em `ZeloSeal.tsx` e `opengraph-image.tsx`, fallback "Z" hardcoded |
| Domínio | ~7 constantes (`layout.tsx`, `whatsapp-notify.ts`, `config/admin.ts`, `order-pix-charge.ts`, `osm.ts`) | `cardapio.zeloconfeitaria.com.br` / `admin@zeloconfeitaria.com.br` hardcoded |
| Nome da marca | ~24 arquivos de UI | string "Zelo" embutida, sem i18n/config central |
| Dados de loja | `supabase/migrations/20260809144928_initial_schema.sql`, tabela `stores` | já existe modelo rico (nome, contato, endereço, horários, delivery) |
| **Bloqueio real** | [`packages/shared/src/modules/catalog/store-repository.ts:22`](../../packages/shared/src/modules/catalog/store-repository.ts) (`getPublicStore`) | busca a loja com `.order('created_at').limit(1)` — assume uma única loja no banco inteiro |
| Resolução de tenant | não existe | não há `middleware.ts` resolvendo tenant por hostname (só `proxy.ts` de HTTPS/CSP) |

O ponto crítico não é a marca — é que **nenhuma query hoje é filtrada por `store_id`**.
Trocar tema/logo é reversível e rápido; introduzir tenant-scoping em catálogo,
pedidos, carrinho e admin é o trabalho de fato, com risco de regressão em produção
(pix automático, impressão térmica, agendamento).

## Plano de execução (ordem importa: migração da Zelo → schema → resolução → scoping → branding)

### Fase 0' — Migração da Zelo real para "tenant 1" (pré-requisito das Fases A-D)

Status: **implementado na branch `feat/tenant-store-id`, validado em local, ainda não aplicado em produção.**

Como banco e deploy vão ser únicos e compartilhados desde o início, a Zelo real
em produção passa a ser o primeiro tenant desse modelo — não um caso especial.
Isso precisa ser feito **antes** de qualquer cliente novo entrar, e com o mesmo
cuidado de qualquer migration em produção já praticado no projeto: checar
`supabase migration list --linked` antes de aplicar, nunca direto sem checagem.

- Adicionar `store_id` (FK para `stores`) em todas as tabelas de negócio hoje
  implicitamente ligadas à única loja (pedidos, carrinho, catálogo, estoque,
  agendamento, promoções, avaliações) — como coluna nullable primeiro.
- Backfill: preencher `store_id` de todas as linhas existentes com o id da loja
  Zelo (a única linha hoje em `stores`).
- Só depois do backfill confirmado, tornar `store_id` `NOT NULL` e criar as
  políticas RLS por `store_id` (isso já é o trabalho da Fase C, mas a Zelo real
  precisa estar coberta por ele desde a primeira versão, não depois).
- Testar cada fluxo já em produção (checkout, pix automático, impressão térmica,
  push, agendamento) **antes e depois** da migration, comparando comportamento —
  é a única forma de garantir que adicionar a coluna não regrediu nada.
- Fazer isso primeiro num ambiente de staging/branch do Supabase com uma cópia
  dos dados de produção, não direto na produção real.
- Critério de saída: a Zelo real continua funcionando 100% igual, agora com
  `store_id` preenchido em tudo — pré-condição para a Fase A poder introduzir a
  segunda loja sem tocar de novo nesse backfill.

### Fase A — Schema de tenant

Status: **implementado junto com a Fase 0' (mesma leva de migrations)**, já que
banco e deploy únicos tornam as duas mudanças de schema inseparáveis — ver nota
na revisão no topo do documento.

- Estendida `stores` com: `domain` (text, unique), `theme` (jsonb), `logo_url`
  (text), `font_config` (jsonb), `features` (jsonb) — migration
  `20260916190000_tenant_store_id_columns.sql`.
- Critério de saída: schema reproduzível do zero suportando N linhas em `stores`
  — confirmado via `pnpm db:reset` local.

### Fase B — Resolução de tenant por hostname

Status: **implementado na branch `feat/tenant-store-id`, validado em local.**

- **Correção de nomenclatura**: este projeto usa Next.js 16, que renomeou
  `middleware.ts` para `proxy.ts` (arquivo já existia, cuidando de HTTPS/CSP —
  ver `apps/client/src/proxy.ts` e `apps/admin/src/proxy.ts`). A resolução de
  tenant foi adicionada a esse arquivo existente, não um `middleware.ts` novo.
- Resolução implementada em
  `packages/shared/src/modules/tenant/resolve-store-id.ts`
  (`resolveStoreIdByHostname`): consulta `stores.domain = hostname`; sem match,
  cai no fallback da loja mais antiga (mesma lógica que `getPublicStore` já
  usava) — garante zero mudança de comportamento até tenants reais existirem.
  Cache em memória de 60s (mitiga custo de 1 query por request; o `proxy` desta
  versão do Next roda em runtime Node.js, não Edge, então a query é viável).
  Falha de rede/DB nunca derruba o request — cai no mesmo fallback, só loga.
- `proxy.ts` de ambos os apps propaga `x-store-id` via header de request. Ainda
  **sem nenhum consumidor** (isso é Fase C) — puramente aditivo.
- Migration `20260916190300_tenant_zelo_domain.sql` preenche
  `domain = 'cardapio.zeloconfeitaria.com.br'` para a Zelo real.
- Validado localmente: `curl` com `Host: localhost`, `Host: zelo.local.test`
  (domínio de teste seedado) e `Host: unknown.example.com` — as três respondem
  200, sem erro no proxy, confirmando que o match exato, o fallback e o host
  desconhecido não quebram o request.
- Estratégia de domínio (subdomínio vs. domínio próprio do cliente) ainda **não
  decidida** — decisão de produto que continua pendente antes da Fase E.

> ⚠️ **Correção à validação acima.** O parágrafo "Validado localmente: curl
> com Host: localhost, Host: zelo.local.test..." não provava o que dizia
> provar — só existia 1 `store` na época, então qualquer hostname (match,
> sem match, desconhecido) caía no mesmo resultado por coincidência
> (fallback = única loja existente). Ver validação de verdade, com dois
> tenants reais, na Fase C abaixo.
>
> **Achado ao tentar validar isso de verdade em navegador**: `next dev`
> (Turbopack) **ignora o header `Host`/`X-Forwarded-Host` do request** pra
> construir `request.nextUrl` — usa sempre o hostname com que o próprio
> processo foi iniciado (`localhost` por padrão), não o que o client
> mandou. É comportamento do dev server (`next-server.js`, variável interna
> `fetchHostname`, só existe nesse code path — nada a ver com o código deste
> repo). Ou seja: **testar resolução de tenant por hostname via `curl -H
> "Host: ..."` ou navegando pro domínio no navegador nunca funcionou de
> verdade em `next dev`** — sempre resolvia pro fallback, mascarado pelo
> fato de só existir 1 tenant. Em produção (Vercel) isso não se aplica (é
> outro runtime, não um processo `next dev`/`next start` com hostname fixo).
> Contorno usado pra testar localmente: subir `next dev --hostname
> <domínio-do-tenant>` (aceita qualquer hostname que resolva pro loopback,
> ex. `*.127.0.0.1.nip.io` — sem precisar editar `/etc/hosts`) — um processo
> por tenant, já que o Next só permite 1 `next dev` por diretório de projeto
> ao mesmo tempo (lock por diretório, testado sequencialmente). Configs
> temporárias ficaram em `.claude/launch.json` (`zelo-tenant-a`/
> `zelo-tenant-b`) pra reuso em validações futuras.
- Critério de saída original ("dois `stores` de teste respondendo em hosts
  diferentes") **cumprido nesta correção** — ver validação ponta a ponta na
  Fase C abaixo (login com dois tenants reais, via navegador).

### Fase C — Tenant-scoping das queries (o grosso do esforço)

Status: **iniciada na branch `feat/tenant-store-id` — primeira fatia feita e
validada; o grosso ainda não começou.** Descoberta importante ao começar: o
catálogo público inteiro (`cached-catalog.ts`) usa `unstable_cache` com chaves
de cache **fixas** (`['catalog:catalog']`, `['catalog:store']`, etc., sem
variar por loja) — ou seja, o problema não é só trocar `.limit(1)` por
`store_id`, é também impedir que o cache sirva o catálogo de um tenant pra
outro. Isso não estava previsto no desenho original desta fase.

**Feito nesta fatia** (baixo risco, só leitura de dado de loja):
- `getPublicStore(storeId?)` em `store-repository.ts` ganhou parâmetro
  opcional — com `storeId`, busca aquele tenant; sem, mantém o fallback antigo
  (retrocompatível, nenhum chamador existente quebra).
- `getRequestStoreId()` novo em `resolve-store-id.ts`, lê o `x-store-id` que o
  proxy (Fase B) já resolve, via `headers()` — só usável fora de
  `unstable_cache`.
- `cached-catalog.ts`: `cachedStore` passou a receber `storeId` como argumento
  (o `unstable_cache` já usa os argumentos da função como parte da chave —
  documentado no próprio Next —, então isso sozinho já separa o cache por
  tenant) e `getCachedPublicStore()` resolve o `storeId` do request antes de
  chamar a versão cacheada.
- Validado: typecheck de `apps/client`/`apps/admin` limpo; `curl` na rota
  `/api/v1/catalog/store` com três hosts diferentes (`localhost`,
  `zelo.local.test`, host desconhecido) — todas retornam a mesma loja (só
  existe uma), confirmando que a nova lógica não regride nada hoje.

**Segunda fatia, feita e validada — resto do catálogo público:**
- `storeId?` opcional adicionado em: `listPublicCategories`,
  `listPublicProducts`, `listOrderableProducts`, `getPublicProductBySlugOrId`,
  `searchPublicProducts`, `getPublicCatalog` (`catalog-repository.ts`);
  `listPublicPizzaSizes`, `listPublicPizzaAddons` (`pizza-repository.ts`);
  `getSatelliteLocation`, `listSatelliteProducts`, `listAllSatelliteProducts`
  (`satellite-repository.ts`); `getPublicBanners` (`banners-repository.ts`);
  `getPublicFaqItems` (`faq-repository.ts`); `getPublicPromoModalBanners`
  (`promo-modal-banners-repository.ts`). Todas retrocompatíveis (parâmetro
  opcional, filtro `.eq('store_id', storeId)` só aplicado quando informado).
- `cached-catalog.ts`: todas as funções cacheadas (`cachedCatalog`,
  `cachedProducts`, `cachedBanners`, `cachedFaqItems`,
  `cachedPromoModalBanners`, `cachedProductBySlugOrId`) passaram a receber
  `storeId` como argumento (chave de cache por tenant); os exports públicos
  (`getCachedPublic*`) resolvem o `storeId` do request antes de chamar a
  versão cacheada.
- **Exceção deliberada**: `listPublicBestSellingProductIds` continua sem
  `storeId` — depende da RPC `get_top_selling_products` (SQL, `security
  definer`), e mudar uma função de banco é uma categoria de risco diferente de
  adicionar `.eq()` numa query JS. Fica pra uma passada própria, junto com
  `create-order` (ver abaixo).
- Validado: typecheck dos dois apps limpo; `curl` em
  `/api/v1/catalog/products`, `/faq`, `/promo-modal-banners`, `/store`, na
  página `/produto/[slug]` e em `/pronta-entrega`, com `Host: localhost` e
  `Host: zelo.local.test` — todas 200, contagem de produtos confere com o
  seed (23), confirmando que o filtro por `store_id` não zerou nada por
  engano.

**Terceira fatia, feita e validada — escrita do admin (`getAdminStore` e
criação de catálogo).** Descoberta importante ao revisar: o admin cria
categorias, produtos, adicionais, banners, FAQ, cupons, promoções, modelos de
push e preços de pizza por tamanho **sem nunca gravar `store_id`** — como a
coluna ainda é nullable, isso não dava erro, mas criaria linhas "órfãs" que
desapareceriam silenciosamente do catálogo filtrado por tenant assim que isso
fosse pra produção (o admin da Zelo continuaria criando produto normalmente,
só que invisível no cardápio do cliente). Corrigido antes que isso chegasse a
ser um bug real:
- `requireRequestStoreId()` novo em `resolve-store-id.ts` — como
  `getRequestStoreId()`, mas devolve erro explícito em vez de `undefined`
  quando não resolve, porque aqui um `store_id` nulo na escrita é sempre
  errado (nunca é "modo sem tenant ainda", como era no caminho de leitura).
- Aplicado em todo `insert` de tabela raiz feito pelo admin:
  `categories` (`createAdminCategory`), `products` (`createAdminProduct`),
  `add_ons` (`createAdminAddon`), `pizza_addons` (`createAdminPizzaAddon`),
  `pizza_flavor_prices` (`upsertPizzaSizePrices`), `promo_banners`
  (`createBanner`), `promo_modal_banners` (`createPromoModalBanner`),
  `faq_items` (`createFaqItem`), `push_templates` (`createPushTemplate`),
  `coupons` (`createAdminCoupon`), `promotions` (`createAdminPromotion`).
- `getAdminStore`/`updateAdminStore`/`pauseStore`/`resumeStore`
  (`admin/catalog/store.ts`) passaram a resolver `storeId` do request em vez
  de sempre operar sobre o fallback de loja única.
- Não precisou de mudança: tabelas filhas (`promotion_categories`,
  `promotion_products`, `satellite_location_delivery_slots`, etc.) — herdam o
  tenant via FK pra tabela raiz, que já está correta.
- Validado: typecheck de `apps/admin`, `apps/client` e `packages/shared`
  limpo.

**Quarta fatia, feita e validada — `create-order`/checkout.** Tratado como
passada própria, exatamente como o ADR previa: leitura primeiro
(`create-order.ts`/`create-order-validation.ts` passaram a resolver `storeId`
do request e propagá-lo pra `validateScheduling`, `validatePaymentMethod`,
`resolveDeliveryFee`, `getSatelliteLocation`, `getPublicStore`,
`listPublicProducts`/`listSatelliteProducts` — todas já retrocompatíveis),
e a função SQL `private.create_order` só por último, com a menor mudança
possível:
- Migration nova (`20260916200000_create_order_store_id.sql`, não editei a
  migration anterior) — cópia exata da versão em produção
  (`20260916170000_fix_create_order_empty_pizza_addons.sql`) com só 3 linhas
  novas: declara `v_store_id uuid`, preenche a partir de `v_product.store_id`
  (já disponível de graça — `v_product` é `%rowtype`, então já reflete a
  coluna nova sem mudar nenhum `select`) durante o loop de validação que já
  existia, e adiciona `store_id` no `insert into public.orders`. Nenhuma linha
  de validação, preço, estoque ou cupom foi alterada.
- **Não precisou mudar a assinatura da RPC** (`create_order(payload jsonb)`
  continua igual) — `toRpcPayload`/`invokeCreateOrder` em `create-order-rpc.ts`
  não foram tocados. O tenant é derivado no banco a partir do produto, não
  precisa vir no payload da Fase C ainda.
- **Validado direto no Postgres local**, simulando um cliente autenticado via
  `set_config('request.jwt.claim.sub', ...)` (mesmo mecanismo que
  `transition_order_as_customer` já usa pra impersonação): criei um pedido
  padrão (pickup/cash) e um pedido de pizza com sabor + tamanho — **o mesmo
  caminho que causou a saída de produção em setembro** — e os dois criaram a
  ordem normalmente, com `orders.store_id` igual ao `store_id` do produto
  comprado.
- Não tocado: os lookups de preço em `previewCheckout` (`admin.from('products')`/
  `admin.from('add_ons')` por id direto) — ficam sem filtro de `store_id` por
  ora, risco baixo (só afeta preview, não a ordem real) e fica pra uma
  passada futura se necessário.

**Quinta fatia, feita e validada — leitura/edição do admin por id.** Os
`insert` do admin já tinham sido corrigidos na terceira fatia; faltava o
`list`/`get`/`update`/`archive` — hoje inofensivo (só existe 1 tenant), mas
sem isso um admin de outro tenant veria/editaria o catálogo inteiro da Zelo,
já que RLS ainda não existe:
- `products.ts`: `listAdminProducts`, `getAdminProduct`,
  `ensureUniqueSlug` (unicidade de slug agora é por tenant, não global),
  `updateAdminProduct`, `archiveAdminProduct`.
- `categories.ts`: `listAdminCategories`, `updateAdminCategory`,
  `archiveAdminCategory`.
- `addons.ts`: `listAdminAddons`, `updateAdminAddon`, `archiveAdminAddon`.
- `pizza.ts`: `listAdminPizzaSizes`, `listAdminPizzaAddons`,
  `updateAdminPizzaAddon`, `archiveAdminPizzaAddon`.
- Validado: typecheck de `apps/admin` limpo, `db:reset` local ok.
- **Gap conhecido, não corrigido**: `updateAdminProduct` faz o `update` de
  `products` já scopado por `store_id`, mas os efeitos em cascata
  (`product_add_ons`, `upsertPizzaSizePrices`) não verificam se o
  `productId` pertence de fato àquele tenant antes de gravar — hoje
  inofensivo (não há como um admin de outro tenant ter o id de um produto da
  Zelo pra explorar isso), mas é exatamente o tipo de lacuna que RLS
  resolveria de raiz. Registrado aqui pra não esquecer.
**Sexta fatia, feita e validada — mesma passada nos módulos restantes.**
Fechando a lista que tinha ficado pendente:
- `banners/crud.ts` (`listAdminBanners`, `updateBanner`, `deleteBanner`) e
  `banners/upload.ts` (`uploadBannerImage`) — inclusive o lookup por
  `bannerId` antes do upload, pra não deixar um admin de outro tenant subir
  imagem em cima de um banner que não é dele.
- Mesmo padrão em `promo-modal-banners/crud.ts` e `promo-modal-banners/upload.ts`
  (as duas variantes de imagem, vertical/horizontal).
- `faq/crud.ts` (`listAdminFaqItems`, `updateFaqItem`, `deleteFaqItem`).
- `push-templates/crud.ts` (`listPushTemplates`, `updatePushTemplate`,
  `cancelScheduledPushTemplate`, `deletePushTemplate`).
- `coupons.ts` (`listAdminCoupons`, `updateAdminCoupon`, `deleteAdminCoupon`).
- `promotions.ts` (`listAdminPromotions`, `getAdminPromotion`,
  `updateAdminPromotion`, `deleteAdminPromotion`) — incluindo
  `findOverlapConflict`, que antes checava sobreposição de promoções
  **entre tenants** (uma promoção da Zelo podia bloquear a de outro tenant
  por "sobreposição" indevida); agora recebe `storeId` e só compara dentro
  do mesmo tenant.
- Validado: typecheck de `apps/admin`/`apps/client`/`packages/shared`
  limpo, `db:reset` local ok.
- **Gap conhecido, não corrigido**: o código de cupom (`coupons.code`) tem
  unicidade **global** no banco (`unique constraint`), não por tenant — dois
  tenants não conseguiriam usar o mesmo código de cupom (ex.: "BEMVINDO10")
  ao mesmo tempo. Diferente do slug de produto (que era só uma checagem em
  JS, corrigida nesta fatia), esse é um constraint de banco — mudar exige
  migration (`unique (store_id, code)` em vez de `unique (code)`), fica pra
  quando o RLS/Fase C entrar de fato em produção com 2 tenants reais.
- Mesmo gap da fatia anterior (`product_add_ons`/pizza prices sem verificar
  posse do produto) também existe aqui em menor grau: `replacePromotionTargets`
  não verifica se `categoryIds`/`productIds` pertencem ao tenant da
  promoção — mesma categoria de lacuna, mesma decisão de esperar o RLS.

**Sétima fatia, feita e validada — RLS de verdade por `store_id` (admin).**
Correção a uma afirmação anterior deste documento: RLS **já existia** em
praticamente todas as tabelas de negócio desde o schema inicial (`enable row
level security` + `create policy` — ~120 ocorrências em
`supabase/migrations/*.sql`); o problema real, que esta fatia corrige, é que
nenhuma policy era *tenant-aware* — todas usavam `private.is_admin()`
(booleano global: "é admin de alguma loja") ou `private.current_customer_id()`
(dono da linha), nunca `store_id`.

Decisão de arquitetura (substitui o "investigado e descartado" da versão
anterior deste documento): **não foi preciso expor `request.headers`/
`x-store-id` via PostgREST**. Para todo contexto autenticado (admin, cliente)
já existe um mecanismo real e assinado — o JWT do Supabase Auth — e
`private.is_admin()`/`private.current_customer_id()` já faziam esse lookup via
`security definer`. Bastou estender o mesmo padrão:
- `private.current_admin_store_id()` — `store_id` do admin autenticado (lookup
  em `admin_profiles` por `auth.uid()`).
- `private.current_customer_store_id()` — idem para `customers`.
- `private.is_admin_of_store(store_id)` — `is_admin() and (current_admin_store_id()
  is null or current_admin_store_id() = store_id)`. `store_id` nulo no admin é
  tratado como "sem loja fixada" (reservado pro futuro `apps/gestor`
  multi-loja), não como "vê tudo por engano" — hoje todo admin real já tem
  `store_id` preenchido (backfill da Fase 0').
- Migration `20260917120000_tenant_rls_admin_scoping.sql`: todas as policies
  `*_admin_manage`/`*_admin_select`/`*_admin_update` das tabelas raiz com
  `store_id` direto (`stores`, `store_business_hours`,
  `store_blackout_periods`, `admin_profiles`, `customers`, `carts`, `orders`,
  `categories`, `products`, `add_ons`, `coupons`, `promotions`,
  `satellite_locations`, `push_templates`, `promo_banners`,
  `promo_modal_banners`, `faq_items`, `pizza_sizes`, `pizza_flavor_prices`,
  `pizza_addons`) passaram a exigir `private.is_admin_of_store(store_id)` em
  vez de só `private.is_admin()` — inclusive o bypass de admin dentro das
  policies de leitura pública (`*_public_read`), pra um admin não enxergar
  rascunho/arquivado de outro tenant.
- **Leitura pública anônima (sem JWT) continua sem predicado de `store_id`
  nesta fatia** — decisão deliberada, não esquecimento: é dado público por
  natureza (cada tenant expõe o próprio catálogo pra qualquer visitante do seu
  domínio) e o filtro já é feito em JS (fatias 1-2). Isolar isso em RLS também
  fica pra uma fatia própria se algum dia deixar de ser aceitável.
**Oitava fatia, feita e validada — RLS de verdade nas tabelas filhas.**
Fechou o gap que a sétima fatia tinha deixado registrado: `product_images`,
`product_add_ons`, `promotion_categories`, `promotion_products`,
`satellite_location_hours`, `satellite_location_delivery_slots`,
`push_template_sends`, `cart_items`, `cart_item_add_ons`,
`cart_item_pizza_addons`, `order_addresses`, `order_items`,
`order_item_add_ons`, `order_item_pizza_addons`, `order_status_history` — sem
`store_id` próprio — agora checam a posse do tenant via `exists (...)` até a
tabela raiz (`products`, `promotions`, `satellite_locations`, `push_templates`,
`carts`, `orders`) dentro da própria policy, em vez de só `private.is_admin()`
global.
- Migration `20260917130000_tenant_rls_child_tables.sql`. Mesmo padrão de
  `private.is_admin_of_store(<raiz>.store_id)` da fatia anterior, só que
  dentro do `exists` que já existia pra checar dono da linha (cliente) — o
  bypass de admin passou a fazer parte da mesma sub-query em vez de ser um
  `OR` solto no topo, porque só assim dá pra referenciar `store_id` da tabela
  raiz.
- **Decisão deliberada preservada**: a leitura pública (`*_public_read` de
  `product_images`/`product_add_ons`/`promotion_categories`/
  `promotion_products`) continua liberada pra item ativo de qualquer loja,
  igual antes — só o bypass de admin (ver rascunho/arquivado) passou a exigir
  o tenant certo. Não há isolamento de tenant na leitura pública nesta fatia,
  mesma decisão já registrada acima.
- Validado via `psql` simulando `request.jwt.claims`: criada uma segunda loja
  com produto rascunho (`is_active = false`) e um pedido próprio; como admin
  da Zelo, leitura da imagem/pedido rascunho da loja B retornou 0 linhas,
  `update`/`delete` afetaram 0 linhas; leitura de imagem de produto **ativo**
  da loja B continuou visível (esperado — decisão de leitura pública acima);
  controle: pedido da loja B manteve status `received` intacto após a
  tentativa de update. Typecheck de `apps/admin`, `apps/client` e
  `packages/shared` limpo.

**Gap conhecido, não corrigido ainda:**
- **Achado novo, fora do escopo de RLS**: `upsertCustomerFromPhone`
  (`packages/shared/src/modules/auth/otp.ts`) busca cliente existente só por
  `phone_e164`, sem filtrar por `store_id`, e o e-mail sintético do
  `auth.users` (`c<telefone>@customers.zelo.internal`) também não varia por
  tenant — ou seja, hoje o mesmo telefone vira o mesmo `customers`/`auth.users`
  em qualquer loja. Isso não é um bug de RLS (a policy `customers_select_own`
  já restringe cada admin à própria loja), é uma decisão de identidade ainda
  não tomada: conta de cliente é por tenant (precisa de
  `unique (store_id, phone_e164)` + e-mail sintético incluindo o tenant) ou
  compartilhada entre tenants por design? Registrado aqui pra decidir antes do
  segundo tenant real, não corrigido nesta fatia.
- Validado localmente via `psql` simulando `request.jwt.claims` (mesmo
  mecanismo das RPCs de impersonação): criada uma segunda loja de teste com
  categoria inativa; como admin da Zelo (`role authenticated`, `sub` do admin
  real), `select`/`update` nessa categoria retornaram 0 linhas (bloqueado),
  enquanto categorias da própria loja continuaram 100% visíveis/editáveis;
  leitura anônima (`role anon`) de categoria ativa continuou funcionando sem
  restrição, confirmando zero regressão no caminho público. Typecheck de
  `apps/admin`, `apps/client` e `packages/shared` limpo.

**Nona fatia, feita e validada — unicidade de `coupons.code` por tenant.**
`coupons_code_unique` era `unique (code)` global; virou `unique (store_id,
code)`. Só trocar a constraint não bastaria: `public.preview_coupon` e
`private.claim_coupon` buscavam o cupom só por `code`, então o código de um
tenant continuaria resolvendo pra qualquer outro via RPC. As duas ganharam
`p_store_id` e passaram a filtrar por ele.
- Migration `20260917140000_tenant_coupons_unique_and_scoped.sql`.
- `previewOrderCoupon` (`packages/shared/src/modules/orders/coupon-preview.ts`)
  resolve o `store_id` internamente via `requireRequestStoreId()` — não
  precisou mudar a API pros dois callers (checkout do cliente e preview de
  comanda manual do admin), os dois já rodam server-side atrás do proxy que
  resolve o header (Fase B).
- `private.create_order`: cópia exata da versão anterior
  (`20260916200000_create_order_store_id.sql`), só passando `v_store_id` (já
  resolvido do produto) pro `claim_coupon`.
- **Achado que precisou ser corrigido pra isso funcionar**:
  `private.create_manual_order` (comanda do admin) nunca gravava `store_id`
  em `orders` — sem isso não haveria `store_id` nenhum pra passar ao
  `claim_coupon` store-scoped. Resolvido com `private.current_admin_store_id()`
  (mesma função da fatia de RLS), já que quem cria comanda manual é sempre
  admin autenticado.
- **Achado à parte, não corrigido**: `private.create_manual_order` perdeu o
  suporte a cupom numa migration anterior (`20260915130000`, sem nenhum
  registro do motivo) — hoje comanda manual simplesmente não aceita cupom.
  Fora do escopo desta fatia reintroduzir isso.
- Validado via `psql`: cadastrado o mesmo código (`BEMVINDO10`) em duas lojas
  diferentes sem violar a constraint; `preview_coupon` com o `store_id` de
  cada loja resolveu o cupom certo (tipos de desconto diferentes por loja);
  `preview_coupon` com `store_id` errado ou nulo voltou `not_found`; fluxo
  completo de `public.create_order` com cupom aplicou o desconto certo e
  gravou `orders.store_id`; `public.create_manual_order` passou a gravar
  `orders.store_id` corretamente. Typecheck de `apps/admin`, `apps/client` e
  `packages/shared` limpo (com `database.ts` regenerado).

**Décima fatia, feita e validada — identidade de cliente por tenant.**
Decisão tomada (pergunta em aberto desde a nona fatia): desacoplar
`customers` de `auth.users`, permitindo N perfis de cliente por telefone —
um por loja.

**Bloqueio de plataforma descoberto ao investigar**: `auth.users.phone` e
`auth.users.email` têm `unique constraint` **global** no schema do GoTrue
(gerenciado pelo Supabase Auth, não por nós) — fisicamente não existe criar
dois `auth.users` com o mesmo telefone, por tenant ou não. Isso descarta de
saída a ideia de "login por tenant"; a identidade de LOGIN (telefone →
`auth.users`) continua sendo necessariamente compartilhada entre lojas. O
que passou a ser por tenant é o PERFIL de negócio.

- Migration `20260917150000_tenant_customer_identity_decouple.sql`:
  `customers` ganhou `user_id` (FK pra `auth.users`, a identidade
  compartilhada) separado de `id` (o perfil — dono de carrinho/pedidos/
  endereços daquela loja, `unique (user_id, store_id)`). A constraint antiga
  `customers_phone_e164_unique` (global) virou
  `unique (store_id, phone_e164)`.
- `private.current_customer_id()` (usada em ~15 policies de RLS sem precisar
  tocar em nenhuma delas) passou a resolver por dois caminhos: (1)
  impersonação de servidor — as RPCs `create_order_as_customer`/
  `transition_order_status_as_customer` continuam forçando
  `request.jwt.claim.sub` pro `customers.id` alvo diretamente, sem precisar
  editar essas funções sensíveis; (2) sessão real de cliente — JWT `sub` é
  `user_id`, resolve o perfil da loja atual via novo
  `private.request_store_id()`, que lê `x-store-id` do GUC
  `request.headers` que o PostgREST já expõe por request (confirmado via
  `curl` direto no REST local — não precisou de nenhuma config nova, ao
  contrário do que a primeira versão deste ADR cogitava).
- `createServerSupabaseClient()` (`packages/shared/src/lib/supabase/
  server.ts`) passou a propagar o header `x-store-id` do request atual pro
  client Supabase, pra esse GUC chegar populado em toda query de sessão de
  cliente real. Só esse client precisou mudar — o client de catálogo público
  (`createPublicSupabaseClient`) e o browser (auth/Realtime, nunca dados
  protegidos por RLS de cliente) ficaram de fora.
- `upsertCustomerFromPhone` (`otp.ts`) ganhou `storeId`: primeiro busca o
  perfil da loja atual por telefone; se não existir, busca/cria o
  `auth.users` (identidade compartilhada, como já fazia) e cria um perfil
  novo pra esta loja. Retorna `{ identity, userId }` — `userId` (a
  identidade real) vai pro `establishCustomerSession`, `identity.id` (o
  perfil da loja) é o que o resto do app usa. Mesmo ajuste em
  `otp-manual-approval.ts` (segundo caller).
- `SupabaseCustomerIdentityProvider.getCurrent()` (`customer-identity.ts`)
  passou a buscar por `user_id` + `store_id` em vez de `id`.
- `private.create_manual_order`: a busca de cliente existente por telefone
  (pra vincular a comanda a um cadastro) ganhou `and c.store_id = v_store_id`
  — sem isso, com dois tenants, o mesmo telefone podia casar com o perfil de
  outra loja (`select` sem `limit`/`order`, resultado indeterminado).
- `searchAdminCustomers`/`listAdminCustomers` (`apps/admin/.../customers.ts`)
  ganharam `.eq('store_id', ...)` — gap à parte encontrado nesta fatia: a
  tela "Clientes" do admin nunca tinha sido escopada por loja (RLS de
  `customers` já protegia contra acesso direto via PostgREST desde a fatia
  7, mas essas duas funções usam service role, que bypassa RLS).
- `ensureCustomerRecord` (`orders/customer.ts`): o branch de "criar perfil se
  não existir" já era código morto antes desta fatia — todo caller resolve a
  identidade via `resolveCustomerForCheckout()`, que só retorna perfil
  quando ele já existe (login por OTP já cria o perfil antes da sessão
  existir). Virou um simples "confirma que existe, falha alto se sumiu" —
  criar aqui exigiria `user_id`/`store_id` que a função não recebe, e não
  fazia sentido inventar isso pra um caminho inalcançável.
- Validado via `psql`, simulando `request.headers`/`request.jwt.claims`:
  mesmo `user_id` com perfil em duas lojas — `current_customer_id()` resolve
  o perfil certo conforme o `x-store-id`, e `null` sem header nenhum; RLS de
  `customers` só mostra o perfil da loja atual; caminho de impersonação
  (JWT `sub` forçado pro `customers.id`) continua funcionando sem tocar nas
  RPCs; `create_manual_order` com o mesmo telefone cadastrado em duas lojas
  vinculou a comanda ao perfil da loja certa. Confirmado via `curl` direto
  no REST local que PostgREST expõe `request.headers` como GUC sem config
  extra. Typecheck de `apps/admin`, `apps/client` e `packages/shared` limpo
  (com `database.ts` regenerado).

**Décima primeira fatia — validação ponta a ponta do login com dois tenants
reais, via navegador.** Primeira prova de verdade (não só `psql`/`curl`) de
que a Fase B (resolução por hostname) + Fase C (RLS e identidade por tenant)
funcionam juntas no app de verdade:
- Criada uma segunda loja de teste local (`Confeitaria B`) com domínio
  próprio. Contornado o achado registrado na Fase B acima (`next dev`
  ignora o `Host` do request) subindo dois processos `next dev` com
  `--hostname` fixo por tenant (`*.127.0.0.1.nip.io`, resolve pro loopback
  sem precisar editar `/etc/hosts`), um de cada vez (lock de diretório do
  Next não permite dois `next dev` simultâneos no mesmo projeto).
- **Tenant A** (Zelo): login por OTP com o telefone `+5511977776666` — código
  de debug exibido na tela (ambiente local), sessão aberta, perfil novo
  criado como "Cliente Tenant A" vinculado à loja A.
- **Tenant B** (Confeitaria B): login com o **mesmo telefone**, servidor
  trocado — o app tratou como conta nova (pediu nome de novo, não reconheceu
  o cadastro da loja A), perfil criado como "Cliente Tenant B" vinculado à
  loja B.
- Confirmado direto no banco depois dos dois logins:
  `customers.user_id` **igual** nos dois perfis (mesma identidade de login,
  `auth.users`, como esperado — telefone é global no GoTrue), mas
  `customers.id`/`store_id`/`name` **diferentes** — exatamente o
  comportamento desenhado na décima fatia, agora provado pelo fluxo real do
  usuário, não só por simulação de `request.jwt.claims`/`request.headers`.
- Ambiente de teste limpo depois (loja B, perfis e `auth.users` de teste
  removidos do banco local; domínio da Zelo revertido pro valor do seed).
  Ficaram só as duas configs `zelo-tenant-a`/`zelo-tenant-b` em
  `.claude/launch.json`, reutilizáveis pra validações futuras com dois
  tenants.

**Décima segunda fatia, feita e validada — cupom em `create_manual_order`,
reconciliado com a versão que chegou em paralelo pela `develop`.** A tarefa
separada sinalizada na fatia 9 (`task_beae3042`) já tinha virado
[PR #142](https://github.com/gerald0n/zelo-app-frontend/pull/142),
**merged em `develop`** (`20260917150000_manual_order_coupon_support.sql`)
antes desta fatia começar — reintroduzindo o mesmo bloco de cupom que
`private.create_order` já tinha, perdido sem explicação em
`20260915140000_manual_order_allow_pix_manual.sql`.

Duas migrations com o **mesmo timestamp** (`20260917150000`) mexendo na
**mesma função** por branches diferentes: a de `develop` (cupom, mas
`claim_coupon` de 5 parâmetros — sem `p_store_id`, porque `develop` não tem
nenhuma migration desta branch) e a desta branch (fatia 10, `store_id`/
identidade de cliente, mas sem cupom — regressão pré-existente). Se as duas
convivessem sem ajuste, uma delas apagaria a mudança da outra na hora de
aplicar em sequência.

Resolvido com `20260917160000_manual_order_coupon_support_store_scoped.sql`
— timestamp deliberadamente depois das duas, corpo é a junção: todo o bloco
de cupom do PR #142 (variáveis, leitura de `coupon_code`, gravação de
`coupon_id`/`coupon_code`/`coupon_discount_cents`), com a chamada a
`claim_coupon` já na assinatura de 6 parâmetros (`p_store_id` incluído,
exigida desde a fatia 9), mais `v_store_id`/busca de cliente por telefone
escopada por loja da fatia 10. Não precisou de merge de branch — a migration
nova é autocontida nesta branch e, quando `develop` entrar aqui (ou
vice-versa), a de timestamp maior simplesmente vence com o resultado
completo, sem perder nenhuma das duas mudanças.

Validado via `psql`: comanda manual com `coupon_code` válido aplicou 10% de
desconto, incrementou `coupons.uses_count` e gravou `orders.store_id`
corretamente. Typecheck de `apps/admin`, `apps/client` e `packages/shared`
limpo (com `database.ts` regenerado).

**Décima terceira fatia — checkout completo com pedido real, via navegador,
tenant A.** Reaproveitando a infra da fatia 11 (`zelo-tenant-a` em
`.claude/launch.json`): login por OTP, adicionar produto ao carrinho,
fluxo completo de checkout (retirada agendada, pagamento em dinheiro,
revisão) e `Fazer pedido` de verdade — pedido `#1001` criado, confirmado no
banco com `orders.store_id` = loja A e `customer_id` apontando pro perfil
certo (mesmo `user_id` da fatia 11). Prova que `private.create_order` (a
função mais sensível de todo o ADR, já causou uma saída de produção antes)
continua funcionando ponta a ponta depois de todas as mudanças de RLS/
tenant desta fase — não só via `psql` simulando `request.jwt.claims`, mas
pelo fluxo real do navegador. Ambiente de teste limpo depois (pedido,
cliente e `auth.users` de teste removidos; domínio da Zelo revertido).

**Não feito ainda:**
- RLS tenant-aware na leitura pública anônima (hoje deliberadamente fora de
  escopo, ver acima).
- Testar os fluxos que dependem de infra externa (pix automático via
  Mercado Pago, impressão térmica via WebUSB, push) sob dois tenants — não
  são testáveis neste ambiente (sandbox/hardware reais necessários);
  checkout com pedido real e agendamento já cobertos (fatia 13).
- Critério de saída original ("dois tenants operando em paralelo sem
  cross-talk de dados") **majoritariamente cumprido** por navegador: login,
  identidade de cliente e checkout completo com pedido real provados com
  dois/um tenant(s) real(is) (fatias 11 e 13); falta só pix automático/
  impressão térmica, que dependem de infra externa.

### Fase D — Branding dinâmico

Status: **iniciada na branch `feat/tenant-store-id` — primeira fatia feita e
validada.**

- `ZeloSeal.tsx` e `opengraph-image.tsx` passam a ler `logo_url` do tenant (fallback
  genérico, não "Z" da Zelo).
- Tema: buscar `theme` do tenant no load e injetar como CSS variables (sem rebuild).
- Fontes: manter `next/font` para as opções suportadas, selecionadas por config do
  tenant (não é prático aceitar fonte arbitrária via upload).
- As ~24 strings "Zelo" em UI passam a usar `store.name`/`store.displayName`.
- Critério de saída: um tenant fictício com marca diferente, sem nenhuma referência
  a "Zelo" sobrevivendo.

**Levantamento inicial (agente de exploração, antes de codar)**: as colunas
`theme`/`logo_url`/`font_config` já existem em `stores` desde a Fase A, mas
nada lê elas ainda. Achados relevantes:
- `packages/shared/src/styles/globals.css` tem ~20 CSS variables de cor
  (`--primary`, `--caramel`, etc., claro + `.dark`) — 100% estático, sem
  nenhum mecanismo de override em runtime hoje.
- `next/font/google` exige import estático resolvido em build-time —
  "fonte por tenant" só pode ser um seletor entre um conjunto pré-importado,
  nunca uma fonte arbitrária vinda do banco. Fica pra uma fatia própria.
- Contagem real de strings "Zelo" visíveis ao usuário: **~39 ocorrências em
  26 arquivos** (acima da estimativa de ~24) — título/metadata, JSX,
  notificações push, mensagens de WhatsApp, descrição do Pix. Fica pra
  fatias próprias, uma por área (metadata, UI, notificações).
- `opengraph-image.tsx` é `force-static` com `readFile` em top-level await
  (roda uma vez no build) — virar dinâmico por tenant tem custo de perf
  (perde geração estática) e precisa ser replicado em `twitter-image.tsx`
  (reexporta o mesmo componente mas repete os campos literais, exigência do
  Next). Decisão de fazer isso ou não fica pra quando o critério de saída
  (branding de um tenant fictício) for revisitado — por ora só o `<title>`/
  `og:site_name` ficaram dinâmicos (via `generateMetadata`), a imagem OG
  continua com a arte fixa da Zelo.

**Primeira fatia, feita e validada — tema de cor + `<title>`/metadata
dinâmicos.**
- `CatalogStore` (`packages/shared/src/modules/catalog/types.ts`) ganhou
  `theme: CatalogStoreTheme` (8 chaves opcionais: `primary`,
  `primaryForeground`, `secondary`, `secondaryForeground`, `accent`,
  `accentForeground`, `caramel`, `caramelForeground` — os tokens de marca,
  não a paleta inteira de UI) e `logoUrl: string | null`. `mapStore`
  atualizado; o SELECT já trazia as colunas (`select('*')`), só faltava o
  tipo/mapper.
- `packages/shared/src/modules/catalog/theme-style.ts` (novo) —
  `buildThemeStyle(theme)` gera um `:root{--primary:...}` só com as chaves
  presentes; `null` quando não há nenhuma override (evita `<style>` vazio).
  Compartilhado pelos dois apps (mesmo formato de tema).
- `apps/client/src/app/layout.tsx` e `apps/admin/src/app/layout.tsx`:
  `RootLayout` virou `async`, busca a loja via `getCachedPublicStore()`
  (já existia, cache de 60s por tenant, Fase C) e renderiza
  `{themeStyle && <style>{themeStyle}</style>}` — no client, como primeiro
  filho do `<body>`; no admin, dentro do `<head>` já existente (que só
  tinha o script anti-flash do tema claro/escuro). `export const metadata`
  virou `export async function generateMetadata()` nos dois apps: título,
  `applicationName`, `appleWebApp.title`, `openGraph.siteName` (client) e
  `title`/`description`/`applicationName` (admin) passam a usar
  `store.name`, com fallback pro texto fixo da Zelo quando a loja não
  resolve.
- Validado via `psql` + navegador: com `theme = '{}'` (padrão hoje), zero
  mudança visual — confirmado por screenshot idêntico ao anterior. Com
  `theme = {"primary": "oklch(0.5 0.2 250)", "primaryForeground": "..."}`
  gravado direto no banco, a cor primária mudou de bordô pra azul em todo o
  app (header, carrossel, botões, badge do carrinho) depois de um hard
  reload — o `<style>` já vinha correto no HTML puro (`curl` confirmou
  antes mesmo de testar no navegador); o primeiro teste no navegador
  "não mudou nada" foi o **service worker do PWA servindo HTML antigo em
  cache**, não um bug do código — resolvido limpando `caches`/registration
  do SW no console antes do reload (achado de ambiente de teste, não do
  app: cache de PWA precisa ser considerado em qualquer validação visual
  futura neste projeto). Typecheck de `apps/admin`, `apps/client` e
  `packages/shared` limpo.

**Segunda fatia, feita e validada — logo dinâmico e nome da loja no
header/nav.**
- `ZeloSeal.tsx` ganhou `logoUrl`/`alt`/`fallbackLetter` — usa
  `stores.logo_url` quando presente, mantém o selo estático da Zelo como
  fallback (não trocou pra um genérico ainda, ver "não feito" abaixo), e a
  letra de fallback do `onError` agora é a inicial do nome da loja, não
  sempre "Z".
- `apps/client/src/app/loja/page.tsx` (Server Component, já buscava a loja)
  passa `store.logoUrl`/`store.name` pro `ZeloSeal`.
- `HeroContent.tsx` (cabeçalho mobile) e `DesktopNavigation.tsx` (nav
  desktop), ambos Client Components sem acesso a dado de servidor, passaram
  a usar o hook já existente `useCatalogStore()` (`hooks/useStoreOpen.ts`,
  react-query, já usado por `useStoreOpen`/`useStoreHoursLabel`) — sem
  precisar inventar um novo mecanismo de fetch. "Zelo"/"Zelo Confeitaria"
  hardcoded viraram `storeName?.split(' ')` (primeira palavra vs. nome
  completo, mesmo padrão visual de antes — nome grande + resto em
  caixa-alta pequena).
- `StoreHeader.tsx` passa `storeName`/`logoUrl` pros dois pontos onde
  renderiza `HeroContent` (hero expandido e barra compacta).
- Validado via navegador (`docker exec` pra trocar `stores.name`/`logo_url`,
  esperando o cache de 60s expirar via `curl` em loop + limpando o cache do
  service worker do PWA de novo — mesmo cuidado de ambiente da fatia
  anterior): nome padrão da Zelo sem mudança nenhuma; com `name = 'Doce
  Aroma Confeitaria'`, o header mobile, o nav desktop (split "Doce" /
  "AROMA CONFEITARIA") e o `<title>` da aba mudaram juntos; com `logo_url`
  de teste (imagem externa), o selo mobile trocou pra essa imagem.
  Typecheck de `apps/client` limpo (não mexeu em `apps/admin`/`packages/
  shared` nesta fatia).

**Terceira fatia, feita e validada — strings "Zelo" restantes em UI,
notificações, WhatsApp e Pix.**
- Client (`apps/client`): `conta/page.tsx`, `conta/notificacoes/page.tsx`,
  `pedido-recebido/page.tsx`, `acompanhamento/[id]/_components/
  ReviewInvite.tsx`, `contexts/pwa-install/PwaInstallDialog.tsx`,
  `components/Testimonials.tsx` (ganhou prop `storeName`, default `'Zelo'`),
  `components/HomeCatalog.tsx` (passa `storeName` pro `Testimonials` e pro
  `MenuHeroCarousel`), `components/MenuHeroCarousel.tsx` (o slide de
  fallback "Celebre com a Zelo" virou função `fallbackSlides(storeName)`) —
  todos Client Components sem dado de servidor, mesmo padrão da fatia
  anterior: `useCatalogStore()` (react-query, hook já existente).
- `not-found.tsx` e `manifest.ts` (client) viraram `async`, buscando a loja
  via `getCachedPublicStore()` (Server Components/Route Handlers, têm acesso
  a dado de servidor — não precisam do hook).
- `global-error.tsx` (client): só suavizado o texto ("O app teve uma falha
  inesperada"), deliberadamente **sem** fetch — é o crash boundary de
  último recurso, teria que sobreviver mesmo se o próprio fetch da loja for
  a causa da falha.
- `error.tsx` (client, error boundary abaixo do layout): usa
  `useCatalogStore()` normalmente — ao contrário do `global-error.tsx`, o
  layout (e o fetch da loja) já rodou com sucesso antes desse boundary
  poder disparar.
- `offline/page.tsx` (client): mantido com "Zelo" fixo, comentário
  explicando a exceção — é o fallback do PWA servido pelo service worker
  sem rede, não dá pra buscar o nome da loja offline.
- Admin (`apps/admin`): criado `contexts/StoreBrandContext.tsx` — Context
  simples (`createContext<string>`) provido no `layout.tsx` (Server
  Component, resolve `store.name` via `getCachedPublicStore()`) e consumido
  por `useStoreBrandName()` em Client Components, incluindo a tela de login
  (roda antes da autenticação, sem acesso a endpoint de loja autenticado).
  Usado em `login/page.tsx`, `pedido/[id]/_components/OrderDetailMain.tsx`
  ("Retirada na Zelo"), `components/admin/AdminSidebar.tsx` (badge com a
  inicial + nome por extenso) e `components/admin/WhatsappNotifyButton.tsx`.
- `apps/admin/src/app/configuracoes/_sections/PushNotificationPreview.tsx`
  **deliberadamente não tocado** — arquivo pertencia a uma sessão paralela
  desenvolvendo a feature de Push Template no mesmo diretório de trabalho
  (`git status` mostrava `??`, não rastreado ainda).
- Notificações e mensageria (`packages/shared`, módulos sem contexto de
  request ativo — não dá pra usar `useCatalogStore()`/`headers()`):
  `notifications/send.ts` (push de mudança de status), `notifications/
  subscriptions.ts` (push de boas-vindas de ativação) e `payments/
  order-pix-charge.ts` (descrição da cobrança Pix, criação e regeneração)
  passaram a resolver `store_id` a partir da linha do pedido e chamar
  `getPublicStore(storeId)` direto (sem cache — código de background, não
  de request HTTP) em vez de depender de header/cache por request.
  `orders/create-order.ts` busca a loja uma vez no fluxo de criação do
  pedido e repassa `storeName` pro `createOrderPixCharge`.
  `admin/whatsapp-notify.ts` ganhou `storeName?: string` em
  `WhatsappOrderInfo`, com fallback `'Zelo'` quando ausente.
- Validado: typecheck limpo em `packages/shared`, `apps/admin` e
  `apps/client`. Navegador (`zelo-client`/`zelo-admin`, banco local com loja
  `"Zelo Confeitaria"`): `/pagina-que-nao-existe` (not-found) mostra
  título `"Página não encontrada · Zelo Confeitaria"` e "Zelo" no corpo;
  `/manifest.webmanifest` retorna `name`/`short_name` corretos; `/login`
  do admin mostra "Zelo" via `StoreBrandContext`. Fluxos que dependem de
  infra externa (push, Pix, WhatsApp) não foram testados ponta a ponta
  nesta fatia — só revisão de código + typecheck, consistente com a
  fatia 13 da Fase C (esses fluxos já não são testáveis neste ambiente).

**Quarta fatia, feita e validada — fallback de logo deixa de ser a marca
da Zelo.**
- `ZeloSeal.tsx`: sem `logoUrl` (tenant novo sem logo próprio), cai direto
  na inicial do nome sobre a cor primária — não tenta mais carregar
  `public/brand/zelo-selo.png` como default. Só usa `<img>` quando há um
  `logoUrl` de fato (do tenant), com o mesmo fallback pra inicial se a
  imagem falhar ao carregar.
- Isso exigia que a própria loja real da Zelo (produção e todos os seeds)
  tivesse `logo_url` explícito — senão essa mudança faria a Zelo perder o
  selo visualmente. Migration
  `20260918120000_tenant_zelo_logo_url_backfill.sql` grava
  `/brand/zelo-selo.png` em `stores.logo_url` só para o id fixo da Zelo
  (`a0000000-...0001`) e só onde ainda for `null` (idempotente). Os três
  seeds (`seed.sql`, `seed-operacional.sql`, `seed-operacional.prod.sql`)
  também passaram a inserir esse valor, pra um reset/reseed do zero já
  nascer com o selo certo — no seed de produção, de propósito **fora** do
  `on conflict do update set`, pra não sobrescrever um logo que o admin já
  tenha customizado numa eventual nova rodada do script.
- Validado: consultado `stores.logo_url` via REST do Supabase local
  (`http://192.168.200.206:54321`, projeto demo) — estava `null` antes
  (confirmando que a fatia anterior já teria quebrado o selo da Zelo sem
  esse backfill); aplicado o update, `/loja` renderizou o selo normalmente;
  zerado `logo_url` de novo temporariamente (esperando expirar o cache de
  60s) e confirmado visualmente que cai no avatar genérico "Z" sem tentar
  a imagem fixa; restaurado o valor original depois do teste. Typecheck de
  `apps/client` limpo.

**Não feito ainda:**
- `apps/admin/src/app/configuracoes/_sections/PushNotificationPreview.tsx`
  ainda tem "Zelo" fixo (ver acima — pertence a WIP de outra sessão, fica
  pra quando aquela feature for reconciliada).
- Domínio sintético `@zeloconfeitaria.com.br` usado como e-mail de pagador
  Pix quando o cliente não tem e-mail real (`order-pix-charge.ts`) — deixado
  como está: é um placeholder técnico interno pro Mercado Pago, não
  branding visível, e mudar pode ter implicação na conta MP.
- Seleção de fonte por tenant (`font_config`, fica pra fatia própria dado o
  import estático do `next/font`).
- `opengraph-image.tsx`/`twitter-image.tsx` dinâmicos por tenant (decisão
  de custo/benefício em aberto, ver levantamento acima).
- Critério de saída original ("um tenant fictício com marca diferente, sem
  nenhuma referência a 'Zelo' sobrevivendo") **quase cumprido**: tema,
  metadata, logo (com fallback genérico), header/nav, UI de conta/
  notificações/pedidos, push, WhatsApp e Pix já são dinâmicos; restam só a
  imagem OG estática, fonte por tenant e o preview de push da outra sessão.

### Fase E — App gestor
- `apps/gestor`: CRUD de tenants, ativação de features, visão de uso/armazenamento.
- Provisionamento de tenant novo (criar `store`, domínio, tema default, features
  default) fica centralizado aqui — não é um script manual.

Status: **exceção registrada ao gate abaixo** — decisão explícita do dono do
produto (conversa em 2026-09-18) de começar o CRUD mínimo de `stores` antes
da validação com 1-2 clientes pagantes, para destravar o desenho dos steps 2
(tema/logo) e 3 (feature flags) do wizard assim que essas fatias entrarem.
Sem alterar a avaliação de risco original abaixo — o app ainda não expõe o
step 4 (secrets), que continua bloqueado por infra de criptografia (ADR-0003).

**Primeira fatia, feita e validada — `apps/gestor` existe, com CRUD mínimo
de `stores`.**
- App novo no monorepo (`apps/gestor`, porta 3002 em dev), espelhando a
  estrutura do `apps/admin` (`tsconfig`/`next.config`/`eslint` quase
  idênticos) mas **sem** resolução de tenant por hostname no `proxy.ts` —
  `apps/gestor` não é servido por domínio de loja nenhuma, é a ferramenta
  que gerencia as lojas. Reaproveita 100% da camada de dados já
  compartilhada (`@zelo/shared`: `lib/supabase/*`, `lib/errors`, `lib/http`,
  `config/env`, `config/security-headers`, `components/ui/*`) — nenhum
  código novo nessa camada, só o app por cima.
- **Auth sem tabela nova**: um "admin de plataforma" é só uma linha de
  `admin_profiles` com `store_id = null`. Essa regra já existia —
  `private.is_admin_of_store()` (Fase C,
  `20260917120000_tenant_rls_admin_scoping.sql`) trata `store_id` nulo como
  cross-tenant desde que foi escrita, "reservado pro futuro apps/gestor
  multi-loja". `modules/gestor/auth.ts` (`requirePlatformAdmin()`) só
  confirma essa mesma condição no servidor (perfil ativo E `store_id is
  null`), espelhando `requireAdmin()` do `apps/admin` sem o pin em
  `ADMIN_EMAIL` (que é Zelo-específico, não serve pra multi-tenant).
  Login/logout via `POST`/`DELETE /api/v1/session`, mesmo padrão de cookies
  HttpOnly do `apps/admin`.
- **CRUD de `stores`**: listar (`/lojas`), criar (`/lojas/nova`) e editar
  (`/lojas/[id]`) via Server Components + Server Actions (sem API REST
  própria) — escopo mínimo do step 1 do wizard (nome, domínio, contato,
  endereço, lat/lng), sem tema/logo/feature flags/integrações ainda.
  `createStore`/`updateStore`/`getStore`/`listStores`
  (`modules/gestor/stores.ts`) sempre chamam `requirePlatformAdmin()` antes
  de tocar o banco, escrevem em `audit_logs` (mesma tabela global do admin,
  sem o efeito colateral de invalidar cache de catálogo — criar um tenant
  não é mudança de catálogo de um tenant existente) e usam
  `createAdminSupabaseClient()` (service role), não a sessão do usuário —
  mesmo padrão de `modules/admin/catalog/store.ts`.
- **Deliberadamente fora do escopo desta fatia** (v1 mínimo, não
  produção-pronta): sem captcha/rate-limit no login (ferramenta interna,
  poucos usuários — falta antes de expor publicamente), sem Sentry, sem
  CRUD de `admin_profiles` de plataforma pela própria UI (só via seed/SQL
  por enquanto), sem confirmação de exclusão de loja (não há delete na UI).
- Validado: typecheck e lint limpos. Navegador
  (`http://localhost:3002`, seed local): login com
  `gestor@zelo.local`/`gestor123` (perfil de plataforma criado via GoTrue
  Admin API + insert em `admin_profiles` no Supabase local, já que não há
  container Docker local nesta máquina — só um Supabase de dev
  compartilhado; `seed.sql` também ganhou esse mesmo usuário para quem
  rodar `db reset` puro) → lista mostra a Zelo real; criada uma loja de
  teste completa (nome, domínio, endereço, lat/lng) → apareceu na lista e
  no detalhe com todos os campos certos; editado o campo cidade → salvou e
  refletiu (`getStore`/`updateStore` revalida via redirect); loja de teste
  removida depois do teste.
- `.claude/launch.json` ganhou a entrada `zelo-gestor` (porta 3002) e
  `package.json` da raiz ganhou `dev:gestor`/`build:gestor`, mesmo padrão
  dos outros apps.

**Segunda fatia, feita e validada — step 2 do wizard (tema + logo).**
- `modules/gestor/stores.ts` ganhou `updateStoreBranding()`: grava
  `stores.logo_url` e as 8 chaves de `stores.theme` (as mesmas que
  `buildThemeStyle()` já lê nos apps de tenant desde a Fase D — nenhum
  formato novo). Uma chave de tema vazia no formulário limpa o override
  (não grava string vazia) e volta pro valor estático do CSS.
- UI: seção "Marca (tema e logo)" na página de detalhe da loja
  (`/lojas/[id]`), campos de texto livre (cor é qualquer valor CSS válido —
  `oklch(...)`, hex etc.) — sem color picker, sem preview ao vivo.
- **De propósito fora desta fatia**: upload de logo pro Supabase Storage
  (`logoUrl` continua sendo uma URL informada à mão, mesma limitação já
  registrada) e edição de `font_config` (a Fase D já registrou que fonte
  por tenant precisa de fatia própria, dado o import estático do
  `next/font`).
- Validado: typecheck/lint limpos. Navegador: gravado `theme.primary =
  "oklch(0.55 0.2 260)"` pela UI do gestor → confirmado no banco via REST;
  revertido pro estado original (`theme = {}`) depois do teste — não
  validado visualmente no `apps/client` nesta fatia (a fatia 1 da Fase D já
  provou que `buildThemeStyle()` aplica o `theme` gravado; aqui só a
  gravação pela nova UI era o que faltava confirmar).

**Step 3 (feature flags) deliberadamente NÃO iniciado**: `stores.features`
não tem nenhum consumidor no código hoje — nenhuma rota, componente ou
módulo lê essa coluna (a tabela "Flags levantados nesta conversa" mais
abaixo neste documento é uma lista de candidatos, não flags implementados).
Construir um toggle de UI pra um campo que nada lê seria um formulário que
mente sobre ter efeito. Isso só faz sentido depois que pelo menos um flag
real (ex.: `carousel_home`, que já tem UI de config no admin) for
efetivamente lido em algum caminho de código condicionado por tenant.

**Não feito ainda** (dos 4 steps do wizard):
- Step 1 completo: domínio automatizado via Vercel Domains API (hoje só
  grava o valor no banco, não provisiona nada).
- Step 2: upload de logo (Supabase Storage) e edição de `font_config`.
- Step 3: bloqueado não por infra, mas por não ter nenhum flag real
  consumido no código ainda (ver acima).
- Step 4: segue bloqueado por infra de secrets (ADR-0003) — nem começado.
- Acesso de demo pra prospect (tenant fictício provisionado, sem dar login
  real da Zelo) — ainda é processo manual, não fluxo no gestor.
- CRUD de administradores de plataforma pela própria UI do gestor (hoje só
  via seed/SQL direto).

#### Fase E — desenho (plano futuro, resto do wizard)

Status: desenho registrado para referência futura — cobre os steps 1
(domínio automatizado)/2/3/4 do wizard, ainda não implementados (ver acima
o que já existe). **Os steps 2 e 3 podem começar assim que priorizados**
(o CRUD que os destrava já existe); o **step 4 continua bloqueado** até
existir infra de secrets.

**Wizard de criação de tenant (dentro do `apps/gestor`)**, em 4 steps:

1. **Nome da empresa + domínio.**
   - Subdomínio próprio (`empresa.seudominio.com`): totalmente automatizável via
     Vercel Domains API — o wizard cria e aponta sem nenhuma ação do cliente.
   - Domínio do cliente (`cardapio.empresa.com.br`): a API adiciona o domínio no
     projeto Vercel, mas o **CNAME/A record precisa ser criado pelo cliente no
     provedor dele** — isso não é automatizável do nosso lado. O wizard pode
     automatizar a *verificação* (polling/webhook confirmando quando o DNS
     propagou), não a configuração em si.
2. **Design system**: logo (upload → Supabase Storage), cores, fontes — grava em
   `stores.theme`/`logo_url`/`font_config` (Fase A). Sem código novo além da UI,
   já que o schema e a leitura dinâmica são da Fase A/D.
3. **Feature flags**: toggle da lista em `stores.features` (Fase A). UI simples de
   checkbox por flag, já que o flag em si é lido do jsonb.
4. **Integrações (API keys de terceiros)** — o step mais sensível:
   - Twilio Verify, Google Maps, VAPID, Supabase (se algum dia o tenant trouxer o
     próprio projeto), possivelmente credenciais de deploy Vercel.
   - **Restrição de segurança que precisa vir antes deste step existir**: essas
     chaves não podem ser gravadas em texto puro em nenhuma tabela. Requer
     criptografia em repouso (ex.: Supabase Vault ou equivalente) e controle de
     acesso restrito a quem pode ler/rotacionar — é infraestrutura de secrets,
     não um campo de formulário comum. Tratar como pré-requisito bloqueante do
     step 4, não como detalhe de implementação.

**Acesso do cliente/prospect para avaliar o produto**: nunca dar login somente-
leitura para o admin real da Zelo (exporia pedidos, clientes e financeiro reais
de terceiros). Em vez disso, o wizard — ou, até ele existir, o checklist manual
da Fase 0 — provisiona um tenant de demonstração com dados fictícios, e é esse
login que o prospect recebe.

## Sistema de feature flags por tenant

Guardar como `stores.features jsonb` (chave → `{ enabled: boolean, config?: {...} }`).
Um jsonb é suficiente para o volume atual; migrar para tabela `store_feature_flags`
só se a lista crescer muito ou precisar de auditoria por flag.

Flags levantados nesta conversa:

| Flag | Comportamento quando desligado | Observação |
|---|---|---|
| `carousel_home` | Home sem carrossel de banners | já existe UI de config no admin (`_sections` de carrossel) |
| `otp_sms_verify` | Login do client só pede telefone, sem confirmação via Twilio Verify | requer `config` por tenant: Account SID/Service SID próprios, já que hoje é credencial única |
| `address_geocoding` | Inputs de endereço sem autocomplete/confirmação via Google Maps | idem: requer `config` com API key por tenant, ou key compartilhada com quota por tenant |

Flags específicos do Zelo hoje, candidatos a virar opcionais:

| Flag | Feature | Observação |
|---|---|---|
| `product_recommendation` | Sugestão "quem pediu isso também pediu" no carrinho (coocorrência de pedidos) | já em produção só para Zelo |
| `multi_city` | Atendimento em mais de uma cidade / `satellite_locations` | schema já suporta (`satellite_locations` com horários próprios) |
| `thermal_printer` | Impressão de comanda via WebUSB | pareamento da impressora é por dispositivo, não por tenant — o flag só controla se a UI oferece a opção |
| `auto_pix` | Pix automático via Mercado Pago (webhook + reconciliação) vs. só copia-e-cola manual | tenant sem conta MP própria usaria copia-e-cola |
| `push_notifications` | Notificações push do painel/PWA | depende de credenciais VAPID — hoje globais, precisam virar por tenant se o flag for opcional |
| `whatsapp_notify` | Aviso manual/automático via WhatsApp | hoje depende de BM próprio (ver nota de restrição de BM já registrada em memória) |
| `scheduling` | Agendamento de pedido com regras por categoria/antecedência mínima | feature relativamente nova, ainda não commitada em produção |
| `stock_control` | Controle de estoque no catálogo/admin | parte do escopo do doc 103, já em produção só para Zelo |
| `pizza_builder` | Construtor de pizza (sabores/tamanhos) | específico de cardápio de pizzaria — não serve toda confeitaria |
| `reviews` | Avaliações e depoimentos de clientes | doc 106, avaliar se todo tenant quer coletar isso |

Cada feature nova daqui para frente deveria nascer atrás de um flag em `features`,
não como código condicional por identidade de cliente.

## Riscos e observações

- O maior risco não é técnico, é de regressão: pix automático, impressão térmica e
  agendamento já estão em produção para a Zelo real. Qualquer scoping de query
  precisa de teste de não-regressão específico antes de mexer.
- Credenciais hoje globais (Twilio, Mercado Pago, Google Maps, VAPID) precisam de
  uma decisão de produto: cada tenant traz a própria conta, ou existe uma conta
  compartilhada com custo repassado? Isso afeta o design do `config` de cada flag.
- Fora de escopo deste ADR: cobrança/billing dos tenants, limites de uso/quota —
  ficam para um ADR seguinte quando o `apps/gestor` estiver definido.
- **Risco elevado por esta revisão**: sem a Fase 0 como buffer, não existe mais
  ambiente isolado testando o modelo antes de tocar produção. A Fase 0' (migração
  da Zelo real) e a Fase C (scoping) passam a ser o único lugar onde esse risco é
  absorvido — por isso ambas exigem staging com cópia de dados de produção e
  teste antes/depois de cada fluxo já em produção (pix automático, impressão
  térmica, agendamento, push), não só "rodar os testes automatizados existentes".
- Ver também [ADR-0003](0003-riscos-seguranca-secrets-tenant.md) para os riscos
  específicos de armazenar secrets de integração por tenant (bloqueante do step 4
  do wizard da Fase E).

## Histórico

### Fase 0 (descartada) — MVP de validação com clientes piloto

Registrado aqui apenas como histórico da decisão original, substituída pela
Fase 0' acima. A ideia era validar interesse comercial sem pagar o custo do
tenant-scoping: "fake multi-tenant" — mesmo código, um deploy Vercel por
cliente, um Supabase project por cliente, branding fixado em build-time via env
vars, flags simples (`carousel_home`, `otp_sms_verify`, `address_geocoding`)
também via env var, provisionamento manual sem `apps/gestor`. O checklist dessa
abordagem está em [ADR-0002](0002-checklist-provisionamento-mvp.md) — mantido
como referência caso o modelo de banco/deploy único se mostre inviável na
prática e seja necessário voltar a provisionar por cliente.

Motivo do descarte: o custo operacional de repetir esse provisionamento manual
a cada cliente piloto foi considerado maior do que o valor de adiar a
engenharia real — a decisão foi investir direto nas Fases A-D.
