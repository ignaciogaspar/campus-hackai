-- Generado por npm run siu:seed desde lib/adapters/synthetic-data.ts. No lo edites a mano.

begin;

delete from siu_course_enrollments where id <> all (array['ic-1', 'ic-2', 'ic-3', 'ic-4', 'ic-5', 'ic-6', 'ic-7', 'ic-8', 'ic-9', 'ic-10', 'ic-11', 'ic-12', 'ic-13', 'ic-14', 'ic-15', 'ic-16', 'ic-17', 'ic-18', 'ic-19', 'ic-20', 'ic-21', 'ic-22', 'ic-23']::text[]);

delete from siu_exam_enrollments where id <> all (array['ie-1', 'ie-2']::text[]);

delete from siu_history where id <> all (array['ha-1', 'ha-2', 'ha-3', 'ha-4', 'ha-5', 'ha-6', 'ha-7', 'ha-8', 'ha-9', 'ha-10', 'ha-11', 'ha-12', 'ha-13', 'ha-14', 'ha-15', 'ha-16', 'ha-17', 'ha-18']::text[]);

delete from siu_provisional_results where id <> all (array['ap-1', 'ap-2', 'ap-3', 'ap-4', 'ap-5', 'ap-6', 'ap-7', 'ap-8', 'ap-9', 'ap-10', 'ap-11', 'ap-12']::text[]);

insert into siu_schools (id, name) values
  ('fi', 'Facultad de Ingeniería'),
  ('fce', 'Facultad de Ciencias Empresariales')
on conflict (id) do update set name = excluded.name;

insert into siu_programs (id, name) values
  ('iinf', 'Ingeniería en Informática'),
  ('asp-fi', 'Aspirantes - fi'),
  ('iind', 'Ingeniería Industrial'),
  ('ladm', 'Licenciatura en Administración de Empresas'),
  ('cpub', 'Contador Público')
on conflict (id) do update set name = excluded.name;

insert into siu_persons (id, surname, names, email, role, school_id) values
  ('20101', 'Ledesma', 'Mariana', 'mariana.ledesma@example.edu.ar', 'profesor', 'fi'),
  ('20102', 'Ferreyra', 'Gustavo', 'gustavo.ferreyra@example.edu.ar', 'profesor', 'fi'),
  ('20103', 'Bustos', 'Carolina', 'carolina.bustos@example.edu.ar', 'profesor', 'fce'),
  ('20104', 'Arrieta', 'Diego', 'diego.arrieta@example.edu.ar', 'profesor', 'fi'),
  ('20105', 'Rosales', 'Silvina', 'silvina.rosales@example.edu.ar', 'profesor', 'fce'),
  ('30101', 'Aguirre', 'Tomás', 'tomas.aguirre@alumnos.example.edu.ar', 'alumno', 'fi'),
  ('30102', 'Benítez', 'Lucía', 'lucia.benitez@alumnos.example.edu.ar', 'alumno', 'fi'),
  ('30103', 'Cabrera', 'Martín', 'martin.cabrera@alumnos.example.edu.ar', 'alumno', 'fi'),
  ('30104', 'Domínguez', 'Sofía', 'sofia.dominguez@alumnos.example.edu.ar', 'alumno', 'fi'),
  ('30105', 'Escobar', 'Joaquín', 'joaquin.escobar@alumnos.example.edu.ar', 'alumno', 'fi'),
  ('30106', 'Funes', 'Valentina', 'valentina.funes@alumnos.example.edu.ar', 'alumno', 'fi'),
  ('30107', 'Giménez', 'Agustina', 'agustina.gimenez@alumnos.example.edu.ar', 'alumno', 'fce'),
  ('30108', 'Herrera', 'Nicolás', 'nicolas.herrera@alumnos.example.edu.ar', 'alumno', 'fce'),
  ('30109', 'Ibarra', 'Camila', 'camila.ibarra@alumnos.example.edu.ar', 'alumno', 'fce'),
  ('30110', 'Juárez', 'Federico', 'federico.juarez@alumnos.example.edu.ar', 'alumno', 'fce')
on conflict (id) do update set surname = excluded.surname, names = excluded.names, email = excluded.email, role = excluded.role, school_id = excluded.school_id;

insert into siu_person_programs (person_id, program_id, status, position) values
  ('30101', 'iinf', 'activa', 0),
  ('30101', 'asp-fi', 'pasiva', 1),
  ('30102', 'iinf', 'activa', 0),
  ('30103', 'iind', 'activa', 0),
  ('30104', 'iind', 'activa', 0),
  ('30105', 'iinf', 'activa', 0),
  ('30106', 'iind', 'activa', 0),
  ('30107', 'ladm', 'activa', 0),
  ('30108', 'cpub', 'activa', 0),
  ('30109', 'ladm', 'activa', 0),
  ('30110', 'cpub', 'pasiva', 0)
on conflict (person_id, program_id) do update set status = excluded.status, position = excluded.position;

insert into siu_terms (id, name, start_at, end_at, enrollment_start, enrollment_end) values
  ('2c-2025', 'Grado 2do Cuatrimestre 2025', '2025-08-11T03:00:00.000Z', '2025-11-29T02:59:00.000Z', '2025-07-28T03:00:00.000Z', '2025-08-16T02:59:00.000Z'),
  ('1c-2026', 'Grado 1er Cuatrimestre 2026', '2026-03-09T03:00:00.000Z', '2026-07-11T02:59:00.000Z', '2026-02-16T03:00:00.000Z', '2026-03-14T02:59:00.000Z'),
  ('2c-2026', 'Grado 2do Cuatrimestre 2026', '2026-08-10T03:00:00.000Z', '2026-11-29T02:59:00.000Z', '2026-07-27T03:00:00.000Z', '2026-08-15T02:59:00.000Z'),
  ('verano-2027', 'Curso de Verano 2027', '2027-01-11T03:00:00.000Z', '2027-02-27T02:59:00.000Z', '2026-11-02T03:00:00.000Z', '2026-12-19T02:59:00.000Z'),
  ('act-2c-2026', 'Actividades de Vida Universitaria 2do Cuatrimestre 2026', '2026-11-17T03:00:00.000Z', '2026-11-29T02:59:00.000Z', '2026-11-09T03:00:00.000Z', '2026-11-17T02:59:00.000Z')
on conflict (id) do update set name = excluded.name, start_at = excluded.start_at, end_at = excluded.end_at, enrollment_start = excluded.enrollment_start, enrollment_end = excluded.enrollment_end;

insert into siu_subjects (id, code, name, credits) values
  ('am1', 'AM1', 'Análisis Matemático I', null),
  ('aga', 'AGA', 'Álgebra y Geometría Analítica', null),
  ('pr1', 'PR1', 'Programación I', null),
  ('fi1', 'FI1', 'Física I', null),
  ('iec', 'IEC', 'Introducción a la Economía', null),
  ('co1', 'CO1', 'Contabilidad I', null),
  ('sre', 'SRE', 'Sistemas de Representación', null),
  ('iin', 'IIN', 'Introducción a la Ingeniería', null),
  ('qui', 'QUI', 'Química General', null),
  ('an1', 'AN1', 'Antropología I', null),
  ('iad', 'IAD', 'Introducción a la Administración', null),
  ('tor', 'TOR', 'Taller de Oratoria', 2),
  ('lid', 'LID', 'Taller de Liderazgo', 3)
on conflict (id) do update set code = excluded.code, name = excluded.name, credits = excluded.credits;

insert into siu_sections (id, name, subject_id, school_id, term_id, teacher_ids, schedule, location, modality, instance, capacity) values
  ('sec-am1-fi-a', 'A', 'am1', 'fi', '2c-2026', array['20101']::text[], '[{"day":"lunes","start":"08:00","end":"10:00"},{"day":"miercoles","start":"08:00","end":"10:00"}]'::jsonb, 'Campus Pilar, aula 12', 'presencial', 'regularidad', 40),
  ('sec-am1-fi-b', 'B', 'am1', 'fi', '2c-2026', array['20102']::text[], '[{"day":"martes","start":"14:00","end":"16:00"},{"day":"jueves","start":"14:00","end":"16:00"}]'::jsonb, 'Campus Pilar, aula 14', 'presencial', 'regularidad', 40),
  ('sec-am1-fce-a', 'A', 'am1', 'fce', '2c-2026', array['20103']::text[], '[{"day":"lunes","start":"18:00","end":"20:00"},{"day":"jueves","start":"18:00","end":"20:00"}]'::jsonb, 'Sede Buenos Aires, aula 3', 'presencial', 'regularidad', 35),
  ('sec-pr1-fi-a', 'A', 'pr1', 'fi', '2c-2026', array['20104']::text[], '[{"day":"viernes","start":"09:00","end":"12:00"}]'::jsonb, 'Campus Pilar, laboratorio 2', 'hibrida', 'promocion', 30),
  ('sec-co1-fce-a', 'A', 'co1', 'fce', '2c-2026', array['20105']::text[], '[{"day":"martes","start":"18:00","end":"21:00"}]'::jsonb, 'Sede Buenos Aires, aula 5', 'presencial', 'regularidad', 35),
  ('sec-aga-fi-a', 'A', 'aga', 'fi', '1c-2026', array['20101']::text[], '[{"day":"martes","start":"08:00","end":"11:00"}]'::jsonb, 'Campus Pilar, aula 12', 'presencial', 'regularidad', 40),
  ('sec-iec-fce-a', 'A', 'iec', 'fce', '1c-2026', array['20103']::text[], '[{"day":"miercoles","start":"18:00","end":"21:00"}]'::jsonb, 'Sede Buenos Aires, aula 3', 'presencial', 'promocion', 35),
  ('sec-fi1-fi-v', 'Verano', 'fi1', 'fi', 'verano-2027', array['20102']::text[], '[{"day":"lunes","start":"09:00","end":"13:00"},{"day":"jueves","start":"09:00","end":"13:00"}]'::jsonb, 'Campus Pilar, aula 20', 'presencial', 'regularidad', 2),
  ('sec-fi1-fi-vt', 'Verano tarde', 'fi1', 'fi', 'verano-2027', array['20102']::text[], '[{"day":"martes","start":"14:00","end":"18:00"},{"day":"viernes","start":"14:00","end":"18:00"}]'::jsonb, 'Campus Pilar, aula 20', 'presencial', 'regularidad', 25),
  ('sec-pr1-fi-v', 'Verano', 'pr1', 'fi', 'verano-2027', array['20104']::text[], '[{"day":"martes","start":"09:00","end":"13:00"}]'::jsonb, 'Virtual', 'virtual', 'regularidad', null),
  ('sec-sre-fi-a', 'A', 'sre', 'fi', '2c-2025', array['20104']::text[], '[{"day":"lunes","start":"14:00","end":"17:00"}]'::jsonb, 'Campus Pilar, aula 8', 'presencial', 'regularidad', 40),
  ('sec-fi1-fi-1c', 'A', 'fi1', 'fi', '1c-2026', array['20102']::text[], '[{"day":"miercoles","start":"09:00","end":"12:00"}]'::jsonb, 'Campus Pilar, aula 20', 'presencial', 'regularidad', 40),
  ('sec-tor-fi-a', 'Única', 'tor', 'fi', 'act-2c-2026', array['20104']::text[], '[{"day":"jueves","start":"18:00","end":"20:00"}]'::jsonb, 'Campus Pilar, aula 3', 'presencial', 'promocion', 30),
  ('sec-lid-fi-v', 'Verano', 'lid', 'fi', 'verano-2027', array['20104']::text[], '[{"day":"miercoles","start":"10:00","end":"12:00"}]'::jsonb, 'Virtual', 'virtual', 'promocion', 40),
  ('sec-am1-fce-v', 'Verano', 'am1', 'fce', 'verano-2027', array['20103']::text[], '[{"day":"miercoles","start":"18:00","end":"21:00"}]'::jsonb, 'Sede Buenos Aires, aula 3', 'presencial', 'regularidad', 25)
on conflict (id) do update set name = excluded.name, subject_id = excluded.subject_id, school_id = excluded.school_id, term_id = excluded.term_id, teacher_ids = excluded.teacher_ids, schedule = excluded.schedule, location = excluded.location, modality = excluded.modality, instance = excluded.instance, capacity = excluded.capacity;

insert into siu_course_enrollments (id, transaction_number, person_id, section_id, enrolled_at, status) values
  ('ic-1', 'T-100001', '30101', 'sec-sre-fi-a', '2025-08-04T13:00:00.000Z', 'aceptada'),
  ('ic-2', 'T-100002', '30105', 'sec-sre-fi-a', '2025-08-05T13:00:00.000Z', 'aceptada'),
  ('ic-3', 'T-100003', '30101', 'sec-fi1-fi-1c', '2026-03-02T13:00:00.000Z', 'aceptada'),
  ('ic-4', 'T-100004', '30101', 'sec-aga-fi-a', '2026-03-02T13:00:00.000Z', 'aceptada'),
  ('ic-5', 'T-100005', '30106', 'sec-aga-fi-a', '2026-03-02T13:00:00.000Z', 'aceptada'),
  ('ic-6', 'T-100006', '30108', 'sec-iec-fce-a', '2026-03-03T13:00:00.000Z', 'aceptada'),
  ('ic-7', 'T-100007', '30101', 'sec-am1-fi-a', '2026-08-03T13:00:00.000Z', 'aceptada'),
  ('ic-8', 'T-100008', '30101', 'sec-pr1-fi-a', '2026-08-03T13:00:00.000Z', 'aceptada'),
  ('ic-9', 'T-100009', '30102', 'sec-am1-fi-a', '2026-08-03T13:00:00.000Z', 'aceptada'),
  ('ic-10', 'T-100010', '30102', 'sec-pr1-fi-a', '2026-08-04T13:00:00.000Z', 'aceptada'),
  ('ic-11', 'T-100011', '30105', 'sec-am1-fi-a', '2026-08-05T13:00:00.000Z', 'aceptada'),
  ('ic-12', 'T-100012', '30103', 'sec-am1-fi-b', '2026-08-03T13:00:00.000Z', 'aceptada'),
  ('ic-13', 'T-100013', '30104', 'sec-am1-fi-b', '2026-08-04T13:00:00.000Z', 'aceptada'),
  ('ic-14', 'T-100014', '30104', 'sec-pr1-fi-a', '2026-08-12T13:00:00.000Z', 'aceptada'),
  ('ic-15', 'T-100015', '30106', 'sec-am1-fi-b', '2026-08-06T13:00:00.000Z', 'aceptada'),
  ('ic-16', 'T-100016', '30107', 'sec-am1-fce-a', '2026-08-03T13:00:00.000Z', 'aceptada'),
  ('ic-17', 'T-100017', '30107', 'sec-co1-fce-a', '2026-08-03T13:00:00.000Z', 'aceptada'),
  ('ic-18', 'T-100018', '30108', 'sec-am1-fce-a', '2026-08-04T13:00:00.000Z', 'aceptada'),
  ('ic-19', 'T-100019', '30108', 'sec-co1-fce-a', '2026-08-04T13:00:00.000Z', 'aceptada'),
  ('ic-20', 'T-100020', '30109', 'sec-am1-fce-a', '2026-08-05T13:00:00.000Z', 'aceptada'),
  ('ic-21', 'T-100021', '30110', 'sec-co1-fce-a', '2026-08-05T13:00:00.000Z', 'aceptada'),
  ('ic-22', 'T-100022', '30103', 'sec-fi1-fi-v', '2026-11-03T13:00:00.000Z', 'aceptada'),
  ('ic-23', 'T-100023', '30105', 'sec-fi1-fi-v', '2026-11-04T13:00:00.000Z', 'aceptada')
on conflict (id) do update set transaction_number = excluded.transaction_number, person_id = excluded.person_id, section_id = excluded.section_id, enrolled_at = excluded.enrolled_at, status = excluded.status;

insert into siu_exam_boards (id, subject_id, school_id, exam_period, date, location, teacher_ids, capacity, enrollment_start, enrollment_end) values
  ('mesa-aga-fi-dic', 'aga', 'fi', 'Turno Diciembre 2026', '2026-12-09T12:00:00.000Z', 'Campus Pilar, aula 12', array['20101', '20102']::text[], 2, '2026-11-09T03:00:00.000Z', '2026-12-05T02:59:00.000Z'),
  ('mesa-sre-fi-dic', 'sre', 'fi', 'Turno Diciembre 2026', '2026-12-07T17:00:00.000Z', 'Campus Pilar, aula 8', array['20104', '20102']::text[], 2, '2026-11-09T03:00:00.000Z', '2026-12-05T02:59:00.000Z'),
  ('mesa-am1-fi-dic', 'am1', 'fi', 'Turno Diciembre 2026', '2026-12-11T12:00:00.000Z', 'Campus Pilar, aula 14', array['20101', '20102']::text[], 40, '2026-11-09T03:00:00.000Z', '2026-12-05T02:59:00.000Z'),
  ('mesa-iec-fce-dic', 'iec', 'fce', 'Turno Diciembre 2026', '2026-12-10T21:00:00.000Z', 'Sede Buenos Aires, aula 3', array['20103']::text[], 30, '2026-11-09T03:00:00.000Z', '2026-12-05T02:59:00.000Z'),
  ('mesa-co1-fce-dic', 'co1', 'fce', 'Turno Diciembre 2026', '2026-12-14T21:00:00.000Z', 'Sede Buenos Aires, aula 5', array['20105']::text[], 30, '2026-11-09T03:00:00.000Z', '2026-12-05T02:59:00.000Z')
on conflict (id) do update set subject_id = excluded.subject_id, school_id = excluded.school_id, exam_period = excluded.exam_period, date = excluded.date, location = excluded.location, teacher_ids = excluded.teacher_ids, capacity = excluded.capacity, enrollment_start = excluded.enrollment_start, enrollment_end = excluded.enrollment_end;

insert into siu_exam_enrollments (id, transaction_number, person_id, exam_board_id, enrolled_at, status) values
  ('ie-1', 'T-200001', '30101', 'mesa-aga-fi-dic', '2026-11-09T14:30:00.000Z', 'aceptada'),
  ('ie-2', 'T-200002', '30105', 'mesa-sre-fi-dic', '2026-11-10T12:15:00.000Z', 'aceptada')
on conflict (id) do update set transaction_number = excluded.transaction_number, person_id = excluded.person_id, exam_board_id = excluded.exam_board_id, enrolled_at = excluded.enrolled_at, status = excluded.status;

insert into siu_assessments (id, section_id, name, kind, date) values
  ('ev-1', 'sec-aga-fi-a', 'Primer parcial', 'parcial', '2026-04-21T11:00:00.000Z'),
  ('ev-2', 'sec-aga-fi-a', 'Segundo parcial', 'parcial', '2026-06-23T11:00:00.000Z'),
  ('ev-3', 'sec-iec-fce-a', 'Parcial', 'parcial', '2026-05-13T21:00:00.000Z'),
  ('ev-4', 'sec-am1-fi-a', 'Primer parcial', 'parcial', '2026-09-21T11:00:00.000Z'),
  ('ev-5', 'sec-am1-fi-a', 'Segundo parcial', 'parcial', '2026-11-16T11:00:00.000Z'),
  ('ev-6', 'sec-am1-fi-a', 'Recuperatorio', 'recuperatorio', '2026-11-25T11:00:00.000Z'),
  ('ev-7', 'sec-am1-fi-b', 'Primer parcial', 'parcial', '2026-09-22T17:00:00.000Z'),
  ('ev-8', 'sec-am1-fi-b', 'Segundo parcial', 'parcial', '2026-11-17T17:00:00.000Z'),
  ('ev-9', 'sec-am1-fce-a', 'Primer parcial', 'parcial', '2026-09-28T21:00:00.000Z'),
  ('ev-10', 'sec-am1-fce-a', 'Segundo parcial', 'parcial', '2026-11-19T21:00:00.000Z'),
  ('ev-11', 'sec-pr1-fi-a', 'TP integrador', 'tp', '2026-10-16T12:00:00.000Z'),
  ('ev-12', 'sec-pr1-fi-a', 'Parcial', 'parcial', '2026-11-20T12:00:00.000Z'),
  ('ev-13', 'sec-co1-fce-a', 'Primer parcial', 'parcial', '2026-10-06T21:00:00.000Z'),
  ('ev-14', 'sec-co1-fce-a', 'Segundo parcial', 'parcial', '2026-11-24T21:00:00.000Z')
on conflict (id) do update set section_id = excluded.section_id, name = excluded.name, kind = excluded.kind, date = excluded.date;

insert into siu_history (id, person_id, subject_id, type, date, grade, result, grade_record, section_id, assessment_id) values
  ('ha-1', '30101', 'aga', 'cursada', '2026-07-08T03:00:00.000Z', 6, 'regular', 'C-2026-0412', null, null),
  ('ha-2', '30106', 'aga', 'cursada', '2026-07-08T03:00:00.000Z', 7, 'regular', 'C-2026-0412', null, null),
  ('ha-3', '30108', 'iec', 'promocion', '2026-07-06T03:00:00.000Z', 9, 'promocionado', 'P-2026-0087', null, null),
  ('ha-4', '30101', 'iin', 'promocion', '2025-07-04T03:00:00.000Z', 8, 'promocionado', 'P-2025-0101', null, null),
  ('ha-5', '30101', 'qui', 'promocion', '2025-12-05T03:00:00.000Z', 7, 'promocionado', 'P-2025-0230', null, null),
  ('ha-6', '30101', 'an1', 'examen', '2025-12-15T03:00:00.000Z', 9, 'aprobado', 'E-2025-0318', null, null),
  ('ha-7', '30108', 'iad', 'equivalencia', '2026-03-20T03:00:00.000Z', 8, 'aprobado', 'R-2026-0014', null, null),
  ('ha-8', '30101', 'sre', 'cursada', '2025-11-27T03:00:00.000Z', 6, 'regular', 'C-2025-0577', null, null),
  ('ha-9', '30105', 'sre', 'cursada', '2025-11-27T03:00:00.000Z', 7, 'regular', 'C-2025-0577', null, null),
  ('ha-10', '30101', 'sre', 'examen', '2026-02-23T03:00:00.000Z', 2, 'desaprobado', 'E-2026-0045', null, null),
  ('ha-11', '30101', 'fi1', 'cursada', '2026-07-08T03:00:00.000Z', null, 'libre', 'C-2026-0415', null, null),
  ('ha-12', '30101', 'aga', 'evaluacion', '2026-04-21T11:00:00.000Z', 6, 'aprobado', 'EV-2026-0103', 'sec-aga-fi-a', 'ev-1'),
  ('ha-13', '30101', 'aga', 'evaluacion', '2026-06-23T11:00:00.000Z', 7, 'aprobado', 'EV-2026-0188', 'sec-aga-fi-a', 'ev-2'),
  ('ha-14', '30106', 'aga', 'evaluacion', '2026-04-21T11:00:00.000Z', 8, 'aprobado', 'EV-2026-0103', 'sec-aga-fi-a', 'ev-1'),
  ('ha-15', '30106', 'aga', 'evaluacion', '2026-06-23T11:00:00.000Z', 6, 'aprobado', 'EV-2026-0188', 'sec-aga-fi-a', 'ev-2'),
  ('ha-16', '30101', 'pr1', 'evaluacion', '2026-10-16T12:00:00.000Z', 9, 'aprobado', 'EV-2026-0412', 'sec-pr1-fi-a', 'ev-11'),
  ('ha-17', '30102', 'pr1', 'evaluacion', '2026-10-16T12:00:00.000Z', 8, 'aprobado', 'EV-2026-0412', 'sec-pr1-fi-a', 'ev-11'),
  ('ha-18', '30104', 'pr1', 'evaluacion', '2026-10-16T12:00:00.000Z', null, 'ausente', 'EV-2026-0412', 'sec-pr1-fi-a', 'ev-11')
on conflict (id) do update set person_id = excluded.person_id, subject_id = excluded.subject_id, type = excluded.type, date = excluded.date, grade = excluded.grade, result = excluded.result, grade_record = excluded.grade_record, section_id = excluded.section_id, assessment_id = excluded.assessment_id;

insert into siu_provisional_results (id, person_id, section_id, assessment_id, grade, date) values
  ('ap-1', '30101', 'sec-am1-fi-a', 'ev-4', 7, '2026-09-21T11:00:00.000Z'),
  ('ap-2', '30102', 'sec-am1-fi-a', 'ev-4', 8, '2026-09-21T11:00:00.000Z'),
  ('ap-3', '30105', 'sec-am1-fi-a', 'ev-4', 4, '2026-09-21T11:00:00.000Z'),
  ('ap-4', '30103', 'sec-am1-fi-b', 'ev-7', 6, '2026-09-22T17:00:00.000Z'),
  ('ap-5', '30104', 'sec-am1-fi-b', 'ev-7', 9, '2026-09-22T17:00:00.000Z'),
  ('ap-6', '30106', 'sec-am1-fi-b', 'ev-7', 5, '2026-09-22T17:00:00.000Z'),
  ('ap-7', '30107', 'sec-am1-fce-a', 'ev-9', 8, '2026-09-28T21:00:00.000Z'),
  ('ap-8', '30108', 'sec-am1-fce-a', 'ev-9', 7, '2026-09-28T21:00:00.000Z'),
  ('ap-9', '30109', 'sec-am1-fce-a', 'ev-9', 6, '2026-09-28T21:00:00.000Z'),
  ('ap-10', '30107', 'sec-co1-fce-a', 'ev-13', 6, '2026-10-06T21:00:00.000Z'),
  ('ap-11', '30108', 'sec-co1-fce-a', 'ev-13', 8, '2026-10-06T21:00:00.000Z'),
  ('ap-12', '30110', 'sec-co1-fce-a', 'ev-13', 7, '2026-10-06T21:00:00.000Z')
on conflict (id) do update set person_id = excluded.person_id, section_id = excluded.section_id, assessment_id = excluded.assessment_id, grade = excluded.grade, date = excluded.date;

insert into siu_certificates (person_id, type, meets_conditions) values
  ('30101', 'alumno-regular', true),
  ('30101', 'examen-final', true),
  ('30102', 'alumno-regular', true),
  ('30102', 'examen-final', false),
  ('30103', 'alumno-regular', true),
  ('30103', 'examen-final', false),
  ('30104', 'alumno-regular', true),
  ('30104', 'examen-final', false),
  ('30105', 'alumno-regular', true),
  ('30105', 'examen-final', false),
  ('30106', 'alumno-regular', true),
  ('30106', 'examen-final', false),
  ('30107', 'alumno-regular', true),
  ('30107', 'examen-final', false),
  ('30108', 'alumno-regular', true),
  ('30108', 'examen-final', false),
  ('30109', 'alumno-regular', true),
  ('30109', 'examen-final', false),
  ('30110', 'alumno-regular', false),
  ('30110', 'examen-final', false)
on conflict (person_id, type) do update set meets_conditions = excluded.meets_conditions;

commit;
