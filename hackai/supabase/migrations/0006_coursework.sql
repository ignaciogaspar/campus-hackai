-- Seguimiento: las tareas que crean los docentes y las entregas de los alumnos. Es el almacén del módulo
-- Seguimiento (lib/core/coursework): solo lo lee y escribe su adaptador
-- lib/adapters/supabase/coursework-store.ts.
--
-- Los ids de las personas, las materias y las comisiones del SIU se guardan
-- tal como vienen, como texto, así los datos de producción entran sin migrar
-- nada. Los ids propios de HackAI (las tareas) son uuid.
--
-- Una tarea es de una o más comisiones de una misma materia: `section_ids`
-- las lista. Quién ve y quién gestiona cada tarea lo decide el módulo con las
-- comisiones que da Cursada; acá no se guarda ninguna membresía. El archivo de
-- la consigna, si hay, es un archivo de Archivos (`file_id`) y se entrega por
-- /archivos/<id>/<nombre> solo a quien ve la tarea.
--
-- Una entrega es de una persona a una tarea (una sola: volver a entregar la
-- reemplaza). Sus archivos son archivos de Archivos y van en `files`, una lista
-- de {id, name, contentType, size}; el índice gin los encuentra por id para
-- saber de quién es cada uno. «Atrasada» no se guarda: se calcula al leer con
-- `submitted_at` y la fecha límite vigente. `graded_at` cierra el reemplazo.
--
-- `seq` ordena las tareas que vencen a la misma hora.
--
-- Es una tabla propia de HackAI: va también en producción. Arranca vacía: las
-- tareas las crean los docentes.
-- Idempotente: se puede correr de nuevo sin romper nada.

begin;

create table if not exists coursework_tasks (
  id uuid primary key default gen_random_uuid(),
  seq bigint generated always as identity unique,
  subject_id text not null,             -- id de la materia en Cursada
  section_ids text[] not null,          -- ids de las comisiones de la tarea
  name text not null,
  instructions text not null default '',
  file_id uuid unique,                  -- archivo de la consigna, en Archivos
  file_name text,
  file_content_type text,
  file_size bigint,
  due_at timestamptz not null,          -- fecha límite
  graded boolean not null,              -- si lleva nota: sin nota no tiene columna en Calificaciones
  created_by text not null,             -- id de la persona en HackAI
  created_at timestamptz not null default now(),
  check (cardinality(section_ids) >= 1),
  check ((file_id is null) = (file_name is null))
);

create index if not exists coursework_tasks_subject_idx on coursework_tasks (subject_id, due_at, seq);

create table if not exists coursework_submissions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references coursework_tasks (id) on delete cascade,
  person_id text not null,              -- id de la persona en HackAI
  submitted_at timestamptz not null,    -- cuándo entregó (o reemplazó la entrega)
  files jsonb not null,                 -- [{id, name, contentType, size}]
  graded_at timestamptz,                -- desde cuándo está calificada: ya no se reemplaza
  unique (task_id, person_id),
  check (jsonb_array_length(files) >= 1)
);

create index if not exists coursework_submissions_person_idx on coursework_submissions (person_id, task_id);
create index if not exists coursework_submissions_files_idx on coursework_submissions using gin (files jsonb_path_ops);

-- Solo el servidor con service role las toca: RLS sin políticas y sin acceso
-- para los roles públicos.
alter table coursework_tasks enable row level security;
alter table coursework_submissions enable row level security;

revoke all on table coursework_tasks, coursework_submissions from anon, authenticated;

commit;
