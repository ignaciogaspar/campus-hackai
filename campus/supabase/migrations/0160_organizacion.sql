-- Mi organización + verificación del entorno + casos inactivos.
-- Idempotente: se puede correr de nuevo sin efectos.

-- La organización real sobre la que trabaja cada alumno (una por persona y curso).
create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  course_id text not null references courses(id) on delete cascade,
  person_id uuid not null references people(id) on delete cascade,
  name text not null,
  kind text not null default 'empresa'
    check (kind in ('empresa', 'empresa-familiar', 'donde-trabajo', 'proyecto')),
  industry text,
  size text check (size is null or size in ('1-10', '11-50', '51-200', '201-1000', '1000+')),
  my_role text,
  description text not null default '',
  -- [{id, name, pain, volume, owner}] 3 a 5 procesos candidatos
  processes jsonb not null default '[]',
  -- [{id, name, where, notes}]
  data_assets jsonb not null default '[]',
  -- [{id, name, use}]
  systems jsonb not null default '[]',
  -- links que se van sumando (repo, app desplegada, etc.)
  links jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, person_id)
);

-- Cada guardado deja una foto: así se ve cómo se fue enriqueciendo.
create table if not exists organization_revisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists organization_revisions_org_idx on organization_revisions (organization_id, created_at desc);

-- Verificación del entorno: cada llamada a la herramienta MCP `hola_campus`.
create table if not exists environment_checks (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references people(id) on delete cascade,
  token_id uuid references api_tokens(id) on delete set null,
  client text,
  client_version text,
  os text,
  github_user text,
  vercel_user text,
  supabase text,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists environment_checks_person_idx on environment_checks (person_id, created_at desc);

-- Casos activos/inactivos: los ficticios (Pampa Sur) quedan inactivos, no se borran.
alter table cases add column if not exists is_active boolean not null default true;
update cases set is_active = false where id like 'pampa-sur-%' and is_active;

alter table organizations enable row level security;
alter table organization_revisions enable row level security;
alter table environment_checks enable row level security;
