-- Seguimiento: las tareas que crean los docentes. Es el almacén del módulo
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

-- Solo el servidor con service role la toca: RLS sin políticas y sin acceso
-- para los roles públicos.
alter table coursework_tasks enable row level security;

revoke all on table coursework_tasks from anon, authenticated;

commit;
