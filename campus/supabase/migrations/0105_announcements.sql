-- Avisos del profesor a la cohorte (feature MCP: post_announcement).
-- Idempotente: se puede volver a correr.

create table if not exists announcements (
  id uuid primary key default gen_random_uuid(),
  course_id text not null references courses(id) on delete cascade,
  class_session_id text references class_sessions(id) on delete set null,
  author_id uuid references people(id) on delete set null,
  title text not null,
  body_md text not null default '',
  via text not null default 'mcp' check (via in ('mcp', 'campus', 'agent')),
  created_at timestamptz not null default now()
);
create index if not exists announcements_course_created_idx on announcements (course_id, created_at desc);

alter table announcements enable row level security;
