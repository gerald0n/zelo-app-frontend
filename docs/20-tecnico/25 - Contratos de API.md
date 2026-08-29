# 25 - Contratos de API

# Objetivo

Este documento define os contratos HTTP e os limites entre interface, backend, webhooks e service worker.

APIs públicas devem ser versionadas em `/api/v1`.

Server Actions podem ser usadas para mutações internas simples, mas não substituem contratos necessários para integrações externas.

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

## `POST /api/v1/auth/otp/request`

Solicita OTP por SMS.

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

## `GET /api/v1/catalog`

Retorna Loja, Categorias, Produtos, imagens e Adicionais públicos.

Filtros opcionais:

- `search`;
- `category`;
- `cursor`.

Produtos indisponíveis podem aparecer, mas devem ser marcados como não compráveis.

## `GET /api/v1/products/:slug`

Retorna detalhes de um Produto.

---

# Carrinho

## `GET /api/v1/cart`

Retorna Carrinho atual.

## `POST /api/v1/cart/items`

Entrada:

```json
{
  "productId": "uuid",
  "quantity": 2,
  "addOnIds": ["uuid"],
  "customerNote": "Sem açúcar por cima"
}
```

## `PATCH /api/v1/cart/items/:itemId`

Permite alterar quantidade, adicionais e observação.

## `DELETE /api/v1/cart/items/:itemId`

Remove Item.

## `DELETE /api/v1/cart`

Limpa Carrinho.

## `PUT /api/v1/cart`

Substitui o Carrinho persistido do Cliente autenticado pelos itens enviados.

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

Cria novo Carrinho com base no Pedido anterior.

Saída deve informar:

- Itens restaurados;
- Itens indisponíveis;
- Adicionais indisponíveis;
- preços atualizados.

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

Valida:

- geocodificação;
- área urbana;
- rota;
- distância;
- taxa.

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

---

# Webhooks

## `POST /api/v1/webhooks/meta/whatsapp`

Utilizado para eventos da Meta quando necessários.

Deve:

- validar assinatura;
- tratar challenge de verificação;
- ser idempotente;
- não registrar conteúdo sensível.

## `POST /api/v1/hooks/supabase/send-sms`

Endpoint interno do Send SMS Hook.

Responsabilidades:

- verificar assinatura do hook;
- extrair telefone e OTP;
- chamar a Meta Cloud API;
- responder no formato esperado;
- nunca expor o OTP em logs.

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
