-- Moodle simulado: todos los elementos de un curso, no solo archivos y
-- enlaces (issue #142, ADR 0010). Suma a moodle_contents (0002_moodle.sql) las
-- carpetas, las páginas, los textos sueltos y las actividades, con su lugar en
-- el aula; y a moodle_assignments, la consigna y el enlace a la tarea.
-- Los campos copian core_course_get_contents y mod_assign_get_assignments:
-- docs/research/2026-11-13-inventario-cursos-campus.md.
--
-- Es del Moodle simulado: no va a producción. Idempotente.

begin;

alter table moodle_contents add column if not exists position integer not null default 0;  -- orden de la sección y del módulo
alter table moodle_contents add column if not exists files jsonb not null default '[]';     -- contents: [{ name, url, contentType, size }]
alter table moodle_contents add column if not exists text text;                             -- intro de la página o del label, sin HTML
alter table moodle_contents add column if not exists activity text;                         -- modname de una actividad

-- type: resource (file), url, folder, page, label, o cualquier otra actividad (activity).
alter table moodle_contents drop constraint if exists moodle_contents_type_check;
alter table moodle_contents add constraint moodle_contents_type_check
  check (type in ('file', 'url', 'folder', 'page', 'label', 'activity'));

drop index if exists moodle_contents_course;
create index if not exists moodle_contents_course on moodle_contents (course_id, position);

alter table moodle_assignments add column if not exists description text;                  -- intro, sin HTML
alter table moodle_assignments add column if not exists url text not null default '';      -- mod/assign/view.php?id=<cmid>

commit;
