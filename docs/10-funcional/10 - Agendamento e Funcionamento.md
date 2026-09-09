# 10 - Agendamento e Funcionamento

> ⚠️ **Reescrito em 09/09/2026** (PR #98 — em revisão, ainda não em
> produção). O agendamento deixou de usar uma **lista fixa de horários**
> (`stores.schedule_slot_times`, removida) e passou a ser **derivado** da
> janela de funcionamento do dia + de **regras por categoria** (colunas
> novas em `public.categories`, migração `20260909140000`). A antiga "regra
> das 17h" foi substituída pelas regras de categoria. Toda a lógica de
> "hoje"/"agora" passou a raciocinar no **fuso da loja** (`stores.timezone`),
> não na hora do servidor. Ver `20-tecnico/31` §2.9. Lógica em
> `packages/shared/src/modules/scheduling/`.

# Objetivo

Este documento define o comportamento da Loja em relação a horários de
funcionamento, pedidos imediatos e agendamentos.

---

# Horário de Funcionamento

O Administrador configura, por dia da semana:

- se o dia está aberto ou fechado;
- horário de abertura e de fechamento;
- se aquele dia aceita entrega e/ou retirada;
- períodos bloqueados pontuais (blackouts, com data/hora de início e fim);
- pausa da loja "até tal hora" (`paused_until` / `pause_reason`).

O Administrador **não** configura mais uma lista de horários de agendamento
— ela é derivada (ver "Agendamento").

A regra "loja aberta agora" checa, nesta ordem: `paused_until > now()` →
`is_open_override` → o horário do dia no fuso da loja.

---

# Loja Aberta

Quando a Loja estiver aberta:

- o catálogo pode ser visualizado;
- pedidos imediatos ("Agora") podem ser realizados;
- pedidos agendados podem ser realizados.

---

# Loja Fechada

Quando a Loja estiver fechada:

- o catálogo continua disponível;
- o Cliente pode montar o Carrinho;
- pedidos imediatos não podem ser confirmados;
- o checkout permite somente agendamento.

## "Agora" antes do primeiro horário do dia

Se o dia de hoje está **aberto** na agenda, mas o horário atual ainda é
**anterior à abertura** (ex.: a loja abre 19:00 e são 17:00), o botão
"Agora" fica **desabilitado** e o checkout mostra "Hoje HH:MM" (o horário de
abertura). Só o agendamento fica disponível. Isso vale **mesmo com a loja
forçada como aberta no painel** (`is_open_override = true`) — "Agora" exige
estar dentro da janela real do dia.

---

# Agendamento

Os dias e horários oferecidos no checkout "Agendar" são **calculados** a
partir de:

1. a **janela de funcionamento** do dia (abertura/fechamento, modalidade);
2. a **regra de agendamento da categoria** dos itens do carrinho;
3. os **períodos bloqueados** (blackouts).

O horário de **fechamento é o limite** e entra na lista (inclusivo): se a
loja fecha 22:00, "22:00" é um horário selecionável.

## Regra de agendamento por categoria

Cada categoria carrega (editável no admin, aba Catálogo → Categorias):

| Campo                              | Significado                                                                  |
| ---------------------------------- | ---------------------------------------------------------------------------- |
| Permite mesmo dia                  | `false` = nunca hoje; só a partir de amanhã                                  |
| Antecedência p/ liberar hoje (min) | a agenda de hoje só "abre" quando falta no máximo esse tempo para a abertura |
| Horário mínimo (seg–sex)           | piso de horário nos dias de semana (nunca antes da abertura)                 |
| Horário mínimo (sáb–dom)           | piso de horário no fim de semana                                             |
| Intervalo entre horários (min)     | passo entre os horários oferecidos                                           |

**Padrão de categoria nova** (comportamento "cookie"): permite mesmo dia,
antecedência 120 min, sem piso, intervalo de 30 min.

### Como os horários de hoje são montados

- **Antes da abertura:** se falta mais que a "antecedência" para abrir → hoje
  não aparece. Dentro da janela de antecedência → o primeiro horário é a
  abertura, seguindo de intervalo em intervalo até o fechamento.
- **Dentro do expediente:** o primeiro horário é o **próximo bloco cheio**
  (múltiplo do intervalo) depois de agora. Ex.: intervalo 30 min, agora
  19:15 → primeiro horário 19:30.
- **Dias futuros:** do piso (abertura ou horário mínimo, o que for maior) até
  o fechamento, de intervalo em intervalo.

### Exemplos

Categoria com abertura 19:00, fechamento 22:00, antecedência 120 min,
intervalo 30 min:

- pedido às 17:15 → hoje: 19:00, 19:30, 20:00, …, 22:00;
- pedido às 10:00 → hoje **não** aparece (mais de 2 h antes de abrir);
- pedido às 19:15 → hoje: 19:30, 20:00, …, 22:00.

Categoria "pudins": não permite mesmo dia; horário mínimo 17:00 (semana) /
10:00 (fim de semana); intervalo de 1 h. Um agendamento para quinta →
17:00, 18:00, …; para sábado → 10:00, 11:00, ….

## Carrinho misto

Se o carrinho tem itens de **categorias com regras de agendamento
diferentes** (ex.: cookies + pudins), o pedido é **bloqueado**: o checkout
mostra um aviso, o botão "Continuar" fica travado e a criação do pedido é
recusada no servidor. O Cliente separa em pedidos distintos.

---

# Validação de Data

Datas e horários indisponíveis não aparecem como selecionáveis. A validação
na criação do pedido usa exatamente a mesma função que monta as opções, então
data/horário fora da regra são recusados.

---

# Dados do Pedido Agendado

O Pedido registra:

- indicador de Pedido agendado;
- data e horário desejados;
- data e horário de criação;
- modalidade de entrega.

O fuso horário operacional (`stores.timezone`, ex.: `America/Fortaleza`) é
usado de forma consistente em todo o cálculo de agenda, no servidor e no
cliente.
