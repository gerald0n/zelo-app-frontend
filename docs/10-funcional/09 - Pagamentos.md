# 09 - Pagamentos

> ⚠️ **Seção "Pix" desatualizada (ago/2026).** O Pix **não** é mais
> copia-e-cola estático com conferência manual. Cada pedido Pix gera uma
> cobrança dinâmica no **Mercado Pago** (QR + copia-e-cola por pedido,
> expiração ~30 min) e a confirmação chega **automaticamente por webhook**;
> há reconciliação por cron, novas tentativas quando o código expira e
> estorno quando o admin cancela um Pix pago (`payment_status = refunded`).
> Dinheiro e cartão seguem como descrito. Detalhes: plano
> `100-planejamento/104` e `20-tecnico/31` §2.1.

# Objetivo

Este documento define as formas de pagamento aceitas e suas regras na primeira versão.

---

# Formas de Pagamento

- Pix;
- dinheiro;
- cartão.

O Administrador pode habilitar ou desabilitar cada forma.

---

# Pix

## Funcionamento

1. O Cliente escolhe Pix.
2. O sistema exibe o código Pix copia e cola configurado pela Loja.
3. O Cliente realiza o pagamento fora do sistema.
4. O sistema oferece um botão para abrir o WhatsApp da Loja.
5. O Cliente envia o comprovante manualmente.
6. O Administrador confere o pagamento.
7. O Administrador confirma o Pedido.

## Regras

- o sistema não processa o Pix diretamente;
- o comprovante não precisa ser armazenado na aplicação;
- abrir o WhatsApp não significa pagamento confirmado;
- a validação é manual;
- a automação do pagamento fica fora do escopo inicial.

---

# Dinheiro

O pagamento ocorre no recebimento.

O checkout deve permitir:

- informar que não precisa de troco;
- informar que precisa de troco;
- informar o valor entregue para cálculo do troco.

O valor informado para troco deve ser igual ou superior ao total do Pedido.

---

# Cartão

O pagamento ocorre no recebimento.

Na primeira versão, o sistema apenas registra cartão como forma de pagamento.

O processamento é realizado externamente, no momento da entrega ou retirada.

---

# Registro no Pedido

O Pedido deve registrar:

- forma de pagamento;
- condição de pagamento;
- necessidade de troco;
- valor para troco, quando aplicável;
- estado de conferência manual do Pix, quando aplicável.

---

# Fora do Escopo Inicial

- gateway de pagamento;
- confirmação automática de Pix;
- cartão online;
- estorno automatizado;
- conciliação financeira;
- armazenamento de dados de cartão.
