-- Docentes de cada jornada: J1–J7 Berdiñas y Buffo Sempé juntos, J8 Willi (después se reparte).
create table if not exists class_session_teachers (
  class_session_id text not null references class_sessions(id) on delete cascade,
  person_id uuid not null references people(id) on delete cascade,
  primary key (class_session_id, person_id)
);
alter table class_session_teachers enable row level security;
alter table class_sessions drop column if exists teacher_id;
