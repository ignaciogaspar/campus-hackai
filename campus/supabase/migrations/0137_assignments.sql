-- Entregas: configuración de calificación y de la asignación entre pares.
-- Idempotente. No toca tablas existentes: agrega una tabla 1-1 con assignments.

create table if not exists assignment_settings (
  assignment_id text primary key references assignments(id) on delete cascade,
  -- cómo se calcula la nota final de cada alumno
  grade_mode text not null default 'docente-o-pares'
    check (grade_mode in ('docente-o-pares', 'media-pares', 'mediana-pares', 'mixta')),
  -- peso del docente en el modo 'mixta' (0..1); el resto es la media de pares
  teacher_weight numeric not null default 0.5 check (teacher_weight >= 0 and teacher_weight <= 1),
  -- desvío (en puntos porcentuales del puntaje ponderado) a partir del cual una revisión es discordante
  discord_threshold numeric not null default 20 check (discord_threshold > 0 and discord_threshold <= 100),
  -- semilla y fecha de la última asignación entre pares (para reproducirla)
  assignment_seed text,
  assigned_at timestamptz,
  updated_at timestamptz not null default now()
);
