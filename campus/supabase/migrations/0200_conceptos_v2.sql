-- Conceptos y materiales v2: un mapa por jornada (sin niveles ni prerrequisitos),
-- con las slides del deck donde se ve cada concepto y links con fuente.
-- Lo carga scripts/seed/conceptos-v2.ts desde content/aicm2/conceptos.json.
-- Idempotente: se puede aplicar varias veces.

-- 1. Columnas nuevas
alter table concepts add column if not exists class_session_id text references class_sessions(id) on delete set null;
alter table concepts add column if not exists slides int[] not null default '{}';
alter table concepts add column if not exists links jsonb not null default '[]'::jsonb;
alter table concepts add column if not exists position int;

alter table content_items add column if not exists source text;
alter table content_items add column if not exists why text;

-- 2. kind: se suman los tipos v2 (los v1 quedan para el contenido legacy)
alter table content_items drop constraint if exists content_items_kind_check;
alter table content_items add constraint content_items_kind_check check (kind in (
  'video', 'lectura', 'caso', 'link', 'ejemplo',
  'docs', 'articulo', 'herramienta', 'demo', 'posmortem', 'repo'
));

create index if not exists concepts_course_session_idx on concepts (course_id, class_session_id, position);

-- 3. El contenido v1 pasa al curso legacy, sin borrar nada. Los ids v1 y v2
--    comparten el formato c-jN-… (y c-j5-costo-error existe en los dos), así que
--    los v1 se renombran con el prefijo 'legacy-'. Solo se mueve lo que es v1:
--    conceptos sin class_session_id y materiales sin `why` (los v2 siempre los
--    tienen), así que re-aplicar no toca lo que cargó el seed v2.
do $$
begin
  if exists (select 1 from courses where id = 'ai-centric-management-legacy') then
    update content_items
       set id = 'legacy-' || id,
           course_id = 'ai-centric-management-legacy',
           concept_ids = coalesce(
             (select array_agg(case when x like 'legacy-%' then x else 'legacy-' || x end order by o)
                from unnest(concept_ids) with ordinality as t(x, o)),
             '{}')
     where course_id = 'ai-centric-management' and why is null and id not like 'legacy-%';

    update concepts
       set id = 'legacy-' || id,
           course_id = 'ai-centric-management-legacy',
           prereqs = coalesce(
             (select array_agg(case when x like 'legacy-%' then x else 'legacy-' || x end order by o)
                from unnest(prereqs) with ordinality as t(x, o)),
             '{}')
     where course_id = 'ai-centric-management' and class_session_id is null and id not like 'legacy-%';
  end if;
end $$;
