-- Seguimiento: el pase de notas al SIU. Cada nota de una evaluación del SIU que
-- se publica guarda cómo va su pase: `pendiente` (todavía no pasó, o el SIU
-- falló y se reintenta), `pasado` o `no-permitido` (el SIU no deja escribir
-- notas). `pass_by` es el docente en cuyo nombre se pasa (el que publicó o
-- cambió la nota): con él se reintenta desde la corrida periódica. Una nota que
-- no se pasa (una tarea, o todavía un borrador) tiene los dos en null.
--
-- Es parte del almacén del módulo Seguimiento (lib/core/coursework): solo la
-- lee y escribe su adaptador lib/adapters/supabase/coursework-store.ts.
-- Es una tabla propia de HackAI: va también en producción.
-- Idempotente: se puede correr de nuevo sin romper nada.

begin;

alter table coursework_grades add column if not exists pass_status text;
alter table coursework_grades add column if not exists pass_by text;

alter table coursework_grades drop constraint if exists coursework_grades_pass_check;
alter table coursework_grades add constraint coursework_grades_pass_check
  check (pass_status in ('pendiente', 'pasado', 'no-permitido') and pass_by is not null
    or pass_status is null and pass_by is null);

-- La corrida periódica busca las pendientes, en el orden en que se publicaron.
create index if not exists coursework_grades_pending_pass_idx
  on coursework_grades (published_at, seq) where pass_status = 'pendiente';

commit;
