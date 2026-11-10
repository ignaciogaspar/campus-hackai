-- Instalador de un comando (curl …/setup | bash): emparejamiento tipo «device code».
-- El script pide un par de códigos; el alumno confirma el corto en /conectar y el
-- script recibe una sola vez un token MCP nuevo. El token no se guarda acá: se crea
-- (api_tokens, solo sha256) en el momento de entregarlo.
-- Idempotente: se puede correr de nuevo sin efectos.

create table if not exists setup_pairings (
  id uuid primary key default gen_random_uuid(),
  -- sha256 del código secreto que solo conoce el script
  device_hash text not null unique,
  -- código corto que ve el alumno (XXXX-XXXX)
  user_code text not null unique,
  hostname text,
  os text,
  ip text,
  status text not null default 'pendiente'
    check (status in ('pendiente', 'aprobado', 'rechazado', 'entregado')),
  person_id uuid references people(id) on delete cascade,
  token_id uuid references api_tokens(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '10 minutes',
  approved_at timestamptz,
  delivered_at timestamptz
);
create index if not exists setup_pairings_expires_idx on setup_pairings (expires_at);

alter table setup_pairings enable row level security;
