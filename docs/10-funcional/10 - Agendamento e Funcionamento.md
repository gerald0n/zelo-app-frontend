# 10 - Agendamento e Funcionamento

> 🟡 **Incompleto (ago/2026).** Os **horários candidatos de agendamento** são
> configuráveis pelo admin (`stores.schedule_slot_times`, HH:MM) — o app
> filtra cada um pela janela do dia + blackouts. Existe **pausa da loja com
> prazo e motivo** (`paused_until` / `pause_reason`): a regra "loja aberta
> agora" checa `paused_until > now()` antes de `is_open_override` e do
> horário. Ver `20-tecnico/31` §2.9. A regra das 17h segue como descrito.

# Objetivo

Este documento define o comportamento da Loja em relação a horários de funcionamento, pedidos imediatos e agendamentos.

---

# Horário de Funcionamento

O Administrador deve configurar:

- dias de funcionamento;
- horário de abertura;
- horário de fechamento;
- períodos indisponíveis;
- horários permitidos para retirada;
- horários permitidos para delivery.

---

# Loja Aberta

Quando a Loja estiver aberta:

- o catálogo pode ser visualizado;
- pedidos imediatos podem ser realizados;
- pedidos agendados podem ser realizados, se habilitados.

---

# Loja Fechada

Quando a Loja estiver fechada:

- o catálogo continua disponível;
- o Cliente pode montar o Carrinho;
- pedidos imediatos não podem ser confirmados;
- o checkout permite somente agendamento.

---

# Regra de Antecedência

## Até 17h

Pedidos realizados até e incluindo 17:00 podem ser agendados a partir do dia seguinte.

## Após 17h

Pedidos realizados após 17:00 podem ser agendados a partir do segundo dia seguinte.

---

# Exemplos

Pedido realizado na terça-feira às 16:30:

- primeira data possível: quarta-feira.

Pedido realizado na terça-feira às 17:00:

- primeira data possível: quarta-feira.

Pedido realizado na terça-feira às 17:01:

- primeira data possível: quinta-feira.

---

# Validação de Data

A primeira data possível ainda deve respeitar:

- dias de funcionamento;
- horários configurados;
- indisponibilidades da Loja;
- modalidade escolhida.

Datas ou horários indisponíveis não devem aparecer como selecionáveis.

---

# Dados do Pedido Agendado

O Pedido deve registrar:

- indicador de Pedido agendado;
- data e horário desejados;
- data e horário de criação;
- modalidade de entrega;
- fuso horário utilizado.

O fuso horário operacional deve ser consistente em todo o sistema.
