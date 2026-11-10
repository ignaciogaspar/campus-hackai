-- Link público de un deck: con `public_token` cargado, /ver/<token> muestra el
-- deck sin login (sin notas del docente). null = privado. El profesor lo
-- activa y lo revoca desde el editor; revocar y volver a activar cambia el link.
-- Idempotente.

alter table decks add column if not exists public_token text;
create unique index if not exists decks_public_token_idx on decks (public_token) where public_token is not null;
