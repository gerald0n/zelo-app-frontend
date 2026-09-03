-- Reconciliação de pagamentos Pix pendentes — agendamento via Supabase Cron.
--
-- Substitui o Vercel Cron (que exigiria plano Pro para rodar mais de 1x/dia).
-- O job apenas dispara um POST na rota do app; toda a lógica continua em
-- `src/app/api/v1/cron/reconcile-pix/route.ts` (consulta o Mercado Pago,
-- confirma pedidos cujo webhook se perdeu e expira os Pix vencidos).
--
-- NÃO é uma migração: rode UMA VEZ, à mão, no SQL Editor do projeto de
-- PRODUÇÃO (`zelo-app`). Não deve rodar em local nem no preview — senão esses
-- bancos ficam batendo na URL de produção a cada 10 min.
--
-- Pré-requisito: a env var `CRON_SECRET` já setada na Vercel (a rota usa ela
-- para validar o header). Use o MESMO valor no segredo do Vault abaixo.

-- 1. Extensões (idempotente).
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 2. Segredos no Vault — evita deixar o token em texto puro em `cron.job`.
--    Troque <CRON_SECRET> pelo valor real de produção.
select vault.create_secret(
  'https://cardapio.zeloconfeitaria.com.br/api/v1/cron/reconcile-pix',
  'reconcile_pix_url',
  'URL da rota de reconciliação Pix (chamada pelo pg_cron)'
);
select vault.create_secret(
  '<CRON_SECRET>',
  'reconcile_pix_secret',
  'Bearer token compartilhado com a rota de reconciliação Pix'
);

-- 3. Agenda: a cada 10 minutos.
select cron.schedule(
  'reconcile-pix',
  '*/10 * * * *',
  $$
  select net.http_post(
    url => (
      select decrypted_secret from vault.decrypted_secrets
      where name = 'reconcile_pix_url'
    ),
    headers => jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets
        where name = 'reconcile_pix_secret'
      )
    ),
    body => '{}'::jsonb,
    timeout_milliseconds => 55000
  );
  $$
);

-- ---------------------------------------------------------------------------
-- Operação
--
-- Ver execuções do job:
--   select * from cron.job_run_details
--   where jobid = (select jobid from cron.job where jobname = 'reconcile-pix')
--   order by start_time desc limit 20;
--
-- Ver a resposta HTTP de cada disparo (status, corpo):
--   select * from net._http_response order by created desc limit 20;
--
-- Trocar o intervalo (re-agenda com o mesmo nome):
--   select cron.schedule('reconcile-pix', '*/5 * * * *', $$ ... $$);
--
-- Desligar:
--   select cron.unschedule('reconcile-pix');
--
-- Rotacionar o segredo (mantém o mesmo da Vercel):
--   select vault.update_secret(
--     (select id from vault.secrets where name = 'reconcile_pix_secret'),
--     '<novo CRON_SECRET>'
--   );
