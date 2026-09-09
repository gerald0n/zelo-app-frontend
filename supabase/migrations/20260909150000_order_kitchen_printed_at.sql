-- Fila de impressão resiliente das comandas de cozinha.
--
-- `kitchen_printed_at` é a fonte da verdade "a comanda desta ordem já saiu na
-- impressora térmica". O painel enfileira a impressão de todo pedido novo; se
-- a impressora estiver desconectada, a fila (persistida no navegador) segura
-- os jobs e imprime tudo, um a um, quando ela volta. Ao reabrir o painel com
-- a impressora já pronta, ele busca os pedidos ainda com este campo nulo e
-- reenfileira — cobre o caso do tablet/app fechado quando o pedido entrou.
--
-- Só marca depois da impressão confirmada (transferOut sem erro), então uma
-- falha no meio nunca "perde" a comanda: ela continua nula e volta pra fila.

alter table public.orders
  add column if not exists kitchen_printed_at timestamptz;

-- Backfill: todo pedido existente conta como "já impresso". Sem isto, o
-- primeiro load pós-deploy tentaria imprimir o histórico inteiro do quadro.
update public.orders
set kitchen_printed_at = coalesce(paid_at, created_at)
where kitchen_printed_at is null;

-- A varredura de "pendentes de impressão" filtra por este predicado; o índice
-- parcial a mantém barata mesmo com a tabela crescendo.
create index if not exists orders_kitchen_unprinted_idx
  on public.orders (created_at)
  where kitchen_printed_at is null;
