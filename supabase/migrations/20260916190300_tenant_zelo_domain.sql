-- White label — Fase B (ADR-0001): domínio da Zelo real, para o proxy
-- (apps/client/src/proxy.ts e apps/admin/src/proxy.ts) resolver o tenant por
-- hostname. Sem isso, toda request cai no fallback (loja mais antiga) — que
-- hoje é a mesma loja, então não muda nada; isso só torna a resolução por
-- hostname correta explicitamente para o domínio real.
--
-- Idempotente: só afeta a loja que ainda não tem domain.

update public.stores
set domain = 'cardapio.zeloconfeitaria.com.br'
where domain is null
  and id = (select id from public.stores order by created_at limit 1);
