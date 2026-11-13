-- Cursada: el enlace de Zoom de cada comisión (#109). Lo carga el docente una
-- vez y lo ven los alumnos de la comisión el día de una clase virtual o
-- híbrida. Lo lee y escribe solo el adaptador
-- lib/adapters/supabase/studies-store.ts. Una fila por comisión; cambiar el
-- enlace reemplaza la fila y borrarlo lo deja en null.
--
-- `section_id` es el id de la comisión en el SIU, como en section_classes.
-- Es una tabla propia de HackAI: va también en producción. Arranca vacía.
-- Idempotente: se puede correr de nuevo sin romper nada.

begin;

create table if not exists section_zoom_links (
  section_id text primary key,        -- id de la comisión en el SIU
  url text check (url is null or url ~ '^https://')  -- null: sin enlace
);

-- Toda lectura y escritura pasa por el servidor con el service role: RLS
-- activado y sin políticas, nadie entra con la clave pública.
alter table section_zoom_links enable row level security;
revoke all on table section_zoom_links from anon, authenticated;

commit;
