-- Archivos: el bucket de Supabase Storage donde quedan el material de los
-- espacios y las copias de los adjuntos de Discord, cuyas URLs vencen. Solo lo
-- lee y escribe el adaptador lib/adapters/supabase/files.ts.
--
-- El material de un espacio lo ven solo sus miembros, así que el bucket es
-- privado: ningún archivo tiene URL pública. El servidor sube y baja con el
-- service role, y la app entrega cada archivo por su ruta propia
-- (/archivos/<id>/<nombre>) a quien tiene sesión. Por eso no hay políticas
-- sobre storage.objects: sin políticas, los roles públicos no ven nada.
--
-- El límite de tamaño (10 MB) es el mismo que declara el puerto de Archivos.
-- Si el bucket ya existía, se vuelve a dejar privado y con ese límite.
-- Es de HackAI: va también en producción.
-- Idempotente: se puede correr de nuevo sin romper nada.

begin;

insert into storage.buckets (id, name, public, file_size_limit)
values ('hackai-files', 'hackai-files', false, 10485760)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit;

commit;
