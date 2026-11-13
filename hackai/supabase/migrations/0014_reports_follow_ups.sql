-- Reportes: los alumnos que la Dirección de Estudios marcó «en seguimiento»,
-- con una nota corta. Es el almacén propio del módulo Reportes
-- (lib/core/reports): solo lo lee y escribe su adaptador
-- lib/adapters/supabase/reports-store.ts.
--
-- Una fila por alumno, por su legajo del SIU (`student_id`): marcarlo de nuevo
-- cambia la nota. `created_by` es la persona de HackAI de secretaría que lo
-- marcó o cambió la nota por última vez. No guarda nada más del alumno: sus
-- datos se leen del padrón académico.
--
-- Es una tabla propia de HackAI: va también en producción. Arranca vacía.
-- Idempotente: se puede correr de nuevo sin romper nada.

begin;

create table if not exists reports_follow_ups (
  student_id text primary key check (char_length(student_id) between 1 and 40),
  note text not null default '' check (char_length(note) <= 280),
  created_by text not null check (char_length(created_by) between 1 and 120),
  updated_at timestamptz not null default now()
);

-- Toda lectura y escritura pasa por el servidor con el service role: RLS
-- activado y sin políticas, nadie entra con la clave pública.
alter table reports_follow_ups enable row level security;
revoke all on table reports_follow_ups from anon, authenticated;

commit;
