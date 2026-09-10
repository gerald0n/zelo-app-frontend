# 25 - Contratos de API

> Reconciliado em **2026-09-09**. O **Inventário de rotas** abaixo é a lista
> autoritativa (extraída de `apps/*/src/app/api/v1`); as seções detalhadas
> que vêm depois descrevem os contratos do núcleo e podem ter shapes
> parciais para as rotas mais novas — a fonte final é o `route.ts` e o
> schema Zod de cada uma. Ver `20-tecnico/31` §4.

# Objetivo

Este documento define os contratos HTTP e os limites entre interface, backend, webhooks e service worker.

APIs públicas são versionadas em `/api/v1`. Cada app (`apps/client` =
`zelo-app`, `apps/admin` = `zelo-admin`) serve as suas próprias rotas.

Server Actions podem ser usadas para mutações internas simples, mas não substituem contratos necessários para integrações externas.

---

# Inventário de rotas

## Cliente (`apps/client`)

| Rota                                                                 | Métodos                   | Notas                                                          |
| -------------------------------------------------------------------- | ------------------------- | -------------------------------------------------------------- |
| `/api/v1/auth/otp/send`                                              | POST                      | solicita OTP (era `/auth/otp/request`)                         |
| `/api/v1/auth/otp/verify`                                            | POST                      | valida OTP → sessão Supabase                                   |
| `/api/v1/auth/me`                                                    | GET                       | cliente atual                                                  |
| `/api/v1/auth/session`                                               | GET/POST/DELETE           | sessão                                                         |
| `/api/v1/catalog/products`                                           | GET                       | catálogo público (Data Cache)                                  |
| `/api/v1/catalog/products/[productId]/reviews`                       | GET                       | avaliações aprovadas do produto                                |
| `/api/v1/catalog/store`                                              | GET                       | dados públicos da loja                                         |
| `/api/v1/cart`                                                       | GET/PUT/DELETE            | carrinho inteiro                                               |
| `/api/v1/cart/reconcile`                                             | POST                      | funde carrinho anônimo ao logar                                |
| `/api/v1/checkout/options`                                           | **POST** `{ productIds }` | agenda por categoria + `mixedCart`/`allowSameDay`/`hoursLabel` |
| `/api/v1/checkout/preview`                                           | POST                      | totais, frete, cupom                                           |
| `/api/v1/coupons/preview`                                            | POST                      | valida cupom (read-only)                                       |
| `/api/v1/orders`                                                     | GET/POST                  | lista / cria pedido                                            |
| `/api/v1/orders/[orderId]`                                           | GET                       | detalhe                                                        |
| `/api/v1/orders/[orderId]/cancel`                                    | POST                      | cancela (dispara estorno se Pix pago)                          |
| `/api/v1/orders/[orderId]/reorder`                                   | POST                      | repete pedido                                                  |
| `/api/v1/orders/[orderId]/pix`                                       | GET/POST                  | cobrança Pix (nova tentativa)                                  |
| `/api/v1/orders/[orderId]/review`                                    | POST                      | avaliação do pedido                                            |
| `/api/v1/addresses`, `/addresses/[addressId]`, `/addresses/validate` | GET/POST/PATCH/DELETE     | endereços                                                      |
| `/api/v1/push/subscriptions`                                         | POST/DELETE               | assinatura de push do cliente                                  |
| `/api/v1/push/vapid-public-key`                                      | GET                       | chave pública VAPID                                            |
| `/api/v1/webhooks/mercadopago`                                       | POST                      | confirmação de pagamento (assinatura validada, idempotente)    |
| `/api/v1/cron/reconcile-pix`                                         | GET                       | varredura de Pix pendentes (Supabase Cron, `CRON_SECRET`)      |
| `/api/v1/internal/revalidate`                                        | POST                      | invalidação de cache do catálogo (`CATALOG_REVALIDATE_SECRET`) |

## Painel (`apps/admin`)

| Rota                                                             | Métodos                                   | Notas                                   |
| ---------------------------------------------------------------- | ----------------------------------------- | --------------------------------------- |
| `/api/v1/admin/orders`, `/orders/[orderId]`                      | GET                                       | fila e detalhe                          |
| `/api/v1/admin/orders/[orderId]/status`                          | POST                                      | transição de status                     |
| `/api/v1/admin/orders/[orderId]/cancel`                          | POST                                      | cancela (motivo obrigatório)            |
| `/api/v1/admin/orders/[orderId]/mark-printed`                    | POST                                      | marca comanda impressa                  |
| `/api/v1/admin/orders/unprinted`                                 | GET                                       | pedidos com `kitchen_printed_at` nulo   |
| `/api/v1/admin/catalog`                                          | GET                                       | catálogo completo do painel (sem cache) |
| `/api/v1/admin/categories`, `/categories/[categoryId]`           | GET/POST/PATCH/DELETE                     | inclui regras de agendamento            |
| `/api/v1/admin/products`, `/products/[productId]`                | GET/POST/PATCH/DELETE                     |                                         |
| `/api/v1/admin/products/[productId]/archive`                     | POST                                      | arquivar                                |
| `/api/v1/admin/products/[productId]/duplicate`                   | POST                                      | duplicar                                |
| `/api/v1/admin/products/[productId]/images`, `/images/[imageId]` | GET/POST/DELETE                           | galeria                                 |
| `/api/v1/admin/addons`, `/addons/[addonId]`                      | GET/POST/PATCH/DELETE                     |                                         |
| `/api/v1/admin/promotions`, `/promotions/[promotionId]`          | GET/POST/PATCH/DELETE                     |                                         |
| `/api/v1/admin/coupons`, `/coupons/[couponId]`                   | GET/POST/PATCH/DELETE                     |                                         |
| `/api/v1/admin/reviews`, `/reviews/[reviewId]`                   | GET/PATCH                                 | moderação de avaliação de pedido        |
| `/api/v1/admin/product-reviews`, `/product-reviews/[reviewId]`   | GET/PATCH                                 | moderação de avaliação de produto       |
| `/api/v1/admin/reports`                                          | GET `?kind=operations\|financial&period=` | dashboard "Visão geral"                 |
| `/api/v1/admin/store`                                            | GET/PATCH                                 | config da loja (inclui pausa)           |
| `/api/v1/admin/business-hours`                                   | GET/PUT                                   |                                         |
| `/api/v1/admin/blackouts`, `/blackouts/[blackoutId]`             | GET/POST/DELETE                           | bloqueios                               |
| `/api/v1/admin/audit-logs`                                       | GET                                       | auditoria filtrável                     |
| `/api/v1/admin/push/config`, `/push/subscriptions`               | GET/POST/DELETE                           | Web Push do painel                      |
| `/api/v1/push/test`                                              | POST                                      | disparo de teste                        |
| `/api/v1/admin/session`, `/session/password`                     | GET/POST                                  | sessão e troca de senha                 |
| `/api/v1/admin/realtime`                                         | GET                                       | token/config de realtime                |
| `/api/v1/admin/uploads/product-image`                            | POST                                      | upload de imagem                        |

> **Não existem** (removidos): `POST /api/v1/webhooks/meta/whatsapp`,
> `POST /api/v1/hooks/supabase/send-sms`, `GET /api/v1/catalog` (raiz),
> `GET /api/v1/products/:slug`, `/api/v1/cart/items*` (o carrinho é
> substituído inteiro via `PUT /api/v1/cart`).

---

# Convenções

## Formato

- JSON em UTF-8;
- datas em ISO 8601;
- valores monetários em centavos;
- IDs em UUID;
- erros estruturados;
- autenticação por sessão Supabase;
- validação com Zod.

## Resposta de Sucesso

```json
{
  "data": {}
}
```

## Resposta de Erro

```json
{
  "error": {
    "code": "ORDER_NOT_CANCELLABLE",
    "message": "O pedido não pode mais ser cancelado.",
    "details": {}
  }
}
```

A mensagem pode ser localizada para o usuário.

`code` deve ser estável.

---

# Idempotência

Operações críticas devem aceitar `Idempotency-Key`.

Obrigatório para:

- criação de Pedido;
- webhooks;
- envio de push em lote;
- callbacks externos.

---

# Autenticação do Cliente

## `POST /api/v1/auth/otp/send`

Solicita OTP por SMS. Protegido por Turnstile + honeypot + rate limit por IP.

Entrada:

```json
{
  "phone": "+5588999999999"
}
```

Saída:

```json
{
  "data": {
    "requestAccepted": true,
    "resendAfterSeconds": 60
  }
}
```

Não revelar se o telefone já possui cadastro.

## `POST /api/v1/auth/otp/verify`

Valida o OTP no Supabase Auth.

Entrada:

```json
{
  "phone": "+5588999999999",
  "code": "123456"
}
```

Saída:

```json
{
  "data": {
    "authenticated": true,
    "isNewCustomer": false
  }
}
```

---

# Catálogo

## `GET /api/v1/catalog/products`

Retorna Categorias, Produtos, imagens e Adicionais públicos. Servido do
**Data Cache do Next** (ver `20-tecnico/22`). Produtos indisponíveis podem
aparecer marcados como não compráveis.

## `GET /api/v1/catalog/store`

Dados públicos da loja (horário, pausa, formas de pagamento, raios).

## `GET /api/v1/catalog/products/:productId/reviews`

Avaliações **aprovadas** do produto (nota + comentário + nome de exibição).

---

# Carrinho

O carrinho é lido inteiro e substituído inteiro — não há endpoints por item.

## `GET /api/v1/cart`

Retorna o Carrinho atual (cliente autenticado ou anônimo por chave).

## `PUT /api/v1/cart`

Substitui o Carrinho pelos itens enviados:

```json
{
  "items": [
    {
      "productId": "uuid",
      "quantity": 2,
      "addOnIds": ["uuid"],
      "customerNote": "Sem açúcar por cima"
    }
  ]
}
```

## `DELETE /api/v1/cart`

Limpa o Carrinho.

## `POST /api/v1/cart/reconcile`

Une o Carrinho local (anônimo) ao Carrinho persistido do Cliente autenticado.

Entrada:

```json
{
  "items": [
    {
      "productId": "uuid",
      "quantity": 2,
      "addOnIds": ["uuid"],
      "customerNote": "Sem açúcar por cima"
    }
  ]
}
```

A resposta devolve os itens unidos e revalidados.

---

# Checkout

## `POST /api/v1/checkout/options`

Opções do checkout para o carrinho atual. Recebe `{ productIds: string[] }` (era `GET` até o PR #98). Devolve: loja resumida, bairros e `scheduling` — `storeOpen`, `availableDates`, `timesByDate` (por data, com `delivery` / `pickup`), `allowSameDay`, `mixedCart`, `hoursLabel`. A agenda já vem resolvida pela regra de agendamento da categoria dos itens (ver `10-funcional/10`); `mixedCart = true` quando o carrinho mistura categorias com regras diferentes.

## `POST /api/v1/checkout/preview`

Calcula e valida uma prévia sem criar Pedido.

Entrada resumida:

```json
{
  "cartId": "uuid",
  "timing": "scheduled",
  "scheduledFor": "2026-08-06T15:00:00-03:00",
  "deliveryMethod": "delivery",
  "address": {
    "street": "Rua Exemplo",
    "number": "100",
    "neighborhood": "Centro",
    "city": "Pereiro",
    "state": "CE",
    "latitude": -6.0,
    "longitude": -38.0
  },
  "paymentMethod": "pix"
}
```

Saída:

- itens revalidados;
- indisponibilidades;
- subtotal;
- taxa;
- total;
- distância;
- primeira data permitida;
- validade da prévia.

## `POST /api/v1/orders`

Cria o Pedido.

Deve exigir `Idempotency-Key`.

A criação usa a função transacional `create_order`.

---

# Pedidos do Cliente

## `GET /api/v1/orders`

Lista Pedidos do Cliente autenticado.

## `GET /api/v1/orders/:orderId`

Retorna detalhes e histórico do próprio Pedido.

## `POST /api/v1/orders/:orderId/cancel`

Entrada:

```json
{
  "reason": "Não poderei receber o pedido."
}
```

O servidor valida status e autoria.

## `POST /api/v1/orders/:orderId/reorder`

Cria novo Carrinho com base no Pedido anterior. A saída informa itens
restaurados, itens/adicionais indisponíveis e preços atualizados.

## `GET|POST /api/v1/orders/:orderId/pix`

`GET` devolve o estado da cobrança Pix atual (QR, copia-e-cola,
`pix_expires_at`). `POST` gera uma **nova tentativa** quando a anterior
expirou (`pix_attempt` incrementa).

## `POST /api/v1/orders/:orderId/review`

Envia a avaliação do Pedido (nota 1–5 + comentário opcional). Só para
pedidos `delivered` do próprio Cliente; entra como `pending`.

---

# Endereços

## `GET /api/v1/addresses`

Lista endereços ativos do Cliente.

## `POST /api/v1/addresses`

Cria endereço salvo.

## `PATCH /api/v1/addresses/:addressId`

Atualiza endereço.

## `DELETE /api/v1/addresses/:addressId`

Arquiva endereço.

## `POST /api/v1/addresses/validate`

Valida geocodificação, distância **em linha reta** da loja, faixa de raio
(dentro/fora da área) e taxa aplicável. Ver `10-funcional/08`.

---

# Cupons

## `POST /api/v1/coupons/preview`

Valida um `code` para o carrinho atual (read-only, `public.preview_coupon`).
Devolve tipo de desconto, valor estimado e motivo de recusa. O consumo real
acontece dentro de `create_order`.

---

# Push

## `POST /api/v1/push/subscriptions`

Registra PushSubscription.

## `DELETE /api/v1/push/subscriptions`

Revoga PushSubscription atual.

## `POST /api/v1/push/test`

Somente em ambiente controlado ou para Administrador.

---

# Administração

Todas as rotas exigem papel administrativo.

## `GET /api/v1/admin/orders`

Filtros:

- status;
- data;
- agendamento;
- entrega;
- busca por número.

## `GET /api/v1/admin/orders/:orderId`

Retorna visão completa, incluindo notas internas.

## `POST /api/v1/admin/orders/:orderId/status`

Entrada:

```json
{
  "newStatus": "in_production",
  "reason": null
}
```

## `POST /api/v1/admin/orders/:orderId/cancel`

Entrada:

```json
{
  "reason": "Produto indisponível."
}
```

## `POST /api/v1/admin/products`

Cria Produto.

## `PATCH /api/v1/admin/products/:productId`

Atualiza Produto.

## `POST /api/v1/admin/products/:productId/archive`

Arquiva Produto.

Padrão equivalente para Categorias e Adicionais.

---

# Uploads

## `POST /api/v1/admin/uploads/product-image`

Pode utilizar upload direto controlado ou URL assinada.

Validar:

- tipo MIME;
- tamanho;
- quantidade;
- autorização;
- relação com Produto.

---

# Configurações

## `GET /api/v1/admin/store`

Retorna configuração da Loja.

## `PATCH /api/v1/admin/store`

Atualiza dados operacionais.

## `GET /api/v1/admin/business-hours`

Lista horários.

## `PUT /api/v1/admin/business-hours`

Substitui configuração semanal de forma validada.

## `GET|POST|DELETE /api/v1/admin/blackouts[/:blackoutId]`

Bloqueios de datas (feriados, folgas).

---

# Administração — catálogo estendido

## `POST /api/v1/admin/products/:productId/duplicate`

Cria uma cópia do Produto (sem imagens vinculadas por padrão).

## `GET|POST|DELETE /api/v1/admin/products/:productId/images[/:imageId]`

Galeria de fotos do Produto (ordenável).

## `GET|POST|PATCH|DELETE /api/v1/admin/promotions[/:promotionId]`

Promoções (desconto percentual por escopo `store` / `category` /
`products`).

## `GET|POST|PATCH|DELETE /api/v1/admin/coupons[/:couponId]`

Cupons (`code`, `discount_type`, `max_uses`, período).

## `GET|PATCH /api/v1/admin/reviews[/:reviewId]`

Moderação de avaliações **de pedido** (`order_reviews`): aprovar, ocultar,
destacar (`is_featured`).

## `GET|PATCH /api/v1/admin/product-reviews[/:reviewId]`

Moderação de avaliações **de produto** (`product_reviews`).

## `GET /api/v1/admin/reports?kind=operations|financial&period=`

Agregações da "Visão geral". `operations` = contagens/tempos por status;
`financial` = receita, taxas do MP, líquido. `period` = `today` / `7d` /
`30d`.

## `GET /api/v1/admin/orders/unprinted` · `POST /api/v1/admin/orders/:orderId/mark-printed`

Suporte à fila de impressão da cozinha (`orders.kitchen_printed_at`).

---

# Administração — dispositivos e sessão

## `GET|POST|DELETE /api/v1/admin/push/config` · `/push/subscriptions`

Web Push do painel (`admin_push_subscriptions`). O par VAPID é o mesmo dos
dois apps.

## `GET|POST /api/v1/admin/session` · `/session/password`

Sessão do admin e troca de senha (força no primeiro acesso via
`must_set_password`).

---

# Webhooks e jobs

## `POST /api/v1/webhooks/mercadopago`

Notificação de pagamento do Mercado Pago. Valida a assinatura
(`MERCADOPAGO_WEBHOOK_SECRET`), é **idempotente** via `payment_events`, e
leva o pedido a `confirmed` / `failed` / `refunded` conforme o evento. Não
registra dados sensíveis.

## `GET /api/v1/cron/reconcile-pix`

Varre pedidos Pix pendentes e consulta o status no MP (cobre webhooks
perdidos). Agendado pelo **Supabase Cron** (`supabase/cron/`), protegido por
`Authorization: Bearer <CRON_SECRET>`.

## `POST /api/v1/internal/revalidate`

Chamado pelo `apps/admin` após editar catálogo/loja. Autenticado por
`Authorization: Bearer <CATALOG_REVALIDATE_SECRET>`; invalida as tags do
Data Cache do catálogo no `apps/client`.

> Não existe integração com a Meta. O SMS de OTP sai pela Twilio Verify
> (ou pelo fallback interno), sem "Send SMS Hook" do Supabase.

---

# Service Worker

## `GET /sw.js`

Entregue pela aplicação.

Responsabilidades:

- instalação;
- ativação;
- cache limitado;
- recepção de push;
- clique em notificação.

---

# Códigos de Erro

Exemplos:

- `VALIDATION_ERROR`;
- `UNAUTHENTICATED`;
- `FORBIDDEN`;
- `RESOURCE_NOT_FOUND`;
- `RATE_LIMITED`;
- `CART_EXPIRED`;
- `PRODUCT_UNAVAILABLE`;
- `ADD_ON_UNAVAILABLE`;
- `PRICE_CHANGED`;
- `STORE_CLOSED`;
- `SCHEDULE_INVALID`;
- `ADDRESS_OUT_OF_AREA`;
- `DELIVERY_ROUTE_UNAVAILABLE`;
- `ORDER_NOT_CANCELLABLE`;
- `INVALID_STATUS_TRANSITION`;
- `PAYMENT_CONFIRMATION_REQUIRED`;
- `INTEGRATION_UNAVAILABLE`;
- `INTERNAL_ERROR`.

---

# Server Actions

Podem ser usadas para:

- formulários administrativos;
- edição simples;
- ações internas da interface;
- atualização de perfil.

Não usar Server Actions para:

- webhooks;
- service worker;
- callbacks externos;
- contratos consumidos fora da aplicação;
- operações que exigem versionamento HTTP explícito.
