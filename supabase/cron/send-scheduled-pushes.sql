-- Disparo de push notification agendados — agendamento via Supabase Cron.
--
-- O job apenas dispara um POST na rota do painel admin; toda a lógica
-- continua em `apps/admin/src/app/api/v1/cron/send-scheduled-pushes/route.ts`
-- (busca modelos com status='scheduled' vencidos, trava cada um com update
-- condicional e dispara via broadcastCustomerPush).
--
-- NÃO é uma migração: rode UMA VEZ, à mão, no SQL Editor do projeto de
-- PRODUÇÃO (`zelo-app`). Não deve rodar em local nem no preview — senão esses
-- bancos ficam batendo na URL de produção a cada minuto.
--
-- Pré-requisito: a env var `CRON_SECRET` já setada na Vercel (mesmo valor
-- usado pelo reconcile-pix — a rota valida o mesmo header). Use o MESMO
-- valor no segredo do Vault abaixo.

-- 1. Extensões (idempotente — já devem existir por causa do reconcile-pix).
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 2. Segredo da URL no Vault (o segredo do CRON_SECRET já existe como
--    `reconcile_pix_secret` — reaproveita, não duplica).
select vault.create_secret(
  'https://admin.zeloconfeitaria.com.br/api/v1/cron/send-scheduled-pushes',
  'send_scheduled_pushes_url',
  'URL da rota de disparo de push agendado (chamada pelo pg_cron)'
);

-- 3. Agenda: a cada 1 minuto (push agendado precisa de precisão de minuto).
select cron.schedule(
  'send-scheduled-pushes',
  '* * * * *',
  $$
  select net.http_post(
    url => (
      select decrypted_secret from vault.decrypted_secrets
      where name = 'send_scheduled_pushes_url'
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
--   where jobid = (select jobid from cron.job where jobname = 'send-scheduled-pushes')
--   order by start_time desc limit 20;
--
-- Ver a resposta HTTP de cada disparo (status, corpo):
--   select * from net._http_response order by created desc limit 20;
--
-- Desligar:
--   select cron.unschedule('send-scheduled-pushes');
