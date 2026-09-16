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
- Critério de saída original ("dois `stores` de teste respondendo em hosts
  diferentes") ainda não cumprido por completo — falta um segundo tenant real
  com domínio próprio para provar a resolução ponta a ponta; hoje só a Zelo
  tem `domain` preenchido.

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

**Não feito ainda:**
- Admin (`apps/admin/src/modules/admin/catalog/*`) continua sem scoping nos
  lookups de leitura por id — painel hoje só existe pra Zelo, então não é
  urgente, mas fica pendente.
- RLS do Supabase por `store_id` em todas as tabelas de negócio: **ainda não
  desenhado**. Investigado e descartado por ora: usar `x-store-id` (header
  arbitrário) dentro de policy do Postgres exigiria expor `request.headers`
  via PostgREST — o projeto hoje só usa esse tipo de contexto para JWT
  (`request.jwt.claim.*`, via RPC `security definer` para impersonar cliente).
  Extender esse mecanismo pra tenant merece uma decisão própria, não uma
  extensão apressada. Por ora, o isolamento é só a nível de aplicação
  (`.eq('store_id', ...)` explícito em cada query) — funciona porque só existe
  1 tenant real hoje, mas não é defesa em profundidade; precisa ser resolvido
  antes de um segundo tenant real entrar.
- Testar cada fluxo já em produção (checkout, pix automático, impressão
  térmica, push, agendamento) sob dois tenants simultâneos — só é possível
  depois que existir um segundo tenant de teste com dado próprio.
- Critério de saída original ("dois tenants operando em paralelo sem
  cross-talk de dados") continua não cumprido — falta cobrir toda a lista
  acima.

### Fase D — Branding dinâmico
- `ZeloSeal.tsx` e `opengraph-image.tsx` passam a ler `logo_url` do tenant (fallback
  genérico, não "Z" da Zelo).
- Tema: buscar `theme` do tenant no load e injetar como CSS variables (sem rebuild).
- Fontes: manter `next/font` para as opções suportadas, selecionadas por config do
  tenant (não é prático aceitar fonte arbitrária via upload).
- As ~24 strings "Zelo" em UI passam a usar `store.name`/`store.displayName`.
- Critério de saída: um tenant fictício com marca diferente, sem nenhuma referência
  a "Zelo" sobrevivendo.

### Fase E — App gestor
- `apps/gestor`: CRUD de tenants, ativação de features, visão de uso/armazenamento.
- Provisionamento de tenant novo (criar `store`, domínio, tema default, features
  default) fica centralizado aqui — não é um script manual.

#### Fase E — desenho (plano futuro, não parte do MVP)

Status: desenho registrado para referência futura. **Não iniciar antes de ter
1-2 clientes pagantes validados pelo processo manual da Fase 0/checklist de
provisionamento.** Construir isso antes é automatizar um processo cujo valor
ainda não foi comprovado.

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
