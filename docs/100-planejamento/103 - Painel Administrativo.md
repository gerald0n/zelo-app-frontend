# 103 — Painel Administrativo

Extraído do `_HANDOFF` em 2026-09-04 pra reduzir o que uma sessão nova
precisa carregar por padrão — só ler este doc quando for mexer em algo do
painel `/admin`.

## Estado

| Bloco | Status |
| --- | --- |
| Kanban de pedidos | **Implementado.** |
| Estoque básico | **Implementado.** |
| Melhorias na tela do pedido | **Implementado.** |
| Comanda manual | **Implementado.** |
| Impressão térmica | Não iniciado — bloqueado por decisão do dono (ver §Decisões em aberto). |
| Catálogo (resto) | Não iniciado, sem decisões pendentes conhecidas. |
| Loja/relatórios | Não iniciado, sem decisões pendentes conhecidas. |
| Push | Não iniciado, sem decisões pendentes conhecidas. |

---

## Kanban de pedidos

- `/admin/pedidos` é um kanban com 3 abas: **Retirada**, **Delivery**
  (colunas por status; as 3 primeiras — `received/confirmed/in_production`
  — são iguais nos dois quadros, a cauda muda pelo método de entrega) e
  **Agenda** (pedidos `timing='scheduled' AND status='received'`, lista
  simples com botão "Passar para produção" — 100% manual, não existe
  "aparece sozinho no quadro no dia").
- Arrastar (`@dnd-kit`, só no quadro desktop) ou o botão "avançar" em cada
  card fazem a mesma transição (`nextAdminStatus` + `POST
  /api/v1/admin/orders/[id]/status`); só aceita mover pra frente. Cancelar é
  um botão que abre um `prompt()` pedindo o motivo (mín. 3 caracteres).
  Avanço é **otimista** no cliente (reverte se a chamada falhar).
- Botão **"Nova comanda"** no header do kanban abre `/admin/pedidos/novo`
  (comanda manual — ver seção própria abaixo).
- Régua de urgência: borda do card muda de cor por minutos parado, usando
  `orders.updated_at` como proxy de "tempo no status atual" (não é exato —
  qualquer update no pedido reseta; ≥15 min aviso, ≥30 min crítico — chute
  razoável, ajustável).
- Indicador "ao vivo" (ponto verde quando o realtime está `subscribed`) +
  bipe (Web Audio API, sem arquivo de som) quando chega um pedido novo (por
  diff de IDs entre fetches do mesmo `scope`).
- Checkbox "Ocultar entregues" tira a coluna `delivered` da vista — é a
  versão simplificada de "recolhível + filtro de foco" (não é colapso por
  coluna individual).
- Cards mostram badge **"Avulso"** quando o pedido é de comanda manual sem
  vínculo com customer (`order.isGuest`).
- Mobile (abaixo de `lg`, 1024px): pills de status + lista de um status por
  vez, sem drag (o card não entra em `DndContext` nesse modo).
- Fetch: quadros usam `scope=all` (200 pedidos mais recentes) filtrados por
  `deliveryMethod` no cliente; Agenda usa `scope=scheduled`.
- Realtime: `useAdminOrdersRealtime` (`src/modules/realtime/hooks.ts`) expõe
  `{ version, status }` — `version` incrementa em qualquer mudança de
  `orders`/`order_status_history` (sem dizer o quê mudou; comparar IDs no
  cliente pra detectar pedido novo), `status` é
  `idle/connecting/subscribed/reconnecting/error`.

**Decisões travadas:**
- Dois quadros (Retirada/Delivery) + painel Agenda separado; agendado não se
  mistura.
- Arrastar e soltar forward-only, sem arrastar entre quadros; botão de
  avançar no card; cancelar = botão no card.
- Régua de urgência (card muda de cor por tempo parado), `updated_at` como
  proxy.
- Celular: um fluxo por vez, em lista.

---

## Estoque básico

- `products.stock_quantity` (integer nullable). `null` = ilimitado/não
  controlado (ex.: bolo sob encomenda); preenchido = quantidade controlada.
- `private.create_order`/`private.create_manual_order` checam
  disponibilidade com `for update` (trava a linha) e decrementam com um
  `UPDATE ... where stock_quantity >= v_qty` que também serve de validação
  atômica final (cobre o caso de duas linhas do mesmo produto no mesmo
  pedido). Estoque zerado → `is_available = false` automaticamente.
- `private.transition_order_status`: ao cancelar, devolve a soma das
  quantidades por produto (agregada) e reativa `is_available` se o estoque
  voltar a ficar > 0.
- Admin: campo "Estoque (deixe vazio para ilimitado)" no formulário de
  produto (`admin/catalogo`) + badge de estoque atual/esgotado na listagem.

**Decisões travadas:**
- Campo único `stock_quantity` nullable em `products` (vazio = ilimitado,
  não um checkbox "controla estoque" separado).
- Estoque zerado marca `is_available = false` (reaproveita a UI existente,
  não esconde o produto do catálogo público).
- Cancelar pedido devolve o estoque debitado e reativa `is_available`.

Migration: `supabase/migrations/20260904180000_product_stock_quantity.sql`.

---

## Melhorias na tela do pedido

`getAdminOrder` já retornava mais dados do que a tela `pedido/[id]/page.tsx`
mostrava. Agora expõe: observação por item, ponto de referência do
endereço, agendamento, troco (`needsChange`/`changeForAmountCents`),
observação do cliente, motivo de cancelamento, histórico de status. Mudança
só de apresentação, sem schema/API nova.

---

## Comanda manual

- `/admin/pedidos/novo`: admin cria pedido pra cliente sem conta (liga,
  aparece na loja, pede por WhatsApp).
- Se o telefone digitado já bater com um `customers.phone_e164` existente,
  o pedido vincula a esse `customer_id` (aparece no histórico do cliente no
  app). Senão fica avulso (`orders.guest_name`/`guest_phone_e164`,
  `orders.customer_id` agora é nullable). `customers.id` continua exigindo
  `auth.users` correspondente — pedido avulso nunca cria linha em
  `customers`.
- `private.create_manual_order(payload)` (RPC nova, admin-only via
  `private.is_admin()`) é uma cópia adaptada de `private.create_order` —
  mesma lógica de preço/promoção/estoque, mas sem `auth.uid()`/carrinho, com
  `payment_method` restrito a `cash`/`card` (Pix fica fora — não dá pra
  gerar cobrança dinâmica sem o checkout do cliente), e opção "já pago" que
  grava `payment_status = 'confirmed'` direto na criação.
- Suporta retirada, entrega (endereço digitado, sem geocodificação — usa
  lat/lng da loja como placeholder e taxa digitada pelo admin) e
  agendamento, igual o pedido normal do cliente.
- UI: `AdminManualOrderItemPicker` (`src/components/admin/`) monta os itens
  a partir do catálogo (`GET /api/v1/admin/catalog`), com seleção de
  adicionais permitidos por produto.

**Decisões travadas:**
- Telefone que já bate com customer existente vincula o pedido; senão fica
  avulso.
- "Já pago" → `payment_status` direto `confirmed`; Pix fora do escopo.
- Botão "Nova comanda" no header do kanban.
- Suporta retirada, entrega e agendamento.

Migration: `supabase/migrations/20260904190000_manual_orders.sql`.

---

## Impressão térmica (não iniciado)

Bloqueada pela decisão de conexão da impressora (ver §Decisões em aberto).
EPSON TM-T20X, comprovante de 80mm, automático a cada pedido + botão
"reimprimir".

Modelo do comprovante:

```
        ZELO CONFEITARIA
     DOCUMENTO NÃO FISCAL
  CNPJ 00.000.000/0001-00 · MEI
  Rua ..., nº ... - Cidade/UF
  Tel/WhatsApp: (00) 00000-0000
--------------------------------
Pedido #123        04/09 14:32
Tipo: ENTREGA
Cliente: Maria Silva
Tel: (85) 9 9999-9999
Endereço: Rua X, 100 - Bairro
Referência: casa amarela
--------------------------------
2x Bolo de chocolate M
   + recheio extra
1x Brigadeiro (cx 12)
--------------------------------
Obs. cliente: sem lactose
--------------------------------
Subtotal:               R$ 90,00
Entrega:                R$  5,00
TOTAL:                  R$ 95,00
Pagamento: Dinheiro
Levar troco para R$ 100,00
--------------------------------
     Obrigado pela preferência!
```

Duas formas de conectar, a decidir quando a impressora chegar:
- **Rede (cabo/Wi-Fi):** impressão automática silenciosa via ePOS-Print
  (recurso próprio da Epson), sem caixa de diálogo.
- **Fallback simples:** modelo em página normal + `imprimir` do navegador →
  sai pela impressora configurada no SO, com janelinha a cada vez.

Config nova necessária: dados do MEI (CNPJ, nome, endereço) e endereço de
rede da impressora, na tela de Configurações. Impressão automática só
funciona com o painel aberto no tablet (mesma tela que fica ligada pro
alerta sonoro do kanban).

---

## Catálogo (resto) (não iniciado)

- **"Acabou" num toque** — tirar/repor um produto sem abrir o formulário
  inteiro.
- **Reordenar produtos e categorias arrastando** — hoje se digita um número
  de ordem.
- **Várias fotos por produto** — hoje só cabe uma; banco já suporta, falta
  a tela (escolher principal, apagar, reordenar).
- **Duplicar produto** — criar "Bolo G" a partir do "Bolo M" sem redigitar
  tudo.

---

## Loja/relatórios (não iniciado)

- **Pausar a loja com tempo e motivo** — "pausar por 1 hora" em vez de
  pausar e esquecer ligado.
- **Configurações em abas** — hoje é uma página só, tudo empilhado (loja,
  horários, pagamento, entrega, conta, auditoria).
- **Faturamento por período** — hoje/semana/mês, nº de pedidos, ticket
  médio, gráfico simples.
- **Resumo de produção do dia** — soma dos itens de todos os pedidos do
  dia ("8 bolos, 3 tortas, 12 doces").
- **Relatório de cancelamentos** — quantos e por quais motivos.
- **Tela de auditoria de verdade** — hoje são linhas cruas no fim de
  Configurações; virar tela com filtro por tipo e período.

---

## Push (não iniciado)

- Notificação no celular quando entra pedido novo, mesmo com o painel
  fechado. Mexe no banco: hoje o envio de notificação só existe pro
  cliente, não pro admin.

---

## Decisões em aberto

1. **Impressora — conexão:** USB no tablet, cabo de rede ou Wi-Fi? Define
   impressão silenciosa × com janelinha. **Bloqueia o início do bloco de
   impressão térmica.**
2. **Nota — dados do MEI:** quais entram (CNPJ, nome empresarial, endereço)?
   Emite NFC-e/NF-e hoje ou é só comprovante interno?
