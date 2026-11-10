-- Editor de decks, biblioteca y agente de autoría.
-- Sin cambios a tablas: solo funciones (idempotentes con create or replace).

-- Reescribe el orden completo de un deck en una sola transacción.
-- p_slides es la lista de slide ids en el orden final (puede repetir ids).
-- Evita los choques de la PK (deck_id, position) al correr posiciones.
create or replace function authoring_set_deck_order(p_deck text, p_slides uuid[])
returns void
language plpgsql
as $$
begin
  delete from deck_slides where deck_id = p_deck;
  insert into deck_slides (deck_id, position, slide_id)
  select p_deck, (o.ord - 1)::int, o.sid
  from unnest(p_slides) with ordinality as o(sid, ord);
  update decks set updated_at = now() where id = p_deck;
end;
$$;

-- Búsqueda en el repositorio único de slides: full-text (español) sobre
-- título, markdown y tags, más coincidencia parcial con ilike.
-- Filtros opcionales: tipo, tag, autor, deck (de origen o donde se usa).
create or replace function authoring_search_slides(
  p_q text default null,
  p_kind text default null,
  p_tag text default null,
  p_author uuid default null,
  p_deck text default null,
  p_limit int default 60,
  p_offset int default 0
)
returns table (
  id uuid,
  kind text,
  title text,
  markdown text,
  teacher_notes text,
  tags text[],
  author_id uuid,
  author_name text,
  origin jsonb,
  version int,
  updated_at timestamptz,
  decks jsonb,
  rank real,
  total bigint
)
language sql
stable
as $$
  with q as (
    select nullif(trim(coalesce(p_q, '')), '') as text
  ),
  base as (
    select s.*,
      to_tsvector('spanish', coalesce(s.title, '') || ' ' || s.markdown || ' ' || array_to_string(s.tags, ' ')) as doc
    from slides s
    where (p_kind is null or s.kind = p_kind)
      and (p_tag is null or p_tag = any(s.tags))
      and (p_author is null or s.author_id = p_author)
      and (p_deck is null
        or s.origin->>'deck' = p_deck
        or exists (select 1 from deck_slides ds where ds.slide_id = s.id and ds.deck_id = p_deck))
  ),
  hits as (
    select b.*,
      case when q.text is null then 0
        else ts_rank(b.doc, websearch_to_tsquery('spanish', q.text)) end::real as rank
    from base b, q
    where q.text is null
      or b.doc @@ websearch_to_tsquery('spanish', q.text)
      or b.title ilike '%' || q.text || '%'
      or b.markdown ilike '%' || q.text || '%'
      or exists (select 1 from unnest(b.tags) t where t ilike '%' || q.text || '%')
  )
  select h.id, h.kind, h.title, h.markdown, h.teacher_notes, h.tags, h.author_id,
    p.full_name as author_name, h.origin, h.version, h.updated_at,
    coalesce((
      select jsonb_agg(jsonb_build_object('deckId', ds.deck_id, 'position', ds.position) order by ds.deck_id, ds.position)
      from deck_slides ds where ds.slide_id = h.id
    ), '[]'::jsonb) as decks,
    h.rank,
    count(*) over () as total
  from hits h
  left join people p on p.id = h.author_id
  order by h.rank desc, h.updated_at desc, h.id
  limit greatest(1, least(p_limit, 200)) offset greatest(0, p_offset);
$$;
