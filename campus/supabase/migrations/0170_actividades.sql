-- Actividades de clase, office hours y radar semanal. Idempotente.
--
-- Las definiciones de las actividades (consigna, tiempos, plantilla) viven en
-- código (lib/actividades/catalog.ts). Acá se guarda lo que produce cada
-- alumno y el estado que maneja el profesor (parejas, cronómetro, votación).
-- Todo se accede con el service role desde el servidor (RLS sin políticas).

-- ---------- actividades ----------
-- Lo que produce cada persona en una actividad (plantilla, URL, progreso…).
create table if not exists activity_entries (
  id uuid primary key default gen_random_uuid(),
  activity_id text not null,
  person_id uuid not null references people(id) on delete cascade,
  data jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (activity_id, person_id)
);
create index if not exists activity_entries_activity_idx on activity_entries (activity_id);

-- Registros sueltos: bugs reportados, ataques y defensas, votos.
create table if not exists activity_items (
  id uuid primary key default gen_random_uuid(),
  activity_id text not null,
  kind text not null,                           -- 'bug' | 'ataque' | 'voto'
  person_id uuid not null references people(id) on delete cascade,        -- autor
  target_person_id uuid references people(id) on delete cascade,           -- sobre quién (dueño de la app, defensor, presentador)
  data jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists activity_items_activity_idx on activity_items (activity_id, kind, created_at);
create index if not exists activity_items_target_idx on activity_items (target_person_id);
-- Un voto por persona y presentador.
create unique index if not exists activity_items_voto_uq on activity_items (activity_id, person_id, target_person_id) where kind = 'voto';

-- Estado que maneja el profesor (parejas, cronómetro, roles, orden, votación abierta).
create table if not exists activity_state (
  activity_id text primary key,
  state jsonb not null default '{}',
  updated_by uuid references people(id) on delete set null,
  updated_at timestamptz not null default now()
);

-- ---------- office hours ----------
create table if not exists office_hour_slots (
  id uuid primary key default gen_random_uuid(),
  course_id text not null references courses(id) on delete cascade,
  teacher_id uuid not null references people(id) on delete cascade,
  starts_at timestamptz not null,
  minutes int not null default 30 check (minutes between 10 and 180),
  mode text not null default 'online' check (mode in ('online', 'presencial')),
  location text,                                -- link de la videollamada o lugar
  capacity int not null default 1 check (capacity between 1 and 20),
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists office_hour_slots_course_idx on office_hour_slots (course_id, starts_at);

create table if not exists office_hour_bookings (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null references office_hour_slots(id) on delete cascade,
  person_id uuid not null references people(id) on delete cascade,
  topic text not null default '',
  created_at timestamptz not null default now(),
  unique (slot_id, person_id)
);
create index if not exists office_hour_bookings_person_idx on office_hour_bookings (person_id);

-- Reserva atómica: respeta el cupo aunque dos alumnos reserven a la vez.
-- Devuelve 'ok' | 'lleno' | 'pasado' | 'ya' | 'no-existe'.
create or replace function public.oh_book(p_slot uuid, p_person uuid, p_topic text)
returns text
language plpgsql
as $$
declare
  s office_hour_slots%rowtype;
  n int;
begin
  select * into s from office_hour_slots where id = p_slot for update;
  if not found then return 'no-existe'; end if;
  if s.starts_at <= now() then return 'pasado'; end if;
  if exists (select 1 from office_hour_bookings where slot_id = p_slot and person_id = p_person) then
    update office_hour_bookings set topic = coalesce(p_topic, '') where slot_id = p_slot and person_id = p_person;
    return 'ya';
  end if;
  select count(*) into n from office_hour_bookings where slot_id = p_slot;
  if n >= s.capacity then return 'lleno'; end if;
  insert into office_hour_bookings (slot_id, person_id, topic) values (p_slot, p_person, coalesce(p_topic, ''));
  return 'ok';
end $$;

-- ---------- radar semanal ----------
create table if not exists radar_items (
  id uuid primary key default gen_random_uuid(),
  course_id text not null references courses(id) on delete cascade,
  week_start date not null,                     -- lunes de la semana
  ordinal smallint not null default 1,
  title text not null,
  url text,
  source text,
  summary text not null default '',
  created_by uuid references people(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists radar_items_week_idx on radar_items (course_id, week_start);


-- ---------- permisos (igual que 0140) ----------
alter table activity_entries enable row level security;
alter table activity_items enable row level security;
alter table activity_state enable row level security;
alter table office_hour_slots enable row level security;
alter table office_hour_bookings enable row level security;
alter table radar_items enable row level security;

revoke all on activity_entries, activity_items, activity_state, office_hour_slots, office_hour_bookings, radar_items from anon, authenticated;
revoke execute on function public.oh_book(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.oh_book(uuid, uuid, text) to service_role;
