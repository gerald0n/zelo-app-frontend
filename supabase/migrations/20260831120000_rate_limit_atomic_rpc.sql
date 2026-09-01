-- Rate limit atômico: elimina o race "conta e depois insere" do app.
-- Uma chamada, um lock por bucket, expiração e contagem no mesmo lugar.

create or replace function public.consume_rate_limit(
  p_bucket text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if p_limit <= 0 or p_window_seconds <= 0 then
    raise exception 'consume_rate_limit: limit e window devem ser positivos';
  end if;

  -- Serializa chamadas concorrentes do mesmo bucket (mesmo IP+ação).
  perform pg_advisory_xact_lock(hashtextextended(p_bucket, 0));

  delete from public.http_rate_limits
  where bucket = p_bucket
    and created_at < now() - make_interval(secs => p_window_seconds);

  select count(*) into v_count
  from public.http_rate_limits
  where bucket = p_bucket;

  if v_count >= p_limit then
    return false;
  end if;

  insert into public.http_rate_limits (bucket) values (p_bucket);
  return true;
end;
$$;

revoke all on function public.consume_rate_limit(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, integer, integer)
  to service_role;

comment on function public.consume_rate_limit(text, integer, integer) is
  'Registra um hit e devolve true se o bucket ainda está dentro do limite na janela.';

-- Limpeza de buckets abandonados (IPs que bateram uma vez e sumiram).
-- A expiração por bucket em consume_rate_limit já mantém buckets ativos
-- enxutos; isto varre o resto. Agende via Supabase (pg_cron / Scheduled
-- Functions); sem agendamento, rodar manualmente não faz mal.
create or replace function public.purge_rate_limits(
  p_older_than interval default interval '1 day'
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  delete from public.http_rate_limits
  where created_at < now() - p_older_than;
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.purge_rate_limits(interval)
  from public, anon, authenticated;
grant execute on function public.purge_rate_limits(interval) to service_role;
