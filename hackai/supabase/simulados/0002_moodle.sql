-- Moodle simulado: tablas moodle_* con la forma de sus Web Services
-- (docs/research/2026-11-10-moodle-web-services.md, secciones 1 a 5).
-- Las columnas van en inglés, como los tipos del puerto (lib/ports/classroom.ts);
-- cuando copian un campo de la API, al lado va su nombre. Las que no lo tienen
-- no tienen un campo equivalente directo en la research.
--
-- Copian el subconjunto de cada función que usa el puerto. Quedan afuera,
-- entre otros:
--   - Cursos: displayname, idnumber, visible, summary, format, category,
--     startdate, enddate, progress. El vínculo con las comisiones del SIU va
--     en siu_section_ids; en la real sería el idnumber.
--   - Matrículas: método (manual, cohort, database, self), timestart, timeend,
--     estado activo o suspendido, roleid (acá el rol va por su nombre corto).
--     Cohortes, grupos y sus miembros.
--   - Foro de avisos: el foro (tipo news) y las discusiones; el aviso es el
--     post que abre cada discusión. Quedan afuera parentid, pinned, unread,
--     numreplies y la respuesta de los alumnos.
--   - Contenidos: secciones y módulos como tablas aparte (acá van como el
--     nombre del tema), visible, completion y las carpetas.
--   - Tareas: allowsubmissionsfromdate, cutoffdate, gradingduedate, maxattempts
--     y las entregas (mod_assign_get_submissions, get_submission_status). Los
--     eventos del calendario (core_calendar_*).
--   - Mensajes (core_message_*).
-- Se suman cuando un ticket los necesite.
--
-- Son tablas de la demo: van aparte de las migraciones propias
-- (supabase/migrations/) para no aplicarlas en producción, donde el aula
-- virtual es el Moodle real. Solo las lee y escribe el adaptador
-- lib/adapters/moodle-simulado/. Idempotente: se puede correr de nuevo sin
-- romper nada. Los datos los carga moodle_seed.sql.

begin;

-- Usuarios (core_user_get_users).
create table if not exists moodle_users (
  id text primary key,                -- id
  username text not null,             -- username
  first_name text not null,           -- firstname
  last_name text not null,            -- lastname
  email text not null                 -- email
);

-- Cursos (core_enrol_get_users_courses, core_course_get_courses).
create table if not exists moodle_courses (
  id text primary key,                -- id
  short_name text not null,           -- shortname
  full_name text not null,            -- fullname
  siu_section_ids text[] not null default '{}'   -- comisiones del SIU vinculadas; no es un campo de la API
);

create index if not exists moodle_courses_siu_section_ids on moodle_courses using gin (siu_section_ids);

-- Matrículas (enrol_manual_enrol_users, enrol_manual_unenrol_users). Una por
-- usuario y curso: cambiar el rol pisa la fila.
create table if not exists moodle_enrolments (
  user_id text not null references moodle_users (id) on delete cascade,      -- userid
  course_id text not null references moodle_courses (id) on delete cascade,  -- courseid
  role text not null check (role in ('student', 'editingteacher')),          -- roleid, por su nombre corto
  primary key (user_id, course_id)
);

create index if not exists moodle_enrolments_course on moodle_enrolments (course_id);

-- Avisos del foro de Avisos del curso (mod_forum_get_discussion_posts).
create table if not exists moodle_announcements (
  id text primary key,                -- id
  course_id text not null references moodle_courses (id) on delete cascade,
  author_id text not null references moodle_users (id),                      -- author
  subject text not null,              -- subject
  message text not null,              -- message
  created_at timestamptz not null,    -- timecreated
  -- attachments: [{ name, url, contentType, size }] (filename, fileurl, mimetype, filesize)
  attachments jsonb not null default '[]'
);

create index if not exists moodle_announcements_course on moodle_announcements (course_id, created_at);

-- Recursos del curso: archivos y enlaces dentro de un tema (core_course_get_contents).
create table if not exists moodle_contents (
  id text primary key,                -- id del módulo
  course_id text not null references moodle_courses (id) on delete cascade,
  topic text not null,                -- name de la sección
  name text not null,                 -- name
  type text not null check (type in ('file', 'url')),    -- modname: resource o url
  url text not null,                  -- fileurl o url
  modified_at timestamptz not null    -- timemodified
);

create index if not exists moodle_contents_course on moodle_contents (course_id);

-- Tareas con fecha límite (mod_assign_get_assignments). due_date null es
-- duedate = 0: la tarea no tiene fecha.
create table if not exists moodle_assignments (
  id text primary key,                -- id
  course_id text not null references moodle_courses (id) on delete cascade,  -- course
  name text not null,                 -- name
  due_date timestamptz                -- duedate
);

create index if not exists moodle_assignments_course on moodle_assignments (course_id);

-- Solo el servidor con service role las toca: RLS sin políticas y sin acceso
-- para los roles públicos.
alter table moodle_users enable row level security;
alter table moodle_courses enable row level security;
alter table moodle_enrolments enable row level security;
alter table moodle_announcements enable row level security;
alter table moodle_contents enable row level security;
alter table moodle_assignments enable row level security;

revoke all on table
  moodle_users, moodle_courses, moodle_enrolments, moodle_announcements, moodle_contents, moodle_assignments
from anon, authenticated;

commit;
