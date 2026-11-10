-- Media de los decks (imágenes, videos, audio, PDF) en Supabase Storage.
-- Bucket público `media`: las slides las muestran con su URL pública, también
-- en el celular del alumno. Se sube con URL firmada que da el servidor al
-- profesor (o con service role desde los seeds); nadie sube con la anon key.
-- `media_assets` registra qué archivo es de qué deck y quién lo subió.
-- Idempotente.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'media', 'media', true, 52428800,
  array['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif', 'image/svg+xml',
        'video/mp4', 'video/webm', 'audio/mpeg', 'audio/mp4', 'audio/wav', 'application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists media_assets (
  id uuid primary key default gen_random_uuid(),
  path text not null unique,                   -- dentro del bucket: decks/<deck>/<archivo>
  deck_id text references decks(id) on delete set null,
  course_id text references courses(id) on delete set null,
  filename text not null,                      -- nombre original
  content_type text not null,
  size_bytes bigint not null,
  uploaded_by uuid references people(id) on delete set null,
  via text not null default 'editor' check (via in ('editor', 'import')),
  created_at timestamptz not null default now()
);
create index if not exists media_assets_deck_idx on media_assets (deck_id, created_at desc);

alter table media_assets enable row level security;
revoke all on media_assets from anon, authenticated;
