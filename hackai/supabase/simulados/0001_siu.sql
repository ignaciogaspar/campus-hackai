-- SIU simulado: tablas siu_* con la forma de la API REST v2 de Guaraní
-- (docs/research/2026-11-10-siu-guarani-integracion.md, sección 3.2).
-- Las columnas van en inglés, como los tipos del puerto (lib/ports/siu.ts);
-- cuando copian un campo de la API, al lado va su nombre. Las que no lo
-- tienen no tienen un campo equivalente directo en la research.
--
-- Copian el subconjunto de cada esquema que usa el puerto. Quedan afuera,
-- entre otros: catedra y turno de Comision; propuesta e id_actividad de
-- Inscripcion; creditos, forma_aprobacion, folio_fisico, promedio y
-- plan_alumno de Historia. Se suman cuando un ticket los necesite.
--
-- Son tablas de la demo: van aparte de las migraciones propias
-- (supabase/migrations/) para no aplicarlas en producción, donde el SIU es la
-- API real. Solo las lee y escribe el adaptador lib/adapters/siu-simulado/.
-- Idempotente: se puede correr de nuevo sin romper nada. Los datos los carga
-- siu_seed.sql.

begin;

-- Facultades (unidades académicas).
create table if not exists siu_schools (
  id text primary key,
  name text not null
);

-- Propuestas formativas (/propuestas-formativas).
create table if not exists siu_programs (
  id text primary key,                -- propuesta
  name text not null                  -- nombre
);

-- Personas (/personas, /alumnos, /docentes).
create table if not exists siu_persons (
  id text primary key,                -- persona
  surname text not null,              -- apellido
  names text not null,                -- nombres
  email text not null,                -- email
  role text not null check (role in ('alumno', 'profesor')),
  school_id text not null references siu_schools (id)
);

-- Propuestas de cada alumno, con su calidad (activa o pasiva).
create table if not exists siu_person_programs (
  person_id text not null references siu_persons (id) on delete cascade,
  program_id text not null references siu_programs (id),
  status text not null check (status in ('activa', 'pasiva')),
  position integer not null default 0,
  primary key (person_id, program_id)
);

-- Períodos lectivos, con su ventana de inscripción a cursada.
create table if not exists siu_terms (
  id text primary key,                -- periodo_lectivo
  name text not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  enrollment_start timestamptz not null,
  enrollment_end timestamptz not null
);

-- Materias (actividades).
create table if not exists siu_subjects (
  id text primary key,                -- id_actividad
  code text not null,                 -- actividad_codigo
  name text not null                  -- actividad_nombre
);
alter table siu_subjects add column if not exists credits integer;   -- creditos

-- Comisiones (/comisiones, esquema Comision).
create table if not exists siu_sections (
  id text primary key,                -- comision
  name text not null,                 -- nombre
  subject_id text not null references siu_subjects (id),   -- actividad
  school_id text not null references siu_schools (id),
  term_id text not null references siu_terms (id),         -- periodo_lectivo
  teacher_ids text[] not null default '{}',                 -- docentes
  schedule jsonb not null default '[]',                     -- horarios
  location text not null,                                   -- ubicacion
  modality text not null check (modality in ('presencial', 'virtual', 'hibrida')),  -- modalidades
  instance text not null check (instance in ('promocion', 'regularidad')),          -- instancias
  capacity integer check (capacity is null or capacity >= 0)                       -- cupo; null es «sin definir»
);

create index if not exists siu_sections_teacher_ids on siu_sections using gin (teacher_ids);

-- Para una base creada antes de que las comisiones dijeran su carrera y sus observaciones.
alter table siu_sections add column if not exists program_ids text[] not null default '{}';  -- propuestas
alter table siu_sections add column if not exists notes text;                                 -- observaciones

-- Planes de estudio (/propuestas/{propuesta}/planes): uno vigente por propuesta.
create table if not exists siu_study_plans (
  program_id text primary key references siu_programs (id),  -- propuesta
  name text not null,                 -- plan
  years integer not null check (years > 0),                  -- duracion_teorica
  electives_required integer not null default 0,
  university_life_required integer not null default 0
);

-- Materias de cada plan, con el año de la carrera (null: cualquier año).
create table if not exists siu_plan_subjects (
  program_id text not null references siu_study_plans (program_id) on delete cascade,
  subject_id text not null references siu_subjects (id),
  year integer check (year is null or year > 0),             -- anio_de_cursada
  kind text not null check (kind in ('obligatoria', 'optativa', 'vida-universitaria')),
  position integer not null default 0,
  primary key (program_id, subject_id)
);

-- Inscripciones a cursada (/inscripciones, esquema Inscripcion).
create table if not exists siu_course_enrollments (
  id text primary key,                -- inscripcion
  transaction_number text not null unique,                  -- nro_transaccion
  person_id text not null references siu_persons (id),
  section_id text not null references siu_sections (id),   -- id_comision
  enrolled_at timestamptz not null,                         -- fecha_inscripcion
  status text not null check (status in ('aceptada', 'pendiente', 'rechazada', 'baja'))  -- estado
);

create index if not exists siu_course_enrollments_person on siu_course_enrollments (person_id);
-- Una sola inscripción vigente por persona y comisión.
create unique index if not exists siu_course_enrollments_active
  on siu_course_enrollments (person_id, section_id) where status in ('aceptada', 'pendiente');

-- Mesas de examen (llamado_mesa), con su ventana de inscripción.
create table if not exists siu_exam_boards (
  id text primary key,                -- llamado_mesa
  subject_id text not null references siu_subjects (id),
  school_id text not null references siu_schools (id),
  exam_period text not null,          -- turno
  date timestamptz not null,
  location text not null,             -- ubicacion
  teacher_ids text[] not null default '{}',
  capacity integer check (capacity is null or capacity >= 0),
  enrollment_start timestamptz not null,
  enrollment_end timestamptz not null
);

alter table siu_exam_boards add column if not exists notes text;  -- observaciones

-- Inscripciones a examen (/inscripciones-mesas, esquema InscripcionMesa).
create table if not exists siu_exam_enrollments (
  id text primary key,                -- inscripcion
  transaction_number text not null unique,                  -- nro_transaccion
  person_id text not null references siu_persons (id),
  exam_board_id text not null references siu_exam_boards (id),  -- llamado_mesa
  enrolled_at timestamptz not null,                         -- fecha_inscripcion
  status text not null check (status in ('aceptada', 'pendiente', 'rechazada', 'baja'))  -- estado
);

create index if not exists siu_exam_enrollments_person on siu_exam_enrollments (person_id);
create unique index if not exists siu_exam_enrollments_active
  on siu_exam_enrollments (person_id, exam_board_id) where status in ('aceptada', 'pendiente');

-- Cronograma de evaluaciones de cada comisión. No existe en la API real: lo
-- agrega el simulado (capacidad hasAssessmentSchedule).
create table if not exists siu_assessments (
  id text primary key,
  section_id text not null references siu_sections (id),
  name text not null,
  kind text not null check (kind in ('parcial', 'recuperatorio', 'tp')),
  date timestamptz not null
);

-- Historia académica (/personas/{persona}/datosanalitico, esquema Historia).
-- Los renglones 'evaluacion' son notas de parciales o TP que el docente cargó
-- en la historia y no en un acta abierta: llevan su comisión y su evaluación.
-- Que el SIU de la Austral las muestre así es una hipótesis.
create table if not exists siu_history (
  id text primary key,
  person_id text not null references siu_persons (id),
  subject_id text not null references siu_subjects (id),   -- actividad_codigo
  type text not null,                 -- tipo
  date timestamptz not null,          -- fecha
  grade numeric,                      -- nota
  result text not null check (result in ('promocionado', 'aprobado', 'regular', 'desaprobado', 'ausente', 'libre')),  -- resultado
  grade_record text not null,         -- acta_resolucion
  section_id text references siu_sections (id),
  assessment_id text references siu_assessments (id)
);

-- Para una base creada antes de que existieran los renglones 'evaluacion'.
alter table siu_history add column if not exists section_id text references siu_sections (id);
alter table siu_history add column if not exists assessment_id text references siu_assessments (id);
alter table siu_history drop constraint if exists siu_history_type_check;
alter table siu_history add constraint siu_history_type_check
  check (type in ('cursada', 'examen', 'promocion', 'equivalencia', 'evaluacion'));
alter table siu_history drop constraint if exists siu_history_evaluation_check;
alter table siu_history add constraint siu_history_evaluation_check
  check ((type = 'evaluacion') = (section_id is not null and assessment_id is not null));

-- Cuándo se cargó la nota de una evaluación, si el SIU lo dice (la campana y Novedades muestran las nuevas).
alter table siu_history add column if not exists loaded_at timestamptz;

-- Notas cargadas en actas todavía abiertas (actuación provisoria).
create table if not exists siu_provisional_results (
  id text primary key,
  person_id text not null references siu_persons (id),
  section_id text not null references siu_sections (id),
  assessment_id text not null references siu_assessments (id),
  grade numeric,
  date timestamptz not null
);

-- Cuándo se cargó la nota, si el SIU lo dice; `date` es la fecha de la evaluación.
alter table siu_provisional_results add column if not exists loaded_at timestamptz;

-- Inasistencias del alumno (Reportes > Inasistencias), por comisión.
create table if not exists siu_absences (
  id text primary key,
  person_id text not null references siu_persons (id),
  section_id text not null references siu_sections (id),
  date timestamptz not null,
  justified boolean not null
);

-- Máximo de inasistencias de una comisión. Que el SIU de la Austral lo dé es
-- una hipótesis (docs/product/preguntas-abiertas.md): sin fila, no hay máximo.
create table if not exists siu_absence_limits (
  section_id text primary key references siu_sections (id),
  max integer not null check (max >= 0)
);

-- Condiciones de cada constancia (/alumnos/{alumno}/certificados/{certificado}).
create table if not exists siu_certificates (
  person_id text not null references siu_persons (id),
  type text not null check (type in ('alumno-regular', 'examen-final')),
  meets_conditions boolean not null,  -- cumple_condiciones
  primary key (person_id, type)
);

-- Solo el servidor con service role las toca: RLS sin políticas y sin acceso
-- para los roles públicos.
alter table siu_schools enable row level security;
alter table siu_programs enable row level security;
alter table siu_persons enable row level security;
alter table siu_person_programs enable row level security;
alter table siu_terms enable row level security;
alter table siu_subjects enable row level security;
alter table siu_sections enable row level security;
alter table siu_course_enrollments enable row level security;
alter table siu_exam_boards enable row level security;
alter table siu_exam_enrollments enable row level security;
alter table siu_assessments enable row level security;
alter table siu_history enable row level security;
alter table siu_provisional_results enable row level security;
alter table siu_absences enable row level security;
alter table siu_absence_limits enable row level security;
alter table siu_certificates enable row level security;
alter table siu_study_plans enable row level security;
alter table siu_plan_subjects enable row level security;

revoke all on table
  siu_schools, siu_programs, siu_persons, siu_person_programs, siu_terms, siu_subjects, siu_sections,
  siu_course_enrollments, siu_exam_boards, siu_exam_enrollments, siu_assessments, siu_history,
  siu_provisional_results, siu_certificates, siu_study_plans, siu_plan_subjects, siu_absences,
  siu_absence_limits
from anon, authenticated;

commit;
