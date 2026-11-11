-- Espacios: el espacio de cada materia, con sus canales, sus mensajes, su
-- material y hasta dónde leyó cada persona cada canal. Es el almacén del
-- módulo Espacios (lib/core/spaces): solo lo lee y escribe su adaptador
-- lib/adapters/supabase/spaces-store.ts.
--
-- Los ids de las personas, las materias, las comisiones y los sistemas de
-- origen (Discord, Moodle) se guardan tal como vienen, como texto, así los
-- datos de producción entran sin migrar nada. Los ids propios de HackAI
-- (espacios, canales, mensajes, material) son uuid.
--
-- `seq` es un contador que crece con cada canal, mensaje o archivo que entra:
-- ordena las lecturas y marca hasta dónde leyó cada persona.
--
-- Es una tabla propia de HackAI: va también en producción. Arranca vacía: los
-- espacios se crean la primera vez que alguien los abre.
-- Idempotente: se puede correr de nuevo sin romper nada.

begin;

-- Un espacio por materia y facultad.
create table if not exists spaces (
  id uuid primary key default gen_random_uuid(),
  subject_id text not null,           -- id de la materia en Cursada
  subject_code text not null,
  school_id text not null,            -- id de la facultad
  name text not null,                 -- el nombre de la materia
  material_layout text not null check (material_layout in ('unidad', 'semana', 'todo')),
  created_at timestamptz not null default now(),
  unique (subject_id, school_id)
);

-- Canales de un espacio. El nombre no se repite dentro de un mismo alcance:
-- dos comisiones pueden tener cada una su `avisos`. `scope_key` resume el
-- alcance para esa clave única: 'materia', 'comision:<sectionId>' o
-- 'directo:<personId>:<personId>' con los dos ids ordenados.
create table if not exists space_channels (
  id uuid primary key default gen_random_uuid(),
  seq bigint generated always as identity unique,
  space_id uuid not null references spaces (id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('material', 'avisos', 'consultas', 'directo', 'libre')),
  scope_kind text not null check (scope_kind in ('materia', 'comision', 'directo')),
  section_id text,                    -- id de la comisión, solo si el alcance es una comisión
  person_ids text[],                  -- las dos personas, solo si es un canal directo
  scope_key text not null,
  external_system text check (external_system in ('discord')),
  external_channel_id text,           -- id del canal vinculado en el canal externo
  created_at timestamptz not null default now(),
  unique (space_id, scope_key, name),
  check ((scope_kind = 'comision') = (section_id is not null)),
  check ((scope_kind = 'directo') = (person_ids is not null and cardinality(person_ids) = 2)),
  check ((external_system is null) = (external_channel_id is null))
);

create index if not exists space_channels_space_idx on space_channels (space_id, seq);

-- Mensajes de un canal. Cada uno guarda su origen y su id externo, y no entra
-- dos veces al mismo canal.
create table if not exists space_messages (
  id uuid primary key default gen_random_uuid(),
  seq bigint generated always as identity unique,
  channel_id uuid not null references space_channels (id) on delete cascade,
  author_id text,                     -- la persona de HackAI que lo escribió
  author_name text,                   -- el nombre con que llegó de un canal externo sin vincular
  text text not null,
  attachments jsonb not null default '[]'::jsonb,
  origin text not null check (origin in ('hackai', 'discord', 'moodle')),
  external_id text,                   -- su id en el sistema de origen
  status text not null check (status in ('publicado', 'pendiente')),
  reply_to uuid references space_messages (id) on delete cascade,
  resolved boolean,                   -- null si no es una consulta
  created_at timestamptz not null,
  unique (channel_id, external_id)
);

create index if not exists space_messages_channel_idx on space_messages (channel_id, seq);

-- Material de un espacio. Un archivo de un sistema de origen no entra dos
-- veces al mismo espacio.
create table if not exists space_material (
  id uuid primary key default gen_random_uuid(),
  seq bigint generated always as identity unique,
  space_id uuid not null references spaces (id) on delete cascade,
  name text not null,
  url text not null,
  content_type text not null,
  size bigint not null,
  section text,                       -- la unidad o el tema, si el docente eligió uno
  origin text not null check (origin in ('hackai', 'discord', 'moodle')),
  external_id text,
  added_by text,                      -- la persona que lo subió, si es de HackAI
  added_at timestamptz not null,
  unique (space_id, origin, external_id)
);

create index if not exists space_material_space_idx on space_material (space_id, seq);

-- Hasta qué `seq` leyó cada persona cada canal. Sin fila: nunca lo abrió.
create table if not exists space_reads (
  person_id text not null,
  channel_id uuid not null references space_channels (id) on delete cascade,
  last_seq bigint not null,
  updated_at timestamptz not null default now(),
  primary key (person_id, channel_id)
);

-- Marca leído hasta `p_seq` sin retroceder nunca: si ya había leído más, no
-- cambia nada. De un canal que no existe no deja marca.
create or replace function space_mark_read(p_person_id text, p_channel_id uuid, p_seq bigint)
returns void
language sql
set search_path = public
as $$
  insert into space_reads (person_id, channel_id, last_seq)
  select p_person_id, p_channel_id, p_seq
  where exists (select 1 from space_channels where id = p_channel_id)
  on conflict (person_id, channel_id)
  do update set last_seq = greatest(space_reads.last_seq, excluded.last_seq), updated_at = now();
$$;

-- Solo el servidor con service role las toca: RLS sin políticas y sin acceso
-- para los roles públicos.
alter table spaces enable row level security;
alter table space_channels enable row level security;
alter table space_messages enable row level security;
alter table space_material enable row level security;
alter table space_reads enable row level security;

revoke all on table spaces, space_channels, space_messages, space_material, space_reads from anon, authenticated;

revoke execute on function space_mark_read(text, uuid, bigint) from public, anon, authenticated;

-- El service role, con el que entra el servidor, la llama por rpc.
grant execute on function space_mark_read(text, uuid, bigint) to service_role;

commit;
