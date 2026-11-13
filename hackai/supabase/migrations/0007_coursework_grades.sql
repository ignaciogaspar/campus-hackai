-- Seguimiento: las calificaciones. Una fila es la nota de un alumno en una
-- columna de Calificaciones de una comisión. Es parte del almacén del módulo
-- Seguimiento (lib/core/coursework): solo la lee y escribe su adaptador
-- lib/adapters/supabase/coursework-store.ts.
--
-- Una columna es una tarea con nota de la comisión o una evaluación del
-- cronograma del SIU: `kind` dice cuál y `ref_id` es el id de la tarea (uuid,
-- como texto) o de la evaluación del SIU, tal como viene. La columna no tiene
-- tabla propia: existe mientras tenga notas, y está publicada cuando las notas
-- tienen `published_at`. Los ids de personas y comisiones del SIU van como
-- texto, tal como vienen.
--
-- `value` va de 1 a 10 con dos decimales; `absent` es el ausente (y entonces no
-- hay `value`). Solo una fila con nota o ausente se publica. El alumno ve una
-- nota únicamente si tiene `published_at`. `column_name` guarda cómo se llamaba
-- la evaluación al cargar la nota: el nombre de una tarea se lee de la tarea.
-- `seq` ordena las notas en el orden en que se cargaron por primera vez.
--
-- Es una tabla propia de HackAI: va también en producción. Arranca vacía.
-- Idempotente: se puede correr de nuevo sin romper nada.

begin;

create table if not exists coursework_grades (
  id uuid primary key default gen_random_uuid(),
  seq bigint generated always as identity unique,
  section_id text not null,             -- id de la comisión en Cursada
  kind text not null check (kind in ('tarea', 'evaluacion')),
  ref_id text not null,                 -- id de la tarea o de la evaluación del SIU
  person_id text not null,              -- id del alumno en HackAI
  column_name text not null,
  value numeric(4, 2) check (value >= 1 and value <= 10),
  absent boolean not null default false,
  comment text not null default '',
  graded_at timestamptz not null,       -- cuándo se cargó o se cambió
  published_at timestamptz,             -- desde cuándo la ve el alumno
  unique (section_id, kind, ref_id, person_id),
  check (not absent or value is null)
);

create index if not exists coursework_grades_person_idx on coursework_grades (person_id, seq);

-- Solo el servidor con service role la toca: RLS sin políticas y sin acceso
-- para los roles públicos.
alter table coursework_grades enable row level security;

revoke all on table coursework_grades from anon, authenticated;

commit;
