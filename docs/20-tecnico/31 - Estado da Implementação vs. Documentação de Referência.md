# 31 - Estado da Implementação vs. Documentação de Referência

Levantamento feito em **2026-09-09** comparando o que está no código
(`apps/client`, `apps/admin`, `packages/shared`, `supabase/migrations`) com
os documentos de referência (`docs/10-funcional/`, `docs/20-tecnico/`).

**Por que este arquivo existe:** as pastas `10-funcional` e `20-tecnico`
descrevem majoritariamente o estado de **30/08/2026**. Desde então entraram
em produção ~15 migrations e vários módulos novos, documentados apenas nos
planos de evolução (`docs/100-planejamento/102`–`107` e `_HANDOFF`). Este
documento é a ponte: lista o que diverge e o que falta, com ponteiros para
o código. Ele **não substitui** a atualização dos docs de referência —
serve de checklist para ela.

Precedência (ver `docs/README.md`): em conflito, **vale o código + os
planos 102–107**; os docs de referência antigos estão atrás.

---

## 1. Resumo por documento de referência

| Documento                                                     | Situação                     | Observação                                                                                                                                        |
| ------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `10-funcional/05 - Ciclo de Vida do Pedido.md`                | ✅ reconciliado (2026-09-09) | Pix confirma por webhook; cancelamento de Pix pago → `refunded` (terminal).                                                                       |
| `10-funcional/07 - Carrinho e Checkout.md`                    | ✅ reconciliado (2026-09-09) | Etapa de cupom + tela de pagamento Pix; agenda por categoria; confirmação no mapa.                                                                |
| `10-funcional/08 - Entrega e Retirada.md`                     | ✅ reconciliado (2026-09-09) | Raio em linha reta a partir da loja, 3 faixas de taxa, bairro é rótulo opcional. Ver §2.8.                                                        |
| `10-funcional/09 - Pagamentos.md`                             | ✅ reconciliado (2026-09-09) | Pix = cobrança dinâmica Mercado Pago (webhook, tentativas, expiração, estorno). Ver §2.1.                                                         |
| `10-funcional/10 - Agendamento e Funcionamento.md`            | ✅ reconciliado (PR #98)     | Agendamento **derivado por categoria**; `stores.schedule_slot_times` removida; fuso da loja; carrinho misto bloqueado; pausa com prazo. Ver §2.9. |
| `10-funcional/11 - Painel Administrativo.md`                  | ✅ reconciliado (2026-09-09) | Reescrito: navegação, kanban, comanda manual, estoque, impressão, catálogo, avaliações, ajustes. Ver §2.10.                                       |
| `10-funcional/12 - Notificações e Tempo Real.md`              | ✅ reconciliado (2026-09-09) | Duas frentes de push (cliente / painel), debounce do realtime, `RefreshOnVisible`.                                                                |
| `20-tecnico/21 - Stack Tecnológica.md`                        | ✅ reconciliado (2026-09-09) | Monorepo, Next 16/React 19, integrações reais (Twilio/MP/Turnstile/Maps). Sem Meta.                                                               |
| `20-tecnico/22 - Acesso a Dados e Integrações.md`             | ✅ reconciliado (2026-09-09) | Mercado Pago, Turnstile, cron, cache do catálogo, bucket público, push duplo.                                                                     |
| `20-tecnico/23 - Autenticação e Segurança.md`                 | ✅ reconciliado (2026-09-09) | OTP em 2 modos, Turnstile/honeypot/rate limit, `getClaims()`, lista de segredos.                                                                  |
| `20-tecnico/24 - Banco de Dados.md`                           | ✅ reconciliado (2026-09-09) | Enums corrigidos + seção "Evolução do esquema" com tabelas/colunas/funções novas. Ver §3.                                                         |
| `20-tecnico/25 - Contratos de API.md`                         | ✅ reconciliado (2026-09-09) | Inventário de rotas autoritativo + seções corrigidas (OTP, catálogo, carrinho, webhooks, admin). Ver §4.                                          |
| `20-tecnico/26 - Estrutura de Pastas.md`                      | ✅ reconciliado (2026-09-09) | Monorepo pnpm; módulos planos.                                                                                                                    |
| `20-tecnico/29 - Deploy e Ambientes.md`                       | ✅ reconciliado (2026-09-09) | Tabela de env vars (obrigatórias/recomendadas) de `env.ts`. Sem Meta. Ver §5.                                                                     |
| `PRODUCT.md` / `00-produto-e-dominio/00 - Produto.md`         | ✅ reconciliado (2026-09-09) | Pix automático, raio em linha reta, agenda por categoria, features que saíram do "fora de escopo".                                                |
| `100-planejamento/100 - Roadmap.md` / `101 - Plano Mestre.md` | 🟡 histórico                 | As 14 fases foram concluídas; evolução pós-lançamento nos docs 102–107.                                                                           |
| `10-funcional/01`–`06`                                        | ✅ ok                        | Personas, jornadas, requisitos, regras de negócio, ciclo, catálogo — descrevem bem o núcleo.                                                      |

Legenda: ✅ ok / reconciliado · 🟡 pequenas lacunas · ⚠️ precisa de correção.

> **Rodada de reconciliação de 2026-09-09** (branch `docs/reconciliacao-referencia`):
> todos os docs ⚠️/🟡 da tabela original foram atualizados contra o código.
> As seções §2–§6 abaixo continuam como registro do delta e ponteiros.

---

## 2. Funcionalidades implementadas e não documentadas (na referência)

Cada bloco abaixo já tem um plano em `docs/100-planejamento/`. Aqui fica o
resumo do que precisa entrar nos docs de referência.

### 2.1 Pagamento Pix automático (Mercado Pago) — plano 104

- Cada pedido Pix gera uma **cobrança dinâmica** no Mercado Pago (Orders
  API): QR + copia-e-cola por pedido, `pix_expires_at` (~30 min).
- Confirmação chega por **webhook** (`POST /api/v1/webhooks/mercadopago`,
  assinatura validada, idempotente via `payment_events`).
- **Reconciliação**: `GET /api/v1/cron/reconcile-pix` varre pedidos Pix
  pendentes; agendado pelo **Supabase Cron** (`supabase/cron/reconcile-pix.sql`),
  protegido por `CRON_SECRET`.
- **Tentativas**: código expirado → cliente gera outro (`orders.pix_attempt`,
  entra na `X-Idempotency-Key`).
- **Estorno**: admin cancela pedido Pix pago → `POST /v1/orders/{id}/refund`
  no MP; `payment_status` ganhou o valor **`refunded`**; guarda de terminal
  em `transition_order_status`.
- **Financeiro**: na confirmação, 1 chamada extra ao MP grava
  `orders.mp_payment_id / payment_fee_cents / payment_net_cents`.
  `stores.payment_fee_estimate_bps` (padrão 99 = 0,99%) estima onde não há
  número real. Relatório em `GET /api/v1/admin/reports?kind=financial`.
- Migrations: `20260903120000_pix_mercadopago` … `20260903160000`,
  `20260908150000_payment_financials`.
- Módulos: `packages/shared/src/modules/payments/` (mercadopago,
  order-pix-*), `apps/client/.../checkout/pix/`.

### 2.2 OTP do cliente — o que a doc 23 não diz

- Fluxo real em `packages/shared/src/modules/auth/otp.ts` +
  `otp-delivery.ts` + `modules/notifications/twilio-verify.ts`.
- **Dois modos**: com `TWILIO_VERIFY_*` configurado, a Twilio gera e valida
  o código; sem ele, **o app gera** um código de 6 dígitos, guarda o
  **HMAC-SHA256** em `customer_otp_challenges.code_hash` (segredo
  `OTP_HASH_SECRET`, mín. 16 chars) e entrega por SMS/debug.
- Proteções além do rate limit: **Cloudflare Turnstile**
  (`modules/security/turnstile.ts`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY` +
  `TURNSTILE_SECRET_KEY`), **honeypot** (`rejectHoneypot`), **rate limit
  atômico por IP** via RPC `public.consume_rate_limit` (tabela
  `http_rate_limits`).
- TTL do código 10 min, cooldown 45 s, 5 envios/hora, 5 tentativas.

### 2.3 Promoções — plano 104

- Tabelas `promotions` (+ `promotion_categories`, `promotion_products`).
  Escopo `store` / `category` / `products`, `discount_percent`, período
  opcional, `is_active`.
- `private.effective_price_cents(...)` resolve por especificidade
  (produto > categoria > loja; nunca acumula) dentro de `create_order` e
  `create_manual_order`. Catálogo público espelha em TS
  (`src/modules/catalog/promotions.ts`).
- Admin: aba **Promoções** em `/catalogo`.
- Migration: `20260904170000_promotions`.

### 2.4 Cupons — plano 104

- Tabela `coupons` (`code` único uppercase, `discount_type` =
  percent/fixed/free_shipping, `max_uses`, `uses_count`, período).
- `orders` ganhou `coupon_id / coupon_code / coupon_discount_cents`.
- `private.claim_coupon(...)` valida e incrementa uso na mesma transação
  do pedido; cancelamento devolve. Não acumula com promoção.
- `public.preview_coupon(...)` (read-only) para o checkout.
- Rotas: `POST /api/v1/coupons/preview` (cliente),
  `GET/POST/PATCH/DELETE /api/v1/admin/coupons`.
- Front: campo de cupom na revisão do checkout e na comanda manual.
- Migration: `20260908140000_coupons`.

### 2.5 Estoque básico — plano 103

- `products.stock_quantity` (integer nullable; NULL = ilimitado).
- `create_order` checa e decrementa atomicamente; ao chegar a 0,
  `is_available` vira `false`. Cancelamento devolve e reativa.
- Migration: `20260904180000_product_stock_quantity`.

### 2.6 Comanda manual / pedido avulso — plano 103

- `orders.customer_id` virou **nullable**; `guest_name` / `guest_phone_e164`
  para cliente sem conta. Constraint `orders_customer_or_guest`.
- `private.create_manual_order(payload)` — cópia adaptada de `create_order`:
  guarda de admin, resolve cliente por telefone ou grava guest,
  `payment_method` restrito a cash/card, endereço sem geocodificação (taxa
  digitada pelo admin), pode entrar `payment_status = 'confirmed'`.
- Front: `apps/admin/src/app/pedidos/novo/`.
- Migration: `20260904190000_manual_orders`.

### 2.7 Avaliações e depoimentos — plano 106

- Enum `public.review_status` (pending/approved/hidden) + tabela
  `public.order_reviews` (1 por pedido, `rating` 1–5, `comment` ≤1000,
  `is_featured`, `customer_display_name` snapshot).
- RLS: leitura pública só de `approved && is_featured`.
- Cliente: card "Como foi o seu pedido?" no acompanhamento ao entrar em
  `delivered` + push-convite. `POST /api/v1/orders/{id}/review`.
- Vitrine: bloco de depoimentos na home e na `/loja`.
- Admin: aba **Avaliações** (sidebar + bottom nav, badge de pendentes),
  `GET/PATCH /api/v1/admin/reviews`.
- Migration: `20260909120000_order_reviews`.
- **Fase 2 — avaliação por produto** (`product_reviews`, migration
  `20260909130000`): nota 1–5 + comentário, uma por cliente×produto, só quem
  tem pedido **entregue** com aquele produto. Tudo entra `pending`. Cliente:
  `POST /api/v1/catalog/products/:id/reviews` (envio) e
  `GET .../reviews` (lista aprovada), seção de avaliações + estrela nos
  cards. Admin: aba Avaliações → sub-lista de produto,
  `GET/PATCH /api/v1/admin/product-reviews`, auditoria
  `product_review.moderate` (rótulo pt-BR).

### 2.8 Frete e mapas — plano 105

- **Leaflet/OSM removidos.** 100% Google Maps Platform (Places New,
  Geocoding, Maps JS API em modo satélite). Módulos em
  `src/modules/delivery/`.
- Área de entrega = **raio em linha reta** da loja: grátis até
  `free_delivery_radius_meters`, taxa fixa até `max_delivery_radius_meters`,
  acima → só retirada. Ambos editáveis no admin.
- `DeliveryQuote.locationPrecision` = `high` | `low`; checkout sempre exige
  "Confirmar localização no mapa" para entrega.
- Migration: `20260904120000_store_max_delivery_radius`.

### 2.9 Agendamento derivado por categoria + pausa da loja

- **Reescrito em 09/09/2026 (PR #98).** O agendamento deixou de usar
  `stores.schedule_slot_times` (removida na migração
  `20260909140000_category_scheduling_rules`, junto com a função
  `is_hhmm_list`). Os dias e horários do checkout são **derivados** da janela
  de funcionamento do dia + de **regras por categoria** — colunas novas em
  `public.categories`: `scheduling_allow_same_day`,
  `scheduling_same_day_lead_minutes`, `scheduling_weekday_earliest`,
  `scheduling_weekend_earliest`, `scheduling_slot_interval_minutes`.
  Editáveis em Catálogo → Categorias.
- Default ("cookie"): mesmo dia ok, agenda de hoje abre 120 min antes do
  expediente, sem piso, intervalo 30 min. Pudins (semeado por nome): nunca
  no mesmo dia, piso 17:00 semana / 10:00 fim de semana, intervalo 1 h.
- A antiga **regra das 17h** (`calcFirstScheduleDate`) foi **removida**.
- **Fuso da loja em toda a agenda:**
  `packages/shared/src/modules/scheduling/tz.ts` (`storeWallClock` /
  `storeLocalToInstant`); `catalog/store-hours.ts` também virou TZ-aware.
  Fonte: `stores.timezone`.
- `canPlaceImmediateOrder`: "Agora" só vale dentro da janela real de hoje,
  mesmo com `is_open_override = true` (corrige o botão clicável antes de abrir).
- **Carrinho misto** (categorias com regras diferentes) é bloqueado: aviso no
  checkout, botão travado, e `create-order-validation.ts` recusa.
- `GET /api/v1/checkout/options` virou **`POST { productIds }`**; resposta
  ganhou `scheduling.{mixedCart, allowSameDay, hoursLabel}`.
- Admin: seção global "Horários de agendamento" removida de `/configuracoes`.
- `stores.paused_until` / `pause_reason` — pausa "até tal hora"; a regra
  "loja aberta agora" checa `paused_until > now()` antes de
  `is_open_override` e do horário. Migration `20260908120000_store_pause`.

### 2.10 Painel administrativo — plano 103 / 107

- **Kanban** reescrito (2026-09-06): duas raias (`pickup` / `delivery`),
  drag-and-drop **feito à mão** (sem lib), avanço de um passo, coluna
  sintética "Agendados". `apps/admin/src/app/pedidos/`.
- **Impressão térmica** via WebUSB (EPSON TM-T20X, validada em hardware).
  `stores.cnpj` no cabeçalho do comprovante. Migration
  `20260905120000_store_cnpj`.
- **Fila de impressão resiliente** da comanda de cozinha
  (`lib/admin/print-queue.ts`): jobs persistidos no `localStorage`, imprimem
  um a um quando a impressora volta. `orders.kitchen_printed_at` (migration
  `20260909150000`) é a fonte da verdade, marcada só após a impressão
  confirmada. Reabrir o painel busca `GET /api/v1/admin/orders/unprinted` e
  reenfileira; `POST /api/v1/admin/orders/:id/mark-printed`.
- **Web Push do painel**: tabela `admin_push_subscriptions` (separada da do
  cliente), service worker próprio. Toggle em Ajustes → Dispositivos. Rotas
  `/api/v1/admin/push/*`. Migration `20260908130000_admin_push_subscriptions`.
  ⚠️ O par VAPID (`NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` /
  `VAPID_SUBJECT`) tem que ser **o mesmo** em `zelo-app` e `zelo-admin`:
  "novo pedido" é enviado pelo client e "status mudou" pelo admin, cada um
  mirando as assinaturas do outro. Par distinto → 401/403 silencioso. Ver
  plano 103 §Web Push.
- **Dashboard "Visão geral"** (`apps/admin/src/app/page.tsx`) absorveu
  `/relatorios` (rota removida, 404): seções Operação + Financeiro presas a
  um seletor de período. `GET /api/v1/admin/reports?kind=operations|financial`.
- **Catálogo**: "acabou num toque", duplicar produto, várias fotos,
  reordenar produtos e categorias. `POST /api/v1/admin/products/:id/duplicate`,
  `.../images`, `.../archive`.
- **Auditoria** com filtros; `GET /api/v1/admin/audit-logs`.
- Preferências de UI persistidas (`useUiPref`) e script anti-flash de tema
  no `<head>` — plano 107.

### 2.11 Redesign visual

- Vale o **plano 102** (editorial minimalista): Fraunces + Nunito, tokens
  OKLCH, `--radius` 0.5rem (`packages/shared/src/styles/globals.css`),
  navbar `liquid-glass`.
- O redesign **"Vidro Quente"** (commit `4a85b11`, 01/09) foi **revertido**
  (`e44e1d2`) — **não está no código**. Ignorar referências a ele.

---

## 3. Delta do doc 24 (Banco de Dados)

**Tabelas novas** (não citadas no doc 24):

| Tabela                                                     | Origem                                    | Papel                                               |
| ---------------------------------------------------------- | ----------------------------------------- | --------------------------------------------------- |
| `customer_otp_challenges`                                  | `20260819120000_production_auth`          | desafios OTP (hash, tentativas, expiração)          |
| `http_rate_limits`                                         | `20260827210000_security_hardening`       | rate limit por IP (bucket)                          |
| `promotions`, `promotion_categories`, `promotion_products` | `20260904170000_promotions`               | descontos por escopo                                |
| `coupons`                                                  | `20260908140000_coupons`                  | cupons de desconto                                  |
| `payment_events`                                           | `20260903120000_pix_mercadopago`          | log/idempotência de webhooks MP                     |
| `admin_push_subscriptions`                                 | `20260908130000_admin_push_subscriptions` | Web Push do painel                                  |
| `order_reviews`                                            | `20260909120000_order_reviews`            | avaliação do pedido / depoimentos                   |
| `product_reviews`                                          | `20260909130000_product_reviews`          | avaliação por produto (nota + comentário, moderada) |
| `idempotency_keys`                                         | segurança/pagamentos                      | cache de resposta por chave de idempotência         |

**Colunas novas em `categories`** (`20260909140000_category_scheduling_rules`,
PR #98): `scheduling_allow_same_day`, `scheduling_same_day_lead_minutes`,
`scheduling_weekday_earliest`, `scheduling_weekend_earliest`,
`scheduling_slot_interval_minutes` — regras de agendamento por categoria.

**Enums:**

- `payment_status` ganhou **`refunded`** (`20260903140000_pix_refund`).
- Novo enum `review_status` (`pending` / `approved` / `hidden`).

**Colunas novas em `stores`:** `accepts_pix/cash/card`,
`max_delivery_radius_meters`, `payment_fee_estimate_bps`, `cnpj`,
`paused_until`, `pause_reason`. (`schedule_slot_times[]` existiu entre
`20260902123000` e `20260909140000`, quando foi **removida** — ver §2.9. O
doc 24 ainda cita `pix_copy_paste`, que só é usado como fallback.)

**Colunas novas em `orders`:** `mp_order_id`, `mp_payment_id`,
`pix_qr_code`, `pix_qr_code_base64`, `pix_ticket_url`, `pix_expires_at`,
`paid_at`, `pix_attempt`, `payment_fee_cents`, `payment_net_cents`,
`coupon_id`, `coupon_code`, `coupon_discount_cents`, `guest_name`,
`guest_phone_e164`, `kitchen_printed_at` (fila de impressão da cozinha,
`20260909150000`). `customer_id` passou a **nullable**. O check
`orders_total_consistent` agora desconta o cupom.

**Colunas novas em outras tabelas:** `products.stock_quantity`,
`admin_profiles.must_set_password`.

**Funções novas:** `private.create_manual_order`,
`private.effective_price_cents`, `private.claim_coupon`,
`public.preview_coupon`, `public.consume_rate_limit`,
`private.*` de estorno Pix. `create_order` e `transition_order_status`
foram reescritas várias vezes (estoque, promoção, cupom, financeiro).

**Storage:** bucket `product-images` passou a **público**
(`20260831130000_product_images_public_bucket`).

---

## 4. Delta do doc 25 (Contratos de API)

Rotas reais (raiz `apps/*/src/app/api/v1`):

**Cliente — corrigir no doc 25:**

- `POST /api/v1/auth/otp/send` (doc diz `/request`)
- `POST /api/v1/auth/otp/verify`
- `GET /api/v1/auth/me`, `.../auth/session`
- `GET/PUT/DELETE /api/v1/cart`, `POST /api/v1/cart/reconcile`
- `GET /api/v1/catalog/products`, `GET /api/v1/catalog/store`
- `POST /api/v1/checkout/preview`
- `POST /api/v1/checkout/options` _(era `GET`; agora recebe `{ productIds }`
  e devolve a agenda resolvida pela regra da categoria + `mixedCart` /
  `allowSameDay` / `hoursLabel` — PR #98)_
- `POST /api/v1/coupons/preview` _(novo)_
- `GET /api/v1/catalog/products/:id/reviews` + `POST` _(avaliação de produto — Fase 2)_
- `POST /api/v1/orders`, `GET /api/v1/orders`, `GET /api/v1/orders/:id`
- `POST /api/v1/orders/:id/cancel`, `.../reorder`, `.../pix` _(novo)_,
  `.../review` _(novo)_
- `GET/POST/PATCH/DELETE /api/v1/addresses[...]`, `.../addresses/validate`
- `POST/DELETE /api/v1/push/subscriptions`, `GET /api/v1/push/vapid-public-key`
- `POST /api/v1/webhooks/mercadopago` _(substitui `meta/whatsapp`)_
- `GET /api/v1/cron/reconcile-pix` _(novo; substitui o hook `send-sms`)_

**Admin — ausentes no doc 25:**

- `GET/POST /api/v1/admin/orders`, `.../orders/:id`, `.../status`, `.../cancel`
- `.../orders/:id/mark-printed`, `.../orders/unprinted` _(fila de impressão)_
- `.../categories`, `.../products` (+ `/archive`, `/duplicate`, `/images`),
  `.../addons`, `.../catalog`
- `.../promotions[/:id]`, `.../coupons[/:id]` _(novos)_
- `.../reviews[/:id]`, `.../product-reviews[/:id]` _(novos)_
- `.../reports?kind=operations|financial&period=` _(novo)_
- `.../store`, `.../business-hours`, `.../blackouts`, `.../audit-logs`
- `.../push/config`, `.../push/subscriptions`, `.../push/test` _(push do painel)_
- `.../session`, `.../session/password`, `.../realtime`
- `.../uploads/product-image`

---

## 5. Delta do doc 29 (Deploy e Ambientes)

Fonte: `packages/shared/src/config/env.ts` (`assertProductionEnv`).

**Obrigatórias em produção** hoje:

- Supabase: `NEXT_PUBLIC_SUPABASE_URL`, anon/publishable key,
  `SUPABASE_SERVICE_ROLE_KEY`
- **Twilio Verify**: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`,
  `TWILIO_VERIFY_SERVICE_SID` (ou `TWILIO_VERIFY_SMS_SERVICE_SID`)
- **Cloudflare Turnstile**: `NEXT_PUBLIC_TURNSTILE_SITE_KEY`,
  `TURNSTILE_SECRET_KEY`
- **Mercado Pago**: `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET`
- `CRON_SECRET` (cron de reconciliação Pix)
- `OTP_HASH_SECRET` (mín. 16 chars)

**Recomendadas:** VAPID (`NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
`VAPID_SUBJECT`) — **o MESMO par em `zelo-app` e `zelo-admin`** (os dois apps
enviam push mirando as assinaturas um do outro; par distinto = 401/403
silencioso); Sentry DSN; `GOOGLE_MAPS_API_KEY` +
`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`.

**Não existem** (remover do doc 29): token/app-secret da Meta Cloud API,
segredo do "Send SMS Hook".

**Topologia:** 2 projetos Vercel (`zelo-app` = `apps/client`,
`zelo-admin` = `apps/admin`), Supabase remoto compartilhado, Supabase Cron
para o Pix. Ver também a auditoria em
`docs/20-tecnico/auditoria-seguranca-2026-09-03.md` (todos os 20 itens
fechados; exige `OTP_HASH_SECRET` no deploy).

---

## 6. Ajustes menores nos docs "ok"

- `10-funcional/07 - Carrinho e Checkout.md`: o checkout tem etapa de
  **cupom** (revisão) e, para Pix, uma etapa de **pagamento Pix** com QR.
- `10-funcional/05 - Ciclo de Vida do Pedido.md`: cancelar pedido Pix pago
  dispara **estorno** e leva `payment_status` a `refunded`.
- `10-funcional/12 - Notificações e Tempo Real.md`: além do push do cliente,
  há **push do painel** (pedido novo) e o push-convite de avaliação.
- `00-produto-e-dominio/00 - Produto.md` (Evoluções Futuras): promoções,
  cupons, financeiro, avaliações, estoque e comanda manual **saíram de
  "futuro" e já estão em produção**.
- `PRODUCT.md`: "Pix conferido manualmente" e "sem sistema financeiro" não
  valem mais; `--radius` é 0.5rem.

---

## 7. Como usar este documento

1. Ao mexer numa área, ler o plano correspondente (102–107) — é a fonte
   viva.
2. Ao encostar num doc de referência marcado ⚠️ nesta tabela, **corrigi-lo
   junto** com a mudança (regra do encerramento no roadmap: "revisar
   documentação").
3. Quando um doc de referência for reconciliado, riscar a linha aqui.
