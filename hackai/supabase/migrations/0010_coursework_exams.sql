-- Seguimiento: instancias de examen y promoción. Es parte del almacén del
-- módulo Seguimiento (lib/core/coursework): solo lo lee y escribe su adaptador
-- lib/adapters/supabase/coursework-store.ts.
--
-- `coursework_exams` guarda las instancias de examen de una comisión que viven
-- en HackAI: las que suma el docente (`assessment_id`, la evaluación del SIU, en null; sus notas
-- quedan en HackAI, con `kind = 'examen'` en `coursework_grades`) y el nombre y
-- la fecha que el docente le corrige a una evaluación del SIU (una fila por
-- evaluación; sus notas se siguen pasando al SIU).
--
-- `coursework_promotions` dice si la materia se promociona en la comisión y con
-- qué nota de cursada como mínimo.
--
-- Son tablas propias de HackAI: van también en producción. Arrancan vacías.
-- Idempotente: se puede correr de nuevo sin romper nada.

begin;

alter table coursework_grades drop constraint if exists coursework_grades_kind_check;
alter table coursework_grades add constraint coursework_grades_kind_check
  check (kind in ('tarea', 'evaluacion', 'examen', 'cursada'));

alter table coursework_weights drop constraint if exists coursework_weights_kind_check;
alter table coursework_weights add constraint coursework_weights_kind_check
  check (kind in ('tarea', 'evaluacion', 'examen'));

create table if not exists coursework_exams (
  id uuid primary key default gen_random_uuid(),
  section_id text not null,             -- id de la comisión en Cursada
  assessment_id text,               -- la evaluación del SIU que corrige; null si es propia
  kind text not null check (kind in ('parcial', 'recuperatorio', 'integrador')),
  name text not null check (char_length(name) between 1 and 120),
  date timestamptz not null
);

create unique index if not exists coursework_exams_siu_key
  on coursework_exams (section_id, assessment_id)
  where assessment_id is not null;
create index if not exists coursework_exams_section_idx on coursework_exams (section_id, date);

create table if not exists coursework_promotions (
  section_id text primary key,          -- id de la comisión en Cursada
  promotable boolean not null default false,
  minimum numeric(4, 2) not null default 7 check (minimum >= 4 and minimum <= 10)
);

-- Solo el servidor con service role las toca: RLS sin políticas y sin acceso
-- para los roles públicos.
alter table coursework_exams enable row level security;
alter table coursework_promotions enable row level security;
revoke all on coursework_exams from anon, authenticated;
revoke all on coursework_promotions from anon, authenticated;

commit;
