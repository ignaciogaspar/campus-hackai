-- SIU simulado: pasar la asistencia de una clase. Lo usa recordAttendance del
-- SIU simulado (lib/adapters/siu-simulado). La asistencia se guarda en
-- siu_absences (0001_siu.sql): una falta por ausente, sin justificar.
--
-- `siu_record_attendance` REEMPLAZA las faltas de una clase (comisión e
-- instante exacto) por las de la lista, todo en una transacción: repetir la
-- misma lista no cambia nada y una lista corregida pisa la anterior. Las
-- faltas que escribe llevan el id `ia-<comisión>-<instante>-<persona>`.
--
-- Es del SIU simulado: no va a producción. Idempotente.

begin;

create or replace function siu_record_attendance(p_section_id text, p_class_at timestamptz, p_absent text[])
returns void
language plpgsql
as $$
begin
  delete from siu_absences where section_id = p_section_id and date = p_class_at;
  insert into siu_absences (id, person_id, section_id, date, justified)
  select 'ia-' || p_section_id || '-' || to_char(p_class_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') || '-' || person_id,
         person_id, p_section_id, p_class_at, false
  from unnest(p_absent) as person_id
  on conflict (id) do update set justified = false;
end;
$$;

revoke execute on function siu_record_attendance(text, timestamptz, text[]) from public, anon, authenticated;

commit;
