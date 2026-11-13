-- Cursada: las clases con la lista tomada (tomar lista). Es el almacén propio
-- del módulo Cursada (lib/core/studies): solo lo lee y escribe su adaptador
-- lib/adapters/supabase/studies-store.ts.
--
-- Una fila por clase de una comisión: `class_at` es el instante de la clase
-- (el inicio de su horario en Buenos Aires) y con `section_id` la identifica;
-- corregir la lista el mismo día reemplaza la fila. Los ausentes se guardan
-- por su id del SIU (legajo) en `absent`, así también figura el que no tiene
-- cuenta vinculada. `pass_status` dice si la lista llegó al SIU: 'pendiente' (se
-- reintenta), 'pasado' o 'no-permitido' (el SIU no deja escribirla por API).
-- `subject_*` y `section_name` guardan cómo se llamaban cuando se tomó la
-- lista, para mostrar las faltas aunque el SIU no responda.
--
-- Los ids del SIU y de las personas se guardan tal como vienen, como texto.
-- Es una tabla propia de HackAI: va también en producción. Arranca vacía.
-- Idempotente: se puede correr de nuevo sin romper nada.

begin;

create table if not exists section_classes (
  id uuid primary key default gen_random_uuid(),
  section_id text not null,           -- id de la comisión en el SIU
  class_at timestamptz not null,      -- instante de la clase
  taken_at timestamptz not null,      -- cuándo se tomó o se corrigió
  taken_by text not null,             -- id de HackAI del docente que la tomó
  absent jsonb not null default '[]'::jsonb check (jsonb_typeof(absent) = 'array'),
  pass_status text not null default 'pendiente' check (pass_status in ('pendiente', 'pasado', 'no-permitido')),
  passed_at timestamptz,                -- cuándo se pasó al SIU; null si no se pasó
  subject_id text not null,
  subject_code text not null,
  subject_name text not null,
  section_name text not null,
  unique (section_id, class_at)
);

-- Las listas por pasar, de la más vieja a la más nueva.
create index if not exists section_classes_pending_idx on section_classes (class_at) where pass_status = 'pendiente';

-- Los ausentes, por id del SIU: lo que busca la vista de inasistencias del alumno.
create index if not exists section_classes_absent_idx on section_classes using gin (absent);

-- Toda lectura y escritura pasa por el servidor con el service role: RLS
-- activado y sin políticas, nadie entra con la clave pública.
alter table section_classes enable row level security;
revoke all on table section_classes from anon, authenticated;

commit;
