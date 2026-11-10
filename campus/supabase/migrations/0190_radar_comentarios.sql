-- Radar: debajo de cada noticia, comentarios libres de alumnos y profesores.
-- Reemplaza la votación HOY / 6 MESES / 3 AÑOS (radar_votes, que estaba vacía).
-- Idempotente: se puede volver a correr.

create table if not exists radar_comments (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references radar_items(id) on delete cascade,
  person_id uuid references people(id) on delete set null,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists radar_comments_item_idx on radar_comments (item_id, created_at);

alter table radar_comments enable row level security;
revoke all on radar_comments from anon, authenticated;

drop table if exists radar_votes;
