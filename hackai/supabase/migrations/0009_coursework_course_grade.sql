-- Seguimiento: pesos y nota de cursada. Es parte del almacén del módulo
-- Seguimiento (lib/core/coursework): solo lo lee y escribe su adaptador
-- lib/adapters/supabase/coursework-store.ts.
--
-- `coursework_weights` guarda el peso (de 0 a 100) de cada columna de
-- Calificaciones de una comisión en la nota de cursada. La columna se nombra
-- como en `coursework_grades`: `kind` ('tarea' o 'evaluacion') y `ref_id`. Una
-- fila con `weight` en null es una columna a la que se le quitó el peso.
--
-- La nota de cursada se calcula al leer y no se guarda, salvo cuando el docente
-- la pisa o la publica: entonces es una fila más de `coursework_grades` con
-- `kind = 'cursada'` y `ref_id` igual a la comisión, que usa el mismo estado de
-- publicación y de pase al SIU que las evaluaciones. `edited` marca la que pisó
-- el docente.
--
-- Es una tabla propia de HackAI: va también en producción. Arranca vacía.
-- Idempotente: se puede correr de nuevo sin romper nada.

begin;

alter table coursework_grades drop constraint if exists coursework_grades_kind_check;
alter table coursework_grades add constraint coursework_grades_kind_check
  check (kind in ('tarea', 'evaluacion', 'cursada'));

alter table coursework_grades add column if not exists edited boolean not null default false;

alter table coursework_grades drop constraint if exists coursework_grades_edited_check;
alter table coursework_grades add constraint coursework_grades_edited_check
  check (not edited or kind = 'cursada');

create table if not exists coursework_weights (
  section_id text not null,             -- id de la comisión en Cursada
  kind text not null check (kind in ('tarea', 'evaluacion')),
  ref_id text not null,                 -- id de la tarea o de la evaluación del SIU
  weight numeric(5, 2) check (weight >= 0 and weight <= 100),
  primary key (section_id, kind, ref_id)
);

-- Solo el servidor con service role la toca: RLS sin políticas y sin acceso
-- para los roles públicos.
alter table coursework_weights enable row level security;

revoke all on table coursework_weights from anon, authenticated;

commit;
