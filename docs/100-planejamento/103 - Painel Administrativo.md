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
| Impressão térmica | **Implementado e validado em hardware** (WebUSB/USB, EPSON TM-T20X — 2026-09-08). |
| Catálogo (resto) | **Feito** (2026-09-08). "Acabou num toque", duplicar produto, várias fotos por produto e reordenar (produtos + categorias, setas ↑/↓). |
| Loja/relatórios | Não iniciado, sem decisões pendentes conhecidas. |
| Push | Não iniciado, sem decisões pendentes conhecidas. |

---

## Kanban de pedidos

> Reescrito em 2026-09-06. A versão antiga usava `@dnd-kit` e tinha 3 abas
> (Retirada / Delivery / Agenda como painel à parte). Hoje o pacote de
> drag-and-drop foi **removido** do repo — o arraste é feito à mão com
> eventos de ponteiro.

- **Arquivos** (no app `apps/admin`): tela em `src/app/pedidos/page.tsx`;
  quadro desktop `src/components/admin/kanban/AdminKanbanBoard.tsx`; lista
  mobile `AdminKanbanMobile.tsx`; card compartilhado `AdminOrderCardBody.tsx`;
  coluna `KanbanColumn.tsx`; modelo do quadro `src/lib/admin/kanban-board.ts`
  (+ `src/lib/admin/order-columns.ts` para a ordem das colunas).
- **Duas raias paralelas** (`LaneKey = 'pickup' | 'delivery'`), ambas sempre
  visíveis, empilhadas no desktop. Não existe mais aba/painel "Agenda": o
  pedido agendado ainda não iniciado (`timing==='scheduled' && status==='received'`)
  aparece numa **coluna sintética "Agendados"** — a primeira de cada raia,
  com cor própria (`tone-info`). Ele "gradua" para o pipeline normal quando
  confirmado.
- **Pipeline por raia** (`BOARD_COLUMNS`): as 3 primeiras colunas são iguais
  (`received / confirmed / in_production`); a cauda muda —
  Retirada: `ready_for_pickup → delivered`;
  Delivery: `ready_for_delivery → out_for_delivery → delivered`, mas
  `ready_for_delivery` é **apelidado** para a coluna `out_for_delivery`
  (`COLUMN_ALIAS`), ou seja "Pronto para entrega" não tem coluna própria no
  visual — o card salta de "Em produção" para "Saiu para entrega".
- **Arraste feito à mão** (sem lib), só no quadro desktop: `onPointerDown`
  no card inteiro → após um limiar de 8px (`DRAG_THRESHOLD`) o card "levanta"
  num clone renderizado via portal no `<body>` e segue o cursor. Botões,
  links e inputs dentro do card não iniciam arraste (`INTERACTIVE`). Um clique
  curto (sem passar o limiar) abre o modal de detalhes.
- **Avanço de um passo só.** Arrastar e soltar **na coluna imediatamente
  seguinte da mesma raia** confirma a transição — qualquer outro destino
  devolve o card ao lugar. O alvo é sempre `nextAdminStatus(from, deliveryMethod)`.
  Cards na coluna "Agendados" (ou sem próximo status) não são arrastáveis.
- O botão "avançar" no rodapé de cada card faz a **mesma** transição
  (`nextAdminStatus`). Cancelar é um botão que abre um diálogo
  (`useAppDialog().prompt`, mín. 3 caracteres) → `POST
  /api/v1/admin/orders/[id]/cancel`. Avançar → `POST
  /api/v1/admin/orders/[id]/status`. O avanço é **otimista**
  (`optimisticStatus` no `page.tsx`, reverte se a chamada falhar).
- **"Nova comanda"** não fica mais no header do quadro: no desktop é um item
  da **sidebar** (`AdminSidebar` → `useNewOrder().open`); no mobile é um FAB
  (`+`) fixo no canto (`lg:hidden`). Abre o modal, não navega para uma rota.
- **Pausar/retomar a loja** saiu do `/admin` e virou `AdminStoreToggle` na
  sidebar (`AdminPageTitle` substituiu o antigo `AdminHeader`).
- Régua de urgência: borda do card muda de cor por minutos desde
  `orders.updated_at` (proxy de "tempo no status atual"; qualquer update
  reseta). `src/lib/admin/order-urgency.ts`: ≥15 min `warning`, ≥30 min
  `critical`; estados terminais (`delivered`/`cancelled`) nunca ficam urgentes.
  O card também mostra "há N min" quando ≥15.
- Realtime: canal único compartilhado via `AdminRealtimeContext`
  (`useAdminRealtime()` → `{ version, status }`), aberto uma vez no provider;
  a sidebar mostra o status "Ao vivo". `version` incrementa em qualquer
  mudança de `orders`/`order_status_history` (sem dizer o quê) e entra na
  query key do quadro para forçar refetch. O `page.tsx` compara os IDs entre
  fetches para tocar o bipe de pedido novo (`playNewOrderChime`, Web Audio,
  sem arquivo) e disparar a impressão automática (ver §Impressão térmica).
- Fetch: o quadro usa sempre `scope=all` (200 pedidos mais recentes) e separa
  por `deliveryMethod` no cliente (`laneOf`). Busca (`q`) por número/cliente/
  produto entra no mesmo endpoint.
- Checkbox "Ocultar entregues" remove a coluna `delivered` da vista
  (`columnsForLane(lane, hideDelivered)`).
- Card mostra `· Avulso` ao lado do nome quando o pedido é de comanda manual
  sem `customer` (`order.isGuest`), e um selo "Aguardando Pix" quando
  `isAwaitingPixPayment(order)`.
- Mobile (`AdminKanbanMobile`, abaixo de `lg`): escolhe a raia (segmented),
  depois a coluna (pills com contagem), lista os cards — sem arraste, avanço
  só pelo botão.

**Decisões travadas:**
- Duas raias (Retirada/Delivery) sempre visíveis; "Agendados" é coluna, não
  painel separado; agendado gradua para o pipeline ao ser confirmado.
- Sem biblioteca de drag-and-drop — arraste próprio com eventos de ponteiro
  + clone em portal.
- Arrastar é forward-only, um passo, dentro da mesma raia; botão de avançar
  no card faz o mesmo; cancelar = botão no card com diálogo de motivo.
- Régua de urgência por `updated_at`; ≥15 aviso / ≥30 crítico.
- Celular: um fluxo por vez, em lista, sem arraste.
- "Nova comanda" e o toggle da loja vivem na sidebar (desktop) / FAB
  (mobile), não num header do quadro.

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

## Impressão térmica

EPSON TM-T20X, bobina de 80mm (48 colunas em Font A). Conexão decidida:
**USB direto via WebUSB** (Chrome/Edge; não existe em Safari/Firefox). Sem
impressora de rede, então ePOS-Print não se aplica.

- `src/modules/printing/`:
  - `webusb-printer.ts` — wrapper da WebUSB: `isWebUsbSupported`,
    `findPairedPrinter` (pareamento persiste por origem), `requestPrinterPairing`
    (tem que ser chamado direto de um clique, sem `await` antes na cadeia) e
    `printBytes` (abre → `transferOut` → fecha; não segura a interface entre
    impressões).
  - `escpos.ts` — `ReceiptBuilder`, primitivos ESC/POS. `init()` manda
    `ESC @` + `ESC t 16` (code page WPC1252 / Windows-1252); o texto é
    codificado "code point → byte" (Latin-1), acento fora disso vira `?`.
  - `receipts.ts` — `buildKitchenTicket`, `buildDeliverySlip`, `buildTestPrint`.
  - `src/lib/admin/receipt.ts` — converte `AdminOrderDetail` (+ `CatalogStore`)
    nos DTOs de impressão.
- `PrinterContext` (`src/contexts/PrinterContext.tsx`), provider em
  `admin/layout.tsx`: expõe `{ status, pair, printRaw }` com status
  `unsupported | unpaired | ready | error`. Re-detecta a impressora nos
  eventos `connect`/`disconnect` da WebUSB.
- Parear + "imprimir teste" ficam na tela de Configurações (seção
  "Impressora térmica").
- Impressão automática (só com o painel aberto, mesmo tablet do alerta
  sonoro): o kanban (`admin/pedidos/page.tsx`) compara os fetches do mesmo
  `scope` e, com a impressora `ready`, imprime a **comanda** de todo pedido
  novo e o **comprovante** quando um pedido passa pra `ready_for_delivery`/
  `ready_for_pickup`. Toda falha é silenciosa — nunca trava o quadro.
- Reimprimir: botões "Reimprimir comanda" / "Reimprimir pedido" na tela do
  pedido (`admin/pedido/[id]/page.tsx`).
- Dados do MEI no comprovante: só **CNPJ** (campo novo `stores.cnpj`,
  nullable — migration `20260905120000_store_cnpj.sql`; editável em
  Configurações). Nome/endereço/telefone reaproveitam os campos que já
  existiam. Não emite NFC-e/NF-e — é comprovante interno ("DOCUMENTO NÃO
  FISCAL").
- Dep nova: `@types/w3c-web-usb` (devDependency; os arquivos usam
  `/// <reference types="w3c-web-usb" />`).

**Pendências:** nenhuma. Validado em hardware em 2026-09-08 (EPSON TM-T20X):
corte (`GS V 1`), largura de 48 col, acentuação (WPC1252) e endpoint
bulk-out OK.

**Decisões travadas:**
- Conexão: USB via WebUSB (sem rede/ePOS-Print).
- Dados do MEI: só CNPJ; comprovante interno, sem nota fiscal.
- Automático com painel aberto + botão de reimpressão; falha de impressão
  nunca bloqueia o fluxo.

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

> Histórico: a conexão chegou a ter duas opções em aberto (rede via
> ePOS-Print × fallback de impressão do navegador). **Decidido: USB via
> WebUSB** — ver §Impressão térmica acima. Impressão automática só funciona
> com o painel aberto no tablet (mesma tela que fica ligada pro alerta
> sonoro do kanban).

---

## Catálogo (resto) (em andamento — iniciado 2026-09-08)

Tela: `apps/admin/src/app/catalogo/` (abas `_tabs/*`), módulos em
`src/modules/admin/catalog/*`.

- **"Acabou" num toque** — ✅ **feito** (já vinha da fase do estoque). Toggle
  `Disponível` (`role="switch"`) em cada card do grid e linha da lista
  (`ProductGridCard` / `ProductListRow` → `patchMutation` com
  `isAvailable`), pausar/retomar em lote (`ProductBulkBar`) e filtro
  "Pausados / Estoque baixo" (`ProductToolbar`). Nada mais a fazer aqui.
- **Reordenar produtos e categorias** — ✅ **feito** (2026-09-08). Setas ↑/↓
  (não arraste — melhor no tablet; o repo não tem lib de DnD).
  - Backend: `src/modules/admin/catalog/reorder.ts` — `reorderAdminProducts`
    / `reorderAdminCategories` recebem a **lista completa** de ids na ordem
    desejada e gravam `sort_order` 0..n; `PUT /api/v1/admin/products` e `PUT
    /api/v1/admin/categories`. Lista que não bate com os registros ativos →
    400. Audit `product.reorder` / `category.reorder`.
  - **Categorias** (`CategoriesTab`): setas ↑/↓ em cada linha, sempre
    visíveis (a lista já é a ordem). Tirei o "Ordem N" do texto da linha.
  - **Produtos** (`ProductsTab` + `ProductCollection` + `ProductListRow`):
    aparece a opção **"Ordenar: Manual"** (`sort='manual'` → ordena por
    `sortOrder`). Com ela ativa **na visão em lista**, cada linha ganha
    ↑/↓; na visão em grade sai um aviso pra trocar pra lista.
  - Mover dentro de um filtro de categoria troca a posição com o **vizinho
    visível**, mas o cliente manda a lista global inteira
    (`product-reorder.ts:reorderedProductIds`) pro backend não embaralhar as
    outras categorias.
  - Nota: a 1ª reordenação normaliza os `sort_order` (o seed tinha valores
    repetidos entre categorias) — a ordem exibida não muda.
- **Várias fotos por produto** — ✅ **feito** (2026-09-08). Galeria
  (`ProductImagesManager`) no topo do modal de edição do produto: lista
  todas as fotos, botão "Adicionar" (mesmo fluxo de recorte 1:1), estrela
  para definir a principal, lixeira para apagar, setas ← → para reordenar.
  Endpoints novos: `PUT /api/v1/admin/products/[id]/images` (`{ orderedIds }`
  → `reorderProductImages`) e `PATCH .../images/[imageId]` (`{ isPrimary:
  true }` → `setPrimaryProductImage`; desmarca a principal antiga antes por
  causa do índice único parcial). Upload da galeria/card **não** força mais
  `isPrimary` — só vira principal se for a 1ª foto. O modal deriva o produto
  em edição da lista (`editingProductId`), então a galeria reflete cada
  mutação sem estado stale.
  - Nota de UX: `mapAdminImages` (e o mapper do storefront) sempre ordena
    a **principal primeiro**, depois por `sort_order`. Então a galeria fixa
    a principal na 1ª posição e as setas reordenam o resto ao redor dela —
    consistente com o que o cliente vê na loja. Se um dia quiserem ordem
    livre com a principal só marcada por selo, é aqui que muda.
- **Duplicar produto** — ✅ **feito** (2026-09-08). `duplicateAdminProduct`
  (`src/modules/admin/catalog/products.ts`) → `POST
  /api/v1/admin/products/[id]/duplicate`. Copia nome "X (cópia)", categoria,
  preço, peso, estoque e adicionais; **não** copia imagens (evita duplicar
  arquivos no storage). A cópia nasce **pausada** (`is_available = false`) e
  com `sort_order` do original + 1. Botão de copiar (ícone `Copy`) no card do
  grid e na linha da lista (`duplicateMutation` em `useProductMutations.ts`).

**As 4 frentes do "Catálogo (resto)" estão feitas.** Próximo bloco do 103:
loja/relatórios ou push (nenhum iniciado).

**Testado em 2026-09-08** contra o Supabase local (rotas HTTP reais + DB +
storage), logado como `admin@zeloconfeitaria.com.br`:
- Duplicar: cópia com nome "… (cópia)", `is_available=false`, `sort_order`
  do original + 1, adicionais copiados, sem imagens; audit `product.duplicate`
  gravado.
- Definir principal: troca a principal, mantém exatamente 1; imagem de
  outro produto → 404.
- Reordenar imagens: grava `sort_order` 0..n na ordem enviada; lista que não
  bate → 400.
- Apagar imagem: remove a linha **e** o objeto no storage; se era a
  principal, promove a de menor `sort_order`.
- Upload: 1ª foto do produto vira principal; nas seguintes entra como não
  principal no fim.
- Reordenar produtos e categorias: `PUT` regrava `sort_order` 0..n; lista
  incompleta → 400; mover dentro de um filtro de categoria não mexe nas
  outras (helper `reorderedProductIds` testado à parte).

Pegadinha de ambiente encontrada: `supabase/config.toml` tinha
`[auth.email] enable_signup = false`, e o CLI do Supabase usa esse flag pra
ligar/desligar o **provider de e-mail inteiro** → login por senha do admin
não funcionava em local ("Email logins are disabled"). Mudado pra `true`
(cadastro novo continua bloqueado pelo `[auth] enable_signup = false`).

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

Nenhuma no momento. (Impressão térmica: conexão e dados do MEI decididos —
ver §Impressão térmica.)
