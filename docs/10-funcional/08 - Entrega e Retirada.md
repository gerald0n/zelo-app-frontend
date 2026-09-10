# 08 - Entrega e Retirada

> Reconciliado com o código em **2026-09-09** (ver `20-tecnico/31` §2.8 e o
> plano `100-planejamento/105`). A área de entrega é um **raio em linha reta**
> a partir da loja; Google Maps é a única stack de mapas (Leaflet/OSM ficaram
> só como fallback de geocodificação).

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

Exige que o endereço esteja dentro do raio de entrega e que o Cliente
confirme a localização no mapa.

---

# Área de Atendimento

A área de entrega é definida por **distância em linha reta** entre a loja e o
endereço do Cliente (fórmula de Haversine — `modules/delivery/geo.ts`). Não há
mais lista de bairros nem cálculo de rota viária.

Três faixas, todas configuráveis no admin (tabela `stores`):

| Faixa        | Regra                                 | Campo                                      |
| ------------ | ------------------------------------- | ------------------------------------------ |
| Grátis       | distância ≤ raio grátis               | `free_delivery_radius_meters`              |
| Taxa fixa    | raio grátis < distância ≤ raio máximo | `fixed_delivery_fee_cents`                 |
| Fora da área | distância > raio máximo               | `max_delivery_radius_meters` (padrão 3 km) |

Endereços fora do raio máximo podem concluir o Pedido apenas por **retirada**.
O `DeliveryQuote` retorna `inServiceArea: false` com uma mensagem indicando a
distância e o limite.

O **bairro** deixou de ser critério de área: agora é um rótulo opcional, útil
como dica para a geocodificação e como referência para o entregador.

---

# Endereço

Para delivery são coletados:

- rua;
- número;
- bairro ou localidade (opcional);
- complemento (opcional);
- ponto de referência (opcional);
- coordenadas;
- confirmação visual da localização no mapa.

## Geocodificação

Ordem de resolução das coordenadas (`modules/delivery/quote.ts`):

1. **Coordenada já informada** — veio do autocomplete (Places API New, via
   `placeId`) ou do pin que o Cliente arrastou no mapa. Precisão sempre `high`.
   Um reverse geocode traz o endereço formatado real do ponto.
2. **Geocoding API do Google** — quando não há coordenada. O filtro
   `components` trava a busca na cidade/UF da loja (sem isso o Google resolve
   "Centro" como Sobral). `location_type` `GEOMETRIC_CENTER`/`APPROXIMATE`
   marca a precisão como `low`.
3. **OpenStreetMap / Nominatim** — fallback quando não há chave do Google.
   Precisão sempre `low`.
4. **Centro de Pereiro-CE** — âncora final quando nada resolve. Precisão `low`
   e a mensagem pede para o Cliente posicionar o pin.

`DeliveryQuote.locationPrecision` (`high` | `low`) alimenta o aviso no
checkout. Para **entrega**, o checkout sempre exige o passo "Confirmar
localização no mapa", independentemente da precisão.

---

# Distância

A distância usada para faixa de taxa e área de atendimento é a **linha reta**
(Haversine) entre a localização cadastrada da Loja e a localização confirmada
pelo Cliente.

O campo do `DeliveryQuote` chama-se `routeDistanceMeters` por compatibilidade
de schema, mas o valor é a distância em linha reta.

---

# Taxa

A taxa não é progressiva: é `0` dentro do raio grátis e o valor fixo
(`stores.fixed_delivery_fee_cents`) entre o raio grátis e o raio máximo. Acima
do raio máximo não há taxa porque não há entrega (só retirada).

O `create_order` recalcula a cotação no servidor e recusa o pedido se a taxa
enviada pelo cliente divergir.

---

# Snapshot

O endereço utilizado é copiado para o Pedido (`orders`), junto com as
coordenadas e a taxa. Mudanças posteriores em endereços salvos não alteram o
histórico.

Na **comanda manual** o admin digita a taxa à mão e não há geocodificação
(ver `20-tecnico/31` §2.6).

---

# Estados por Modalidade

## Delivery

- Pronto para entrega;
- Saiu para entrega;
- Entregue.

## Retirada

- Pronto para retirada;
- Entregue.
