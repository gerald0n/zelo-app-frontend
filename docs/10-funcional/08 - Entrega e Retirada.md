# 08 - Entrega e Retirada

# Objetivo

Este documento define as modalidades de recebimento do Pedido e as regras da área de atendimento.

---

# Modalidades

## Retirada

O Cliente retira o Pedido na localização da Loja.

Não exige endereço de entrega.

Não possui taxa de entrega.

## Delivery

O Pedido é entregue em um endereço confirmado pelo Cliente.

Exige validação da área atendida e cálculo da distância.

---

# Área de Atendimento

O delivery está disponível em toda a área urbana da cidade de Pereiro.

Não são atendidos:

- distritos;
- sítios;
- comunidades rurais;
- localidades fora da sede urbana.

Endereços fora da área atendida podem concluir o Pedido apenas por retirada.

---

# Estratégia Recomendada

A validação deve combinar:

1. confirmação geográfica do endereço;
2. verificação da localidade atendida;
3. cálculo da rota viária.

Na primeira versão, a aplicação pode manter uma lista explícita de bairros e localidades urbanas atendidas.

Posteriormente, essa validação pode ser reforçada com um polígono geográfico da área de atendimento.

---

# Endereço

Para delivery, devem ser coletados:

- rua;
- número;
- bairro ou localidade;
- complemento opcional;
- ponto de referência;
- coordenadas;
- confirmação visual da localização.

Quando o endereço automático estiver impreciso, o Cliente deve poder ajustar a localização no mapa.

---

# Distância

A distância deve ser calculada por rota viária.

A origem é a localização cadastrada da Loja.

O destino é a localização confirmada pelo Cliente.

A distância em linha reta não deve ser utilizada para cobrança.

---

# Taxa

| Distância por rota |    Taxa |
| ------------------ | ------: |
| Até 2 km           | R$ 0,00 |
| Acima de 2 km      | R$ 5,00 |

A taxa é fixa e não progressiva.

---

# Snapshot

O endereço utilizado deve ser copiado para o Pedido.

Mudanças posteriores em endereços salvos não podem alterar o histórico.

---

# Estados por Modalidade

## Delivery

- Pronto para entrega;
- Saiu para entrega;
- Entregue.

## Retirada

- Pronto para retirada;
- Entregue.
