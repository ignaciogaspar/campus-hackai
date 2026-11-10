-- Campus Austral · esquema inicial.
-- Todo acceso pasa por el servidor (service role). RLS activado sin políticas:
-- la anon key solo se usa en el cliente para canales Realtime Broadcast.

-- Se aplica UNA sola vez. Si se vuelve a correr con psql (README), el guard de
-- abajo corta acá: sin él, cada `create table` fallaba pero los `create index`
-- sin nombre se volvían a crear duplicados (people_course_id_role_idx1…).
-- Usa meta-comandos de psql (\gset, \if): correla con psql, no en el SQL editor.
select to_regclass('public.people') is not null as campus_0001_aplicada \gset
\if :campus_0001_aplicada
\echo '0001_campus.sql ya está aplicada: se saltea.'
\quit
\endif

create extension if not exists pgcrypto;

-- ---------- curso y personas ----------
create table courses (
  id text primary key,                         -- slug: 'ai-centric-management'
  title text not null,
  edition text,
  meta jsonb not null default '{}'
);

create table people (
  id uuid primary key default gen_random_uuid(),
  course_id text not null references courses(id) on delete cascade,
  role text not null check (role in ('profesor', 'alumno')),
  full_name text not null,
  email text,
  company text,
  position text,
  industry text,
  bio text,
  linkedin text,
  photo_url text,
  interests text[] not null default '{}',
  pin_hash text,                               -- alumno: PIN de 4 dígitos (scrypt), se fija en el primer ingreso
  is_fictional boolean not null default false, -- cohorte demo
  created_at timestamptz not null default now()
);
create index on people (course_id, role);

create table class_sessions (
  id text primary key,                         -- 'aicm-j1'
  course_id text not null references courses(id) on delete cascade,
  ordinal int not null,
  title text not null,
  block text,
  starts_at timestamptz,
  summary text,
  deck_id text,
  unique (course_id, ordinal)
);

-- ---------- slides: un único repositorio ----------
create table slides (
  id uuid primary key default gen_random_uuid(),
  course_id text references courses(id) on delete set null,
  kind text not null default 'default',        -- tipo del DSL (cover, split, tabla, encuesta, postura, simulador…)
  title text,
  markdown text not null,                      -- bloque DSL completo, incluido ':::tipo'
  teacher_notes text,                          -- notas del docente (nunca llegan al alumno)
  tags text[] not null default '{}',
  author_id uuid references people(id) on delete set null,
  origin jsonb not null default '{}',          -- {deck, position} de donde salió, o {agent: true}
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on slides using gin (tags);

create table slide_revisions (
  id bigserial primary key,
  slide_id uuid not null references slides(id) on delete cascade,
  markdown text not null,
  teacher_notes text,
  edited_by uuid references people(id) on delete set null,
  via text not null default 'editor' check (via in ('editor', 'agent', 'import', 'mcp')),
  created_at timestamptz not null default now()
);

create table decks (
  id text primary key,                         -- 'aicm-j1', 'empresas-familiares'
  course_id text references courses(id) on delete set null,
  title text not null,
  question text,
  thesis text,
  teacher_guide text,
  chapters jsonb not null default '[]',
  sources jsonb not null default '[]',
  kind text not null default 'native' check (kind in ('native', 'html')),
  html_url text,                               -- kind='html': deck estático servido en /decks/... (navega con #N)
  html_slide_count int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table deck_slides (
  deck_id text not null references decks(id) on delete cascade,
  position int not null,                       -- 0-based
  slide_id uuid not null references slides(id) on delete restrict,
  primary key (deck_id, position)
);
create index on deck_slides (slide_id);

-- ---------- clase en vivo ----------
create table live_sessions (
  id uuid primary key default gen_random_uuid(),
  deck_id text not null references decks(id) on delete cascade,
  class_session_id text references class_sessions(id) on delete set null,
  code text not null unique,                   -- 6 caracteres, lo que va en el QR
  status text not null default 'live' check (status in ('live', 'ended')),
  current_position int not null default 0,
  overlay jsonb,                               -- overlay visible en el proyector y en los celulares
  transcript_enabled boolean not null default false,
  started_by uuid references people(id) on delete set null,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

create table live_events (
  id bigserial primary key,
  live_session_id uuid not null references live_sessions(id) on delete cascade,
  type text not null,                          -- slide.goto, overlay.set, poll.created, slide.inserted, …
  payload jsonb not null default '{}',
  actor text not null default 'profesor',      -- 'profesor' | 'agent' | 'alumno:<id>'
  created_at timestamptz not null default now()
);
create index on live_events (live_session_id, id);

create table transcript_segments (
  id bigserial primary key,
  live_session_id uuid not null references live_sessions(id) on delete cascade,
  slide_position int,
  slide_id uuid references slides(id) on delete set null,
  speaker text not null default 'profesor',
  text text not null,
  is_command boolean not null default false,   -- lo dicho con el micrófono del agente activado
  created_at timestamptz not null default now()
);
create index on transcript_segments (live_session_id, id);

create table agent_turns (
  id bigserial primary key,
  live_session_id uuid references live_sessions(id) on delete cascade,
  person_id uuid references people(id) on delete set null,
  surface text not null default 'live' check (surface in ('live', 'authoring', 'mcp')),
  utterance text not null,
  tool_calls jsonb not null default '[]',
  reply text,
  error text,
  latency_ms int,
  created_at timestamptz not null default now()
);

-- ---------- encuestas ----------
create table polls (
  id uuid primary key default gen_random_uuid(),
  live_session_id uuid references live_sessions(id) on delete cascade,
  deck_id text references decks(id) on delete set null,
  slide_id uuid references slides(id) on delete set null,
  kind text not null check (kind in ('single', 'multiple', 'open', 'scale', 'wordcloud')),
  question text not null,
  options jsonb not null default '[]',         -- [{id, label}]
  status text not null default 'open' check (status in ('draft', 'open', 'closed')),
  anonymous boolean not null default false,
  created_by text not null default 'profesor', -- 'profesor' | 'agent' | 'slide'
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

create table poll_responses (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references polls(id) on delete cascade,
  person_id uuid references people(id) on delete cascade,
  guest_key text,                              -- invitado sin login (cookie)
  guest_name text,
  choice jsonb,                                -- ['opt-a'] o número para scale
  text text,
  created_at timestamptz not null default now()
);
create unique index on poll_responses (poll_id, person_id) where person_id is not null;
create unique index on poll_responses (poll_id, guest_key) where guest_key is not null;

-- ---------- lo que el alumno marca y anota ----------
create table slide_marks (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references people(id) on delete cascade,
  deck_id text not null references decks(id) on delete cascade,
  slide_id uuid references slides(id) on delete cascade,
  position int not null,
  kind text not null check (kind in ('no-entendi', 'clave', 'pregunta', 'idea')),
  live_session_id uuid references live_sessions(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (person_id, deck_id, position, kind)
);
create index on slide_marks (deck_id, position);

create table slide_notes (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references people(id) on delete cascade,
  deck_id text not null references decks(id) on delete cascade,
  slide_id uuid references slides(id) on delete cascade,
  position int not null,
  body text not null default '',
  quote text,                                  -- texto subrayado de la slide
  visibility text not null default 'privada' check (visibility in ('privada', 'cohorte')),
  live_session_id uuid references live_sessions(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on slide_notes (deck_id, position);
create index on slide_notes (person_id);

-- ---------- casos, posturas, participación ----------
create table cases (
  id text primary key,                         -- 'pampa-sur-j1'
  course_id text not null references courses(id) on delete cascade,
  class_session_id text references class_sessions(id) on delete set null,
  title text not null,
  protagonist text,
  summary text,
  body_md text not null default '',
  question text not null,
  postures jsonb not null default '[]',        -- [{id, label, description}]
  teacher_notes text,
  is_fictional boolean not null default true,
  opens_at timestamptz,
  closes_at timestamptz
);

create table case_postures (
  id uuid primary key default gen_random_uuid(),
  case_id text not null references cases(id) on delete cascade,
  person_id uuid not null references people(id) on delete cascade,
  posture_id text not null,
  justification text not null default '',
  confidence smallint check (confidence between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (case_id, person_id)
);

-- Randomizador: cada "ronda" saca sin repetir hasta que el profesor reinicia.
create table cold_call_rounds (
  id uuid primary key default gen_random_uuid(),
  course_id text not null references courses(id) on delete cascade,
  started_at timestamptz not null default now(),
  started_by uuid references people(id) on delete set null,
  reason text
);

create table cold_call_draws (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references cold_call_rounds(id) on delete cascade,
  live_session_id uuid references live_sessions(id) on delete set null,
  case_id text references cases(id) on delete set null,
  person_id uuid not null references people(id) on delete cascade,
  outcome text not null default 'pendiente' check (outcome in ('pendiente', 'participo', 'paso', 'ausente')),
  drawn_by text not null default 'profesor',   -- 'profesor' | 'agent'
  created_at timestamptz not null default now()
);

create table participation (
  id uuid primary key default gen_random_uuid(),
  course_id text not null references courses(id) on delete cascade,
  class_session_id text references class_sessions(id) on delete set null,
  live_session_id uuid references live_sessions(id) on delete set null,
  person_id uuid not null references people(id) on delete cascade,
  kind text not null check (kind in ('intervencion', 'cold-call', 'pregunta', 'aporte', 'debate')),
  quality smallint check (quality between 1 and 3),
  note text,
  transcript_segment_id bigint references transcript_segments(id) on delete set null,
  source text not null default 'manual' check (source in ('manual', 'randomizer', 'agent')),
  created_at timestamptz not null default now()
);
create index on participation (course_id, person_id);

-- ---------- entregas con rúbrica y revisión entre pares ----------
create table assignments (
  id text primary key,
  course_id text not null references courses(id) on delete cascade,
  class_session_id text references class_sessions(id) on delete set null,
  title text not null,
  brief_md text not null,
  rubric jsonb not null default '[]',          -- [{id, criterion, weight, levels:[{score, label, description}]}]
  due_at timestamptz,
  peer_reviews_per_submission int not null default 2,
  status text not null default 'abierta' check (status in ('borrador', 'abierta', 'revision-pares', 'cerrada'))
);

create table submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id text not null references assignments(id) on delete cascade,
  person_id uuid not null references people(id) on delete cascade,
  body_md text not null default '',
  url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assignment_id, person_id)
);

create table peer_reviews (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references submissions(id) on delete cascade,
  reviewer_id uuid not null references people(id) on delete cascade,
  scores jsonb not null default '{}',          -- {criterionId: score}
  comment text,
  status text not null default 'asignada' check (status in ('asignada', 'enviada')),
  is_teacher boolean not null default false,
  created_at timestamptz not null default now(),
  submitted_at timestamptz,
  unique (submission_id, reviewer_id)
);

-- ---------- simuladores ----------
create table sim_definitions (
  id text primary key,                         -- 'agrodecide'
  title text not null,
  description text,
  url text not null,                           -- '/sims/agrodecide.html'
  course_id text references courses(id) on delete set null,
  meta jsonb not null default '{}'
);

create table sim_runs (
  id uuid primary key default gen_random_uuid(),
  sim_id text not null references sim_definitions(id) on delete cascade,
  person_id uuid references people(id) on delete cascade,
  live_session_id uuid references live_sessions(id) on delete set null,
  status text not null default 'en-curso' check (status in ('en-curso', 'completada', 'abandonada')),
  score numeric,
  summary jsonb not null default '{}',
  state jsonb not null default '{}',
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create table sim_events (
  id bigserial primary key,
  run_id uuid not null references sim_runs(id) on delete cascade,
  type text not null,                          -- verbo estilo xAPI: 'decided', 'completed', …
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index on sim_events (run_id, id);

-- ---------- tutor ----------
create table tutor_threads (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references people(id) on delete cascade,
  deck_id text references decks(id) on delete set null,
  slide_id uuid references slides(id) on delete set null,
  position int,
  mode text not null default 'socratico' check (mode in ('socratico', 'sparring', 'examinador', 'coach')),
  created_at timestamptz not null default now()
);

create table tutor_messages (
  id bigserial primary key,
  thread_id uuid not null references tutor_threads(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

-- ---------- contenido ----------
create table concepts (
  id text primary key,
  course_id text not null references courses(id) on delete cascade,
  name text not null,
  summary text,
  block text,
  prereqs text[] not null default '{}'
);

create table content_items (
  id text primary key,
  course_id text not null references courses(id) on delete cascade,
  class_session_id text references class_sessions(id) on delete set null,
  kind text not null check (kind in ('video', 'lectura', 'caso', 'link', 'ejemplo')),
  title text not null,
  url text,
  body_md text,
  transcript text,
  concept_ids text[] not null default '{}',
  position int not null default 0
);

-- ---------- MCP ----------
create table api_tokens (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references people(id) on delete cascade,
  label text not null,
  token_hash text not null unique,             -- sha256 del token; el token se muestra una sola vez
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

-- RLS en todo, sin políticas: solo el service role lee y escribe.
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;
