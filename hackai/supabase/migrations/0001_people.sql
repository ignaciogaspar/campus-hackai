-- Personas: los vínculos de cada persona de HackAI con cada sistema en el que
-- tiene una cuenta propia (la identidad, el SIU, Moodle y Discord). Es el
-- almacén del módulo Personas (lib/core/people): solo lo lee y escribe su
-- adaptador lib/adapters/supabase/people-store.ts.
--
-- Guarda los ids tal como vienen de cada sistema, así los datos de producción
-- entran sin migrar nada. Se vincula por id, nunca por nombre de usuario o
-- mail, que cambian o se repiten.
--
-- Es una tabla propia de HackAI: va también en producción. Los vínculos de las
-- personas sintéticas de la demo los carga supabase/simulados/people_seed.sql.
-- Idempotente: se puede correr de nuevo sin romper nada.

begin;

create table if not exists people_accounts (
  person_id text not null,            -- id de la persona en HackAI
  system text not null check (system in ('identity', 'siu', 'moodle', 'discord')),
  external_id text not null,          -- su id en ese sistema
  created_at timestamptz not null default now(),
  -- Una persona tiene a lo sumo una cuenta por sistema...
  primary key (person_id, system),
  -- ...y una cuenta de un sistema es de una sola persona.
  unique (system, external_id)
);

-- Solo el servidor con service role la toca: RLS sin políticas y sin acceso
-- para los roles públicos.
alter table people_accounts enable row level security;

revoke all on table people_accounts from anon, authenticated;

commit;
