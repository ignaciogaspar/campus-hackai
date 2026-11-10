-- Endurecimiento de seguridad. Idempotente: se puede volver a correr.
--
-- 1. RLS en assignment_settings (0137 la creó sin RLS) y fuera todos los
--    permisos de anon/authenticated sobre public: el campus solo accede a
--    datos con el service role desde el servidor.
-- 2. Canales Realtime privados: los clientes (anon key) pueden LEER los
--    broadcasts de la clase pero nunca escribir. Sin política de insert, un
--    cliente no puede inyectar eventos falsos (state, overlay, draw…).
-- 3. Throttling de ingresos y rate limits (PIN de alumno, código del
--    profesor, encuestas de invitados, rediseño con IA).
-- 4. people.session_version: para revocar sesiones (logout, reset de PIN).

-- ---------- 1. permisos ----------
alter table if exists public.assignment_settings enable row level security;

do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

revoke execute on function public.live_insert_deck_slide(text, int, uuid) from public, anon, authenticated;
revoke execute on function public.authoring_search_slides(text, text, text, uuid, text, int, int) from public, anon, authenticated;
do $$
begin
  -- la firma vieja (2 args) puede no existir si ya se aplicó 0141
  if to_regprocedure('public.authoring_set_deck_order(text, uuid[])') is not null then
    revoke execute on function public.authoring_set_deck_order(text, uuid[]) from public, anon, authenticated;
  end if;
end $$;

-- ---------- 2. Realtime: solo lectura para los clientes ----------
-- Topics: `live:<id>` (proyector y celulares) y `liveprof:<id>:<firma>`
-- (consola del profesor: transcripción, agente, sorteos). El segundo no se
-- puede adivinar: la firma es un HMAC con SESSION_SECRET.
drop policy if exists campus_live_read on realtime.messages;
create policy campus_live_read on realtime.messages
  for select to anon, authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and (realtime.topic() like 'live:%' or realtime.topic() like 'liveprof:%')
  );
-- Sin políticas de insert/update/delete: los clientes no pueden emitir.

-- ---------- 3. throttling ----------
create table if not exists auth_throttle (
  key text primary key,                        -- 'pin:<personId>', 'ip:<ip>:alumno', 'prof:ip:<ip>'…
  failures int not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);
alter table auth_throttle enable row level security;

create table if not exists rate_hits (
  key text primary key,
  window_start timestamptz not null default now(),
  hits int not null default 0
);
alter table rate_hits enable row level security;

-- Hasta cuándo está bloqueada una clave (null = libre).
create or replace function security_throttle_status(p_key text)
returns timestamptz
language sql
stable
as $$
  select locked_until from auth_throttle where key = p_key and locked_until > now();
$$;

-- Suma un fallo. A partir de p_free fallos bloquea con backoff exponencial
-- (1, 2, 4, 8… minutos, tope p_max_minutes). Los fallos se olvidan a las 24 h.
create or replace function security_throttle_fail(p_key text, p_free int default 5, p_max_minutes int default 60)
returns timestamptz
language plpgsql
as $$
declare
  v_fail int;
  v_lock timestamptz;
begin
  insert into auth_throttle as a (key, failures, updated_at) values (p_key, 1, now())
  on conflict (key) do update set
    failures = case when a.updated_at < now() - interval '24 hours' then 1 else a.failures + 1 end,
    updated_at = now()
  returning failures into v_fail;
  if v_fail >= p_free then
    v_lock := now() + make_interval(mins => least(p_max_minutes, (2 ^ least(v_fail - p_free, 12))::int));
    update auth_throttle set locked_until = v_lock where key = p_key;
  end if;
  return v_lock;
end;
$$;

create or replace function security_throttle_clear(p_key text)
returns void
language sql
as $$
  delete from auth_throttle where key = p_key;
$$;

-- Ventana fija: true si la clave todavía tiene cupo (y suma un hit).
create or replace function security_rate_hit(p_key text, p_window_seconds int, p_max int)
returns boolean
language plpgsql
as $$
declare
  v_hits int;
begin
  insert into rate_hits as r (key, window_start, hits) values (p_key, now(), 1)
  on conflict (key) do update set
    hits = case when r.window_start < now() - make_interval(secs => p_window_seconds) then 1 else r.hits + 1 end,
    window_start = case when r.window_start < now() - make_interval(secs => p_window_seconds) then now() else r.window_start end
  returning hits into v_hits;
  return v_hits <= p_max;
end;
$$;

revoke execute on function security_throttle_status(text) from public, anon, authenticated;
revoke execute on function security_throttle_fail(text, int, int) from public, anon, authenticated;
revoke execute on function security_throttle_clear(text) from public, anon, authenticated;
revoke execute on function security_rate_hit(text, int, int) from public, anon, authenticated;
grant execute on function security_throttle_status(text) to service_role;
grant execute on function security_throttle_fail(text, int, int) to service_role;
grant execute on function security_throttle_clear(text) to service_role;
grant execute on function security_rate_hit(text, int, int) to service_role;

-- ---------- 4. sesiones revocables ----------
alter table people add column if not exists session_version int not null default 0;
