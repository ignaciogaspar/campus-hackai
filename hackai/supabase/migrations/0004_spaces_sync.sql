-- Sincronización de Espacios con el canal externo de la cátedra (ADR 0005,
-- issue #15): hasta dónde se leyó cada canal vinculado. Es el cursor que
-- devuelve el adaptador (en Discord, el id del último mensaje leído). Al
-- vincular un canal con otro canal externo se borra y se lee desde el
-- principio. Lo usa solo lib/adapters/supabase/spaces-store.ts.
--
-- Los mensajes pendientes de enviar ya están en `space_messages.status`, y
-- su id externo se completa al enviarlos: la clave única (channel_id,
-- external_id) evita que vuelvan duplicados.
--
-- Idempotente: se puede correr de nuevo sin romper nada.

begin;

alter table space_channels add column if not exists external_cursor text;

-- Para la corrida periódica, que busca los canales vinculados de todos los espacios.
create index if not exists space_channels_linked_idx on space_channels (external_system) where external_system is not null;

commit;
