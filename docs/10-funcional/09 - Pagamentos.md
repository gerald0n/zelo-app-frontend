# 09 - Pagamentos

> Reconciliado com o código em **2026-09-09** (ver `20-tecnico/31` §2.1 e o
> plano `100-planejamento/104`). O Pix passou a ser **cobrança dinâmica via
> Mercado Pago** com confirmação automática; dinheiro e cartão seguem como
> registro no recebimento.

# Objetivo

Este documento define as formas de pagamento aceitas e suas regras.

---

# Formas de Pagamento

- Pix;
- dinheiro;
- cartão.

O Administrador habilita ou desabilita cada forma (`stores.accepts_pix`,
`accepts_cash`, `accepts_card`).

---

# Pix

## Funcionamento

1. O Cliente escolhe Pix e finaliza o Pedido.
2. O `create_order` cria o Pedido com `payment_status = 'pending'` e, em
   seguida, o sistema abre uma **cobrança dinâmica** no Mercado Pago (Orders
   API) para aquele Pedido.
3. O Cliente é levado à tela `checkout/pix/[orderId]`, que mostra o **QR
   code** e o **copia-e-cola** daquela cobrança, com contagem regressiva
   (`pix_expires_at`, ~30 min).
4. O Cliente paga pelo app do banco.
5. O Mercado Pago chama o **webhook** (`POST /api/v1/webhooks/mercadopago`);
   a assinatura é validada e o evento é idempotente via `payment_events`.
6. Confirmado o pagamento: `payment_status = 'confirmed'`, `paid_at`
   preenchido, e uma chamada extra ao MP grava `mp_payment_id`,
   `payment_fee_cents` e `payment_net_cents` (financeiro).
7. O painel recebe o pedido em tempo real (e push de "pedido novo").

## Reconciliação

`GET /api/v1/cron/reconcile-pix` varre pedidos Pix pendentes e consulta o
status no MP, cobrindo webhooks perdidos. É agendado pelo **Supabase Cron**
(`supabase/cron/reconcile-pix.sql`) e protegido por `CRON_SECRET`.

## Novas tentativas

Se o código expira, o Cliente gera outro: `orders.pix_attempt` incrementa e
entra na `X-Idempotency-Key` (`order-<id>-<attempt>`), criando uma cobrança
nova no MP.

## Estorno

Quando o admin cancela um Pedido Pix já pago, o sistema chama o estorno no
Mercado Pago; a RPC `refund_order_pix_payment` leva `payment_status` a
**`refunded`** (valor novo do enum). `transition_order_status` tem guarda de
estado terminal. Um estorno feito direto no painel do MP também chega pelo
webhook e é tratado de forma idempotente.

## Campos no Pedido

`mp_order_id`, `mp_payment_id`, `pix_qr_code`, `pix_qr_code_base64`,
`pix_ticket_url`, `pix_expires_at`, `paid_at`, `pix_attempt`,
`payment_fee_cents`, `payment_net_cents`. `pix_copy_paste` em `stores`
permanece só como fallback estático.

---

# Dinheiro

O pagamento ocorre no recebimento. O checkout permite:

- informar que não precisa de troco;
- informar que precisa de troco e o valor entregue (para o cálculo).

O valor informado para troco deve ser igual ou superior ao total do Pedido.

---

# Cartão

O pagamento ocorre no recebimento (maquininha). O sistema apenas registra
cartão como forma de pagamento; não há captura online.

---

# Comanda manual

Na comanda manual (`create_manual_order`) o `payment_method` é restrito a
`cash` / `card` e o Pedido pode já entrar com `payment_status = 'confirmed'`
(ver `20-tecnico/31` §2.6).

---

# Registro no Pedido

O Pedido registra: forma de pagamento, condição de pagamento, necessidade de
troco e valor para troco (quando aplicável), além dos campos de Pix/MP e do
financeiro listados acima.

---

# Financeiro

O relatório financeiro do admin (`GET /api/v1/admin/reports?kind=financial`)
usa `payment_fee_cents` / `payment_net_cents` reais quando disponíveis e
`stores.payment_fee_estimate_bps` (padrão 99 = 0,99%) como estimativa onde
não há número do MP. Ver plano `100-planejamento/104`.
