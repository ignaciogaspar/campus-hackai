-- Espacios: el servidor del canal externo de la cátedra (en Discord, su
-- servidor) con que un docente conectó el espacio desde «Conectar con
-- Discord» (issue #64). Ahí se crean los canales del espacio y de ahí se
-- listan para vincular uno. Lo usa solo lib/adapters/supabase/spaces-store.ts.
--
-- Idempotente: se puede correr de nuevo sin romper nada.

begin;

alter table spaces add column if not exists external_system text check (external_system in ('discord'));
alter table spaces add column if not exists external_server_id text; -- id del servidor en el canal externo

alter table spaces drop constraint if exists spaces_external_server_check;
alter table spaces
  add constraint spaces_external_server_check check ((external_system is null) = (external_server_id is null));

commit;
