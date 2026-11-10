-- Consistencia de la clase en vivo y del orden de los decks. Idempotente.
--
-- - live_sessions.seq: contador monotónico del estado visible. Cada cambio
--   (posición, overlay, reordenamiento) lo sube; los clientes ignoran un
--   `state` con seq menor al último que aplicaron.
-- - live_sessions.current_slide_id: la slide que se está dando. Al insertar,
--   quitar o mover slides, current_position se recalcula a partir de ella.
-- - Las mutaciones de estado son funciones SQL atómicas que devuelven la
--   fila nueva: el servidor emite lo que quedó en la DB, nunca una copia vieja.
-- - Marcas y notas de alumnos: la clave real es slide_id (no la posición).
--   Las funciones que cambian el orden del deck re-sincronizan `position`.
-- - Insertar y reordenar toman un lock del deck: se serializan.

alter table live_sessions add column if not exists seq bigint not null default 0;
alter table live_sessions add column if not exists current_slide_id uuid references slides(id) on delete set null;

-- ---------- marcas y notas por slide ----------
alter table slide_marks drop constraint if exists slide_marks_person_id_deck_id_position_kind_key;
create unique index if not exists slide_marks_person_slide_kind_uq on slide_marks (person_id, deck_id, slide_id, kind);
create unique index if not exists slide_notes_person_slide_uq on slide_notes (person_id, deck_id, slide_id);
create index if not exists slide_marks_deck_slide_idx on slide_marks (deck_id, slide_id);
create index if not exists slide_notes_deck_slide_idx on slide_notes (deck_id, slide_id);

-- Copia a marcas y notas la posición actual de su slide en el deck.
create or replace function deck_resync_positions(p_deck text)
returns void
language sql
as $$
  update slide_marks m set position = ds.position
  from (select distinct on (slide_id) slide_id, position from deck_slides where deck_id = p_deck order by slide_id, position) ds
  where m.deck_id = p_deck and m.slide_id = ds.slide_id and m.position <> ds.position;
  update slide_notes n set position = ds.position
  from (select distinct on (slide_id) slide_id, position from deck_slides where deck_id = p_deck order by slide_id, position) ds
  where n.deck_id = p_deck and n.slide_id = ds.slide_id and n.position <> ds.position;
$$;

-- Fija current_slide_id de las clases vivas del deck que no lo tengan.
create or replace function live_backfill_slide(p_deck text)
returns void
language sql
as $$
  update live_sessions l set current_slide_id = ds.slide_id
  from deck_slides ds
  where l.deck_id = p_deck and l.status = 'live' and l.current_slide_id is null
    and ds.deck_id = l.deck_id and ds.position = l.current_position;
$$;

-- Después de cambiar el orden: cada clase viva del deck vuelve a la slide
-- que estaba dando (o se acota si la quitaron) y sube seq.
create or replace function live_sync_sessions(p_deck text)
returns void
language plpgsql
as $$
declare
  r record;
  v_total int;
  v_pos int;
begin
  select count(*) into v_total from deck_slides where deck_id = p_deck;
  for r in select id, current_position, current_slide_id from live_sessions where deck_id = p_deck and status = 'live' for update loop
    v_pos := null;
    if r.current_slide_id is not null then
      select position into v_pos from deck_slides
        where deck_id = p_deck and slide_id = r.current_slide_id
        order by abs(position - r.current_position) limit 1;
    end if;
    if v_pos is null then
      v_pos := least(r.current_position, greatest(v_total - 1, 0));
    end if;
    update live_sessions set
      current_position = v_pos,
      current_slide_id = (select slide_id from deck_slides where deck_id = p_deck and position = v_pos),
      seq = seq + 1
    where id = r.id;
  end loop;
end;
$$;

-- ---------- insertar una slide (con lock) ----------
create or replace function live_insert_deck_slide(p_deck text, p_after int, p_slide uuid)
returns int
language plpgsql
as $$
declare
  v_pos int;
  v_max int;
begin
  perform 1 from decks where id = p_deck for update;
  perform live_backfill_slide(p_deck);
  select coalesce(max(position), -1) into v_max from deck_slides where deck_id = p_deck;
  v_pos := least(greatest(p_after + 1, 0), v_max + 1);
  -- dos pasos para no chocar con la PK: primero a negativos, después a su lugar
  update deck_slides set position = -position - 1000000
    where deck_id = p_deck and position >= v_pos;
  update deck_slides set position = -position - 1000000 + 1
    where deck_id = p_deck and position < 0;
  insert into deck_slides (deck_id, position, slide_id) values (p_deck, v_pos, p_slide);
  update decks set updated_at = now() where id = p_deck;
  perform deck_resync_positions(p_deck);
  perform live_sync_sessions(p_deck);
  return v_pos;
end;
$$;

-- ---------- reescribir el orden (con lock y control de concurrencia) ----------
-- p_expected: el orden que leyó quien llama. Si cambió en el medio, falla
-- con 'deck_order_conflict' (el editor pide recargar).
drop function if exists authoring_set_deck_order(text, uuid[]);
create or replace function authoring_set_deck_order(p_deck text, p_slides uuid[], p_expected uuid[] default null)
returns void
language plpgsql
as $$
declare
  v_current uuid[];
begin
  perform 1 from decks where id = p_deck for update;
  if p_expected is not null then
    select coalesce(array_agg(slide_id order by position), '{}') into v_current from deck_slides where deck_id = p_deck;
    if v_current is distinct from p_expected then
      raise exception 'deck_order_conflict: el deck % cambió mientras se editaba', p_deck;
    end if;
  end if;
  perform live_backfill_slide(p_deck);
  delete from deck_slides where deck_id = p_deck;
  insert into deck_slides (deck_id, position, slide_id)
  select p_deck, (o.ord - 1)::int, o.sid
  from unnest(p_slides) with ordinality as o(sid, ord);
  update decks set updated_at = now() where id = p_deck;
  perform deck_resync_positions(p_deck);
  perform live_sync_sessions(p_deck);
end;
$$;

-- ---------- estado de la clase ----------
-- Ir a una posición (se acota al deck). La overlay de «confusión» es de una
-- slide: se limpia solo si sigue siendo esa. Devuelve la fila nueva.
create or replace function live_goto(p_id uuid, p_position int)
returns jsonb
language plpgsql
as $$
declare
  v_deck text;
  v_total int;
  v_pos int;
  v_row live_sessions;
begin
  select deck_id into v_deck from live_sessions where id = p_id and status = 'live' for update;
  if v_deck is null then
    return null;
  end if;
  select count(*) into v_total from deck_slides where deck_id = v_deck;
  if v_total = 0 then
    select coalesce(html_slide_count, 0) into v_total from decks where id = v_deck;
  end if;
  v_pos := least(greatest(p_position, 0), greatest(v_total - 1, 0));
  update live_sessions set
    current_position = v_pos,
    current_slide_id = (select slide_id from deck_slides where deck_id = v_deck and position = v_pos),
    overlay = case when overlay->>'type' = 'confusion' then null else overlay end,
    seq = seq + 1
  where id = p_id
  returning * into v_row;
  return to_jsonb(v_row);
end;
$$;

-- Pone (o limpia con null) el overlay. Con p_expect solo cambia si el
-- overlay actual lo contiene (jsonb @>). Devuelve {row, changed}.
create or replace function live_set_overlay(p_id uuid, p_overlay jsonb, p_expect jsonb default null)
returns jsonb
language plpgsql
as $$
declare
  v_row live_sessions;
  v_changed boolean := false;
begin
  select * into v_row from live_sessions where id = p_id for update;
  if v_row.id is null then
    return null;
  end if;
  if v_row.status = 'live' and (p_expect is null or coalesce(v_row.overlay, 'null'::jsonb) @> p_expect) then
    update live_sessions set overlay = p_overlay, seq = seq + 1 where id = p_id returning * into v_row;
    v_changed := true;
  end if;
  return jsonb_build_object('row', to_jsonb(v_row), 'changed', v_changed);
end;
$$;

-- Termina la clase (idempotente). Devuelve la fila.
create or replace function live_end(p_id uuid)
returns jsonb
language plpgsql
as $$
declare
  v_row live_sessions;
begin
  update live_sessions set status = 'ended', ended_at = coalesce(ended_at, now()), overlay = null, seq = seq + 1
  where id = p_id and status = 'live'
  returning * into v_row;
  if v_row.id is null then
    select * into v_row from live_sessions where id = p_id;
  end if;
  return to_jsonb(v_row);
end;
$$;

-- ---------- permisos: solo el service role ----------
do $$
declare f text;
begin
  foreach f in array array[
    'deck_resync_positions(text)', 'live_backfill_slide(text)', 'live_sync_sessions(text)',
    'live_insert_deck_slide(text, int, uuid)', 'authoring_set_deck_order(text, uuid[], uuid[])',
    'live_goto(uuid, int)', 'live_set_overlay(uuid, jsonb, jsonb)', 'live_end(uuid)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;
