# 05 - Ciclo de Vida do Pedido

# Objetivo

Este documento define os estados de um Pedido, suas transições permitidas e seus significados operacionais.

---

# Estados

## Recebido

O Pedido foi enviado pelo Cliente e registrado pelo sistema.

Ainda aguarda análise e aceitação da Loja.

## Confirmado

O Pedido foi analisado e aceito pela Loja.

Para Pix, este estado pode representar também que o pagamento foi conferido manualmente.

## Em produção

A produção do Pedido foi iniciada.

## Pronto para entrega

A produção foi concluída e o Pedido de delivery está aguardando o início da entrega.

## Pronto para retirada

A produção foi concluída e o Pedido está disponível para retirada pelo Cliente.

## Saiu para entrega

O Pedido de delivery deixou a Loja e está em deslocamento.

## Entregue

O Pedido foi entregue ao Cliente ou retirado na Loja.

É um estado terminal.

## Cancelado

O Pedido foi cancelado pelo Cliente ou pelo Administrador.

É um estado terminal.

---

# Fluxo de Delivery

```text
Recebido
    ↓
Confirmado
    ↓
Em produção
    ↓
Pronto para entrega
    ↓
Saiu para entrega
    ↓
Entregue
```

---

# Fluxo de Retirada

```text
Recebido
    ↓
Confirmado
    ↓
Em produção
    ↓
Pronto para retirada
    ↓
Entregue
```

---

# Transições Permitidas

| Estado atual         | Próximo estado permitido                               |
| -------------------- | ------------------------------------------------------ |
| Recebido             | Confirmado ou Cancelado                                |
| Confirmado           | Em produção ou Cancelado                               |
| Em produção          | Pronto para entrega, Pronto para retirada ou Cancelado |
| Pronto para entrega  | Saiu para entrega ou Cancelado pelo Administrador      |
| Pronto para retirada | Entregue ou Cancelado pelo Administrador               |
| Saiu para entrega    | Entregue ou Cancelado pelo Administrador               |
| Entregue             | Nenhum                                                 |
| Cancelado            | Nenhum                                                 |

---

# Regras por Modalidade

## Delivery

- não pode usar Pronto para retirada;
- deve passar por Pronto para entrega antes de Saiu para entrega;
- deve passar por Saiu para entrega antes de Entregue.

## Retirada

- não pode usar Pronto para entrega;
- não pode usar Saiu para entrega;
- deve passar por Pronto para retirada antes de Entregue.

---

# Cancelamento pelo Cliente

Permitido somente em:

- Recebido;
- Confirmado;
- Em produção.

O motivo é obrigatório.

---

# Cancelamento pelo Administrador

Permitido enquanto o Pedido não estiver:

- Entregue;
- Cancelado.

O motivo é obrigatório.

---

# Histórico

Toda alteração de status deve registrar:

- Pedido;
- status anterior;
- novo status;
- autor da alteração;
- data e hora;
- motivo, quando aplicável.

O histórico não pode ser apagado nem reescrito.

---

# Eventos Correspondentes

- Pedido recebido;
- Pedido confirmado;
- Produção iniciada;
- Pedido pronto para entrega;
- Pedido pronto para retirada;
- Pedido saiu para entrega;
- Pedido entregue;
- Pedido cancelado.
