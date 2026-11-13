-- Planning: en qué aula y a qué hora se dicta cada clase, de todas las
-- materias. Lo carga secretaría pegando su planilla, subiendo el .xlsx o una
-- clase a mano. Es el almacén propio del módulo Planning (lib/core/planning):
-- solo lo lee y escribe su adaptador lib/adapters/supabase/planning-store.ts.
--
-- Una fila por clase. Con `weekday` se repite cada semana; con `class_date` es
-- de ese día solo y manda sobre las semanales de la misma materia y comisión
-- (otra aula, otro horario o `cancelled`). `start_minute` y `end_minute` son
-- minutos desde la medianoche en Buenos Aires.
--
-- `batch` es la carga a la que pertenece la fila: reemplazar el planning
-- inserta la carga nueva y después borra las otras, así si algo falla a la
-- mitad queda el planning anterior entero.
--
-- No guarda personas: solo materia, comisión, facultad, sede, edificio, módulo y aula.
-- Es una tabla propia de HackAI: va también en producción. Arranca vacía.
-- Idempotente: se puede correr de nuevo sin romper nada.

begin;

create table if not exists planning_entries (
  id uuid primary key default gen_random_uuid(),
  batch uuid not null,
  subject text not null check (char_length(subject) between 1 and 120),
  section text check (char_length(section) <= 120),
  school text not null default '' check (char_length(school) <= 120),
  campus text not null default '' check (char_length(campus) <= 120),      -- sede: Pilar, Buenos Aires…
  building text not null default '' check (char_length(building) <= 120),  -- edificio: Olivo, Cerrito…
  wing text not null default '' check (char_length(wing) <= 120),          -- módulo del edificio: Módulo A…
  room text not null check (char_length(room) between 1 and 120),
  weekday text check (weekday in ('lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado')),
  class_date date,
  start_minute integer not null check (start_minute between 0 and 1440),
  end_minute integer not null check (end_minute between 0 and 1440 and end_minute > start_minute),
  cancelled boolean not null default false,
  created_at timestamptz not null default now(),
  check ((weekday is null) <> (class_date is null))
);

-- Las clases de un día: las semanales por día de la semana, los cambios por fecha.
create index if not exists planning_entries_date_idx on planning_entries (class_date) where class_date is not null;

-- Toda lectura y escritura pasa por el servidor con el service role: RLS
-- activado y sin políticas, nadie entra con la clave pública.
alter table planning_entries enable row level security;
revoke all on table planning_entries from anon, authenticated;

commit;
