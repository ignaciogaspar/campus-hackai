-- Seguimiento privado por jornada. Aplicar antes de desplegar la UI.
begin;
create table if not exists session_reflections (
  id uuid primary key default gen_random_uuid(),
  session_id text not null references class_sessions(id) on delete cascade,
  person_id uuid not null references people(id) on delete cascade,
  takeaway text not null check (char_length(takeaway) between 1 and 1200),
  unclear text not null default '' check (char_length(unclear) <= 1200),
  application text not null default '' check (char_length(application) <= 1200),
  revision int not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  unique (session_id, person_id)
);
create table if not exists session_feedback (
  id uuid primary key default gen_random_uuid(),
  session_id text not null references class_sessions(id) on delete cascade,
  person_id uuid not null references people(id) on delete cascade,
  draft_body text not null check (char_length(draft_body) between 1 and 4000),
  draft_action_label text not null default '' check (char_length(draft_action_label) <= 100),
  draft_action_href text not null default '' check (char_length(draft_action_href) <= 500),
  body text check (char_length(body) between 1 and 4000),
  action_label text not null default '',
  action_href text not null default '',
  visible_at timestamptz,
  publication_id uuid,
  published_by uuid references people(id) on delete set null,
  read_at timestamptz,
  applied_at timestamptz,
  updated_by uuid references people(id) on delete set null,
  revision int not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  unique (session_id, person_id),
  check ((body is null and visible_at is null and publication_id is null) or
         (body is not null and visible_at is not null and publication_id is not null))
);
create index if not exists session_reflections_person_idx on session_reflections(person_id);
create index if not exists session_feedback_visible_idx on session_feedback(person_id, visible_at);
alter table session_reflections enable row level security;
alter table session_feedback enable row level security;
revoke all on session_reflections, session_feedback from anon, authenticated;
grant all on session_reflections, session_feedback to service_role;
commit;
