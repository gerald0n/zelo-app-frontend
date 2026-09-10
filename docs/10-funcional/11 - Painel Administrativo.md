# 11 - Painel Administrativo

> Reconciliado com o código em **2026-09-09** (`apps/admin`). Fontes vivas
> para cada área: planos `100-planejamento/103` (painel), `104` (promoções,
> cupons, financeiro), `106` (avaliações) e `107` (responsividade). Delta
> técnico em `20-tecnico/31` §2.10.

# Objetivo

Define as funcionalidades do painel administrativo (`apps/admin`, projeto
Vercel `zelo-admin`). É um app separado do cliente, usado
**majoritariamente em tablet**.

---

# Acesso

Existe um único Administrador. O acesso administrativo:

- usa autenticação própria (Supabase Auth do admin), separada da dos
  Clientes;
- protege todas as rotas via `proxy.ts` (middleware) + `requireAdmin`;
- força troca de senha no primeiro login (`admin_profiles.must_set_password`,
  `/configuracoes` → senha);
- registra ações relevantes na auditoria.

Não há perfis ou níveis de permissão.

---

# Navegação

Sidebar (desktop/tablet) e bottom nav (mobile):

| Rota             | Item        | Conteúdo                                                              |
| ---------------- | ----------- | --------------------------------------------------------------------- |
| `/`              | Visão geral | Métricas + Operação + Financeiro                                      |
| `/pedidos`       | Pedidos     | Kanban de duas raias + "Agendados"                                    |
| `/pedidos/novo`  | —           | Comanda manual                                                        |
| `/pedido/[id]`   | —           | Detalhe do pedido                                                     |
| `/catalogo`      | Catálogo    | Abas Produtos / Categorias / Promoções / Cupons / Adicionais          |
| `/avaliacoes`    | Avaliações  | Moderação de avaliações de pedido e de produto                        |
| `/configuracoes` | Ajustes     | Loja, horários, bloqueios, impressora, dispositivos, auditoria, senha |

---

# Visão geral (`/`)

Absorveu a antiga rota `/relatorios` (removida, dá 404). Tem:

- cartões de contagem por status do pedido (novos, em produção, prontos, em
  entrega, agendados, concluídos, cancelados) — reativos ao realtime;
- seção **Operação** e seção **Financeiro**, ambas presas a um seletor de
  período (Hoje / 7d / 30d);
- dados agregados no servidor:
  `GET /api/v1/admin/reports?kind=operations|financial&period=`.

---

# Pedidos — Kanban (`/pedidos`)

- **Duas raias**: `pickup` (retirada) e `delivery` (entrega).
- Colunas por status; uma coluna sintética **"Agendados"** para pedidos com
  data futura.
- **Drag-and-drop feito à mão** (sem lib): `onPointerDown` + limiar de 8 px +
  clone em portal no `<body>`. O arraste **avança um passo por vez** (não
  pula colunas). Kanban multi-avanço foi descartado (decisão de
  2026-09-09, ver plano 107).
- Cada card abre um modal de detalhe (`AdminOrderDetailModal`): itens,
  pagamento, endereço, observações, troco, cupom, timeline.
- Realtime com **debounce** para não disparar tempestade de refetch
  (plano 107 / doc 31).

## Transições e cancelamento

Ações: confirmar, iniciar produção, marcar pronto, marcar saída para
entrega, marcar entregue, cancelar. Tudo via
`private.transition_order_status` (guardas de estado, inclusive terminal
para Pix estornado).

Ao cancelar, o motivo é **obrigatório**. A auditoria registra autor, motivo,
status anterior, data/hora. Cancelar Pix pago dispara **estorno** e leva
`payment_status` a `refunded`.

---

# Comanda manual (`/pedidos/novo`)

Pedido avulso para cliente **sem conta** (`private.create_manual_order`):

- `orders.customer_id` é nullable; usa `guest_name` / `guest_phone_e164`
  (ou resolve um cliente existente pelo telefone);
- `payment_method` restrito a `cash` / `card`; pode já entrar
  `payment_status = 'confirmed'`;
- endereço sem geocodificação — a **taxa de entrega é digitada pelo admin**;
- aceita cupom.

---

# Impressão térmica

- Comprovante/comanda via **WebUSB** (EPSON TM-T20X, validada em hardware).
  `stores.cnpj` entra no cabeçalho.
- **Fila resiliente** (`lib/admin/print-queue.ts`): o painel enfileira a
  impressão da comanda de todo pedido novo. Se a impressora está
  desconectada, os jobs ficam no `localStorage` e imprimem um a um quando
  ela volta.
- `orders.kitchen_printed_at` é a fonte da verdade "a comanda já saiu";
  marcada **só depois** da impressão confirmada. Ao reabrir o painel, ele
  busca pedidos com esse campo nulo (`GET /api/v1/admin/orders/unprinted`)
  e reenfileira. `POST /api/v1/admin/orders/[orderId]/mark-printed`.
- Configuração da impressora em Ajustes → Impressora.

---

# Catálogo (`/catalogo`)

## Produtos

Criar, editar, ordenar (drag), ativar/desativar, preço, **várias imagens**
(galeria, `.../images`), associar categoria e adicionais, **duplicar**
(`POST /api/v1/admin/products/:id/duplicate`), arquivar (`.../archive`).

**Estoque**: `products.stock_quantity` (nullable; NULL = ilimitado).
`create_order` decrementa atomicamente; ao chegar a 0, `is_available` vira
`false`. "Acabou num toque" na UI. Cancelamento devolve e reativa.

UI **otimista** nas mutações do catálogo (plano 107).

## Categorias

Criar, editar, ordenar, ativar/desativar. Cada categoria carrega as
**regras de agendamento** (`scheduling_*`) — ver doc `10-funcional/10`.

## Promoções

Aba **Promoções**: desconto percentual por escopo `store` / `category` /
`products`, período opcional, `is_active`. Resolução por especificidade
(produto > categoria > loja, nunca acumula) em
`private.effective_price_cents`. Migration `20260904170000_promotions`.

## Cupons

Aba **Cupons**: `code` único (uppercase), tipo
`percent` / `fixed` / `free_shipping`, `max_uses`, `uses_count`, período.
`private.claim_coupon` valida e incrementa na mesma transação do pedido;
cancelamento devolve. Não acumula com promoção. Migration
`20260908140000_coupons`.

## Adicionais

Criar, editar, preço, ativar/desativar, associar produtos.

---

# Avaliações (`/avaliacoes`)

Moderação de duas fontes (badge de pendentes na navegação):

- **Avaliações de pedido** (`order_reviews`) — uma por pedido entregue, nota
  1–5 + comentário, flag `is_featured` para a vitrine.
  `GET/PATCH /api/v1/admin/reviews`.
- **Avaliações de produto** (`product_reviews`) — uma por cliente por
  produto, só quem tem pedido entregue com aquele produto. Tudo entra
  `pending`; só aparece no site após aprovação.
  `GET/PATCH /api/v1/admin/product-reviews`.

Ambas usam o enum `review_status` (`pending` / `approved` / `hidden`) e
registram `product_review.moderate` / `review.moderate` na auditoria (com
rótulo pt-BR). Migrations `20260909120000_order_reviews`,
`20260909130000_product_reviews`. Ver plano `100-planejamento/106`.

---

# Ajustes (`/configuracoes`)

- **Loja** (`StoreForm`): nome, contato, WhatsApp, endereço e coordenadas,
  formas de pagamento (`accepts_pix/cash/card`), raios de entrega
  (`free_delivery_radius_meters`, `fixed_delivery_fee_cents`,
  `max_delivery_radius_meters`), CNPJ, `pix_copy_paste` (fallback),
  `payment_fee_estimate_bps`.
- **Pausa da loja**: `is_open_override` e **pausa "até tal hora"**
  (`paused_until` / `pause_reason`) — ver doc `10-funcional/10`.
- **Horários de funcionamento** (`BusinessHoursForm`) e **bloqueios/blackouts**
  (`BlackoutsSection`). A seção global "Horários de agendamento" foi
  **removida** (agendamento agora é por categoria).
- **Impressora** (`PrinterSection`): pareamento WebUSB.
- **Dispositivos** (`PushSection`): toggle do Web Push do painel neste
  aparelho (`admin_push_subscriptions`, service worker próprio).
- **Auditoria** (`AuditLogSection`): log filtrável, legível em pt-BR, com
  autor e detalhe. `GET /api/v1/admin/audit-logs`.
- **Senha** (`AdminPasswordForm`) e encerrar sessão.

Preferências de UI (tema, densidade) persistem via `useUiPref`; há um script
anti-flash de tema no `<head>` (plano 107).

---

# Tempo Real

Novos pedidos e mudanças de status aparecem sem recarregar (Supabase
Realtime, `AdminRealtimeContext`). Além disso há **push do painel** para
"pedido novo" (enviado pelo app do cliente, mirando as assinaturas do admin —
o par VAPID precisa ser o mesmo nos dois apps; ver doc 31 §2.10).

---

# Auditoria

Registradas, no mínimo: confirmação e alteração de status, cancelamento (com
motivo), alteração de disponibilidade e de preço, alteração de configurações
operacionais, moderação de avaliação. Tabela de auditoria com autor
resolvido e `detail` estruturado; rótulos pt-BR em
`configuracoes/_sections/audit-log-labels.ts`.
