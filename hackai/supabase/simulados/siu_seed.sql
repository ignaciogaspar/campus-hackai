-- Generado por npm run siu:seed desde lib/adapters/synthetic-data.ts. No lo edites a mano.

begin;

delete from siu_course_enrollments where id <> all (array['ic-1', 'ic-2', 'ic-3', 'ic-4', 'ic-5', 'ic-6', 'ic-7', 'ic-8', 'ic-9', 'ic-10', 'ic-11', 'ic-12', 'ic-13', 'ic-14', 'ic-15', 'ic-16', 'ic-17', 'ic-18', 'ic-19', 'ic-20', 'ic-21', 'ic-22', 'ic-23']::text[]);

delete from siu_exam_enrollments where id <> all (array['ie-1', 'ie-2']::text[]);

delete from siu_history where id <> all (array['ha-1', 'ha-2', 'ha-3', 'ha-4', 'ha-5', 'ha-6', 'ha-7', 'ha-8', 'ha-9', 'ha-10', 'ha-11', 'ha-12', 'ha-13', 'ha-14', 'ha-15', 'ha-16', 'ha-17', 'ha-18', 'ha-19', 'ha-20', 'ha-21', 'ha-22', 'ha-23', 'ha-24']::text[]);

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
  ('20106', 'Quiroga', 'Romina', 'romina.quiroga@example.edu.ar', 'profesor', 'fi'),
  ('20107', 'Molina', 'Pablo', 'pablo.molina@example.edu.ar', 'profesor', 'fi'),
  ('30101', 'Aguirre', 'Tomás', 'tomas.aguirre@alumnos.example.edu.ar', 'alumno', 'fi'),
  ('30102', 'Benítez', 'Lucía', 'lucia.benitez@alumnos.example.edu.ar', 'alumno', 'fi'),
  ('30103', 'Cabrera', 'Martín', 'martin.cabrera@alumnos.example.edu.ar', 'alumno', 'fi'),
  ('30104', 'Domínguez', 'Sofía', 'sofia.dominguez@alumnos.example.edu.ar', 'alumno', 'fi'),
  ('30105', 'Escobar', 'Joaquín', 'joaquin.escobar@alumnos.example.edu.ar', 'alumno', 'fi'),
  ('30106', 'Funes', 'Valentina', 'valentina.funes@alumnos.example.edu.ar', 'alumno', 'fi'),
  ('30107', 'Giménez', 'Agustina', 'agustina.gimenez@alumnos.example.edu.ar', 'alumno', 'fce'),
  ('30108', 'Herrera', 'Nicolás', 'nicolas.herrera@alumnos.example.edu.ar', 'alumno', 'fce'),
  ('30109', 'Ibarra', 'Camila', 'camila.ibarra@alumnos.example.edu.ar', 'alumno', 'fce'),
  ('30110', 'Juárez', 'Federico', 'federico.juarez@alumnos.example.edu.ar', 'alumno', 'fce'),
  ('20201', 'FI', 'Secretaría', 'secretaria.fi@example.edu.ar', 'secretaria', 'fi')
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
  ('iin', 'IIN', 'Introducción a la Ingeniería', null),
  ('qui', 'QUI', 'Química General', null),
  ('an1', 'AN1', 'Antropología I', null),
  ('iad', 'IAD', 'Introducción a la Administración', null),
  ('am2', 'AM2', 'Análisis Matemático II', null),
  ('fi2', 'FI2', 'Física II', null),
  ('pye', 'PYE', 'Probabilidad y Estadística', null),
  ('pr2', 'PR2', 'Programación II', null),
  ('edd', 'EDD', 'Estructuras de Datos', null),
  ('bdd', 'BDD', 'Bases de Datos', null),
  ('sop', 'SOP', 'Sistemas Operativos', null),
  ('isw', 'ISW', 'Ingeniería de Software', null),
  ('iop', 'IOP', 'Investigación Operativa', null),
  ('ter', 'TER', 'Termodinámica', null),
  ('gca', 'GCA', 'Gestión de la Calidad', null),
  ('cst', 'CST', 'Costos Industriales', null),
  ('etp', 'ETP', 'Ética Profesional', null),
  ('pfi', 'PFI', 'Proyecto Final de Ingeniería', null),
  ('cda', 'CDA', 'Ciencia de Datos', null),
  ('log', 'LOG', 'Logística', null),
  ('iar', 'IAR', 'Inteligencia Artificial', null),
  ('mkt', 'MKT', 'Marketing', null),
  ('fin', 'FIN', 'Finanzas', null),
  ('co2', 'CO2', 'Contabilidad II', null),
  ('ndg', 'NDG', 'Negocios Digitales', null),
  ('tor', 'TOR', 'Taller de Oratoria', 2),
  ('vol', 'VOL', 'Voluntariado Universitario', 2),
  ('cor', 'COR', 'Coro Universitario', 1),
  ('lid', 'LID', 'Taller de Liderazgo', 3),
  ('sre', 'SRE', 'Sistemas de Representación', null)
on conflict (id) do update set code = excluded.code, name = excluded.name, credits = excluded.credits;

insert into siu_sections (id, name, subject_id, school_id, term_id, teacher_ids, schedule, location, modality, instance, capacity, program_ids, notes) values
  ('sec-am1-fi-a', 'A', 'am1', 'fi', '2c-2026', array['20101']::text[], '[{"day":"lunes","start":"08:00","end":"10:00"},{"day":"miercoles","start":"08:00","end":"10:00"}]'::jsonb, 'Campus Pilar, aula 12', 'presencial', 'regularidad', 40, array['iinf']::text[], 'Comisión de Ingeniería en Informática. Llevá calculadora científica a los parciales.'),
  ('sec-am1-fi-b', 'B', 'am1', 'fi', '2c-2026', array['20102']::text[], '[{"day":"martes","start":"14:00","end":"16:00"},{"day":"jueves","start":"14:00","end":"16:00"}]'::jsonb, 'Campus Pilar, aula 14', 'presencial', 'regularidad', 40, array['iind']::text[], 'Comisión de Ingeniería Industrial. Las clases de consulta son los viernes a las 12 en el aula 14.'),
  ('sec-am1-fce-a', 'A', 'am1', 'fce', '2c-2026', array['20103']::text[], '[{"day":"lunes","start":"18:00","end":"20:00"},{"day":"jueves","start":"18:00","end":"20:00"}]'::jsonb, 'Sede Buenos Aires, aula 3', 'presencial', 'regularidad', 35, '{}'::text[], null),
  ('sec-pr1-fi-a', 'A', 'pr1', 'fi', '2c-2026', array['20104']::text[], '[{"day":"viernes","start":"09:00","end":"12:00"}]'::jsonb, 'Campus Pilar, laboratorio 2', 'hibrida', 'promocion', 30, '{}'::text[], 'Se promociona con 7 o más en el parcial y en el TP integrador. Traé tu notebook al laboratorio.'),
  ('sec-co1-fce-a', 'A', 'co1', 'fce', '2c-2026', array['20105']::text[], '[{"day":"martes","start":"18:00","end":"21:00"}]'::jsonb, 'Sede Buenos Aires, aula 5', 'presencial', 'regularidad', 35, '{}'::text[], null),
  ('sec-aga-fi-a', 'A', 'aga', 'fi', '1c-2026', array['20101']::text[], '[{"day":"martes","start":"08:00","end":"11:00"}]'::jsonb, 'Campus Pilar, aula 12', 'presencial', 'regularidad', 40, '{}'::text[], null),
  ('sec-iec-fce-a', 'A', 'iec', 'fce', '1c-2026', array['20103']::text[], '[{"day":"miercoles","start":"18:00","end":"21:00"}]'::jsonb, 'Sede Buenos Aires, aula 3', 'presencial', 'promocion', 35, '{}'::text[], 'Se promociona con 7 o más en el parcial.'),
  ('sec-fi1-fi-v', 'Verano', 'fi1', 'fi', 'verano-2027', array['20102']::text[], '[{"day":"lunes","start":"09:00","end":"13:00"},{"day":"jueves","start":"09:00","end":"13:00"}]'::jsonb, 'Campus Pilar, aula 20', 'presencial', 'regularidad', 2, '{}'::text[], 'Cursada intensiva de verano: dos clases por semana durante 7 semanas.'),
  ('sec-fi1-fi-vt', 'Verano tarde', 'fi1', 'fi', 'verano-2027', array['20102']::text[], '[{"day":"martes","start":"14:00","end":"18:00"},{"day":"viernes","start":"14:00","end":"18:00"}]'::jsonb, 'Campus Pilar, aula 20', 'presencial', 'regularidad', 25, '{}'::text[], 'Cursada intensiva de verano, a la tarde.'),
  ('sec-pr1-fi-v', 'Verano', 'pr1', 'fi', 'verano-2027', array['20104']::text[], '[{"day":"martes","start":"09:00","end":"13:00"}]'::jsonb, 'Virtual', 'virtual', 'regularidad', null, '{}'::text[], 'Las clases son por Zoom y quedan grabadas en el aula del Campus Virtual.'),
  ('sec-tor-fi-a', 'Única', 'tor', 'fi', 'act-2c-2026', array['20104']::text[], '[{"day":"jueves","start":"18:00","end":"20:00"}]'::jsonb, 'Campus Pilar, aula 3', 'presencial', 'promocion', 30, '{}'::text[], 'Se aprueba con la asistencia al 75% de los encuentros y una exposición final.'),
  ('sec-lid-fi-v', 'Verano', 'lid', 'fi', 'verano-2027', array['20104']::text[], '[{"day":"miercoles","start":"10:00","end":"12:00"}]'::jsonb, 'Virtual', 'virtual', 'promocion', 40, '{}'::text[], null),
  ('sec-am1-fce-v', 'Verano', 'am1', 'fce', 'verano-2027', array['20103']::text[], '[{"day":"miercoles","start":"18:00","end":"21:00"}]'::jsonb, 'Sede Buenos Aires, aula 3', 'presencial', 'regularidad', 25, '{}'::text[], null),
  ('sec-pye-fi-va', 'Verano A', 'pye', 'fi', 'verano-2027', array['20106']::text[], '[{"day":"lunes","start":"09:00","end":"12:00"},{"day":"miercoles","start":"09:00","end":"12:00"}]'::jsonb, 'Campus Pilar, aula 8', 'presencial', 'promocion', 30, array['iind']::text[], 'Cursada intensiva de verano. Se promociona con 7 o más en los dos parciales.'),
  ('sec-pye-fi-vb', 'Verano B', 'pye', 'fi', 'verano-2027', array['20107']::text[], '[{"day":"martes","start":"18:00","end":"21:00"},{"day":"jueves","start":"18:00","end":"21:00"}]'::jsonb, 'Campus Pilar, aula 8', 'hibrida', 'regularidad', 25, array['iind']::text[], 'Los jueves la clase es virtual y queda grabada en el aula del Campus Virtual.'),
  ('sec-pye-fi-vc', 'Verano C', 'pye', 'fi', 'verano-2027', array['20107']::text[], '[{"day":"lunes","start":"14:00","end":"17:00"},{"day":"miercoles","start":"14:00","end":"17:00"}]'::jsonb, 'Campus Pilar, aula 10', 'presencial', 'promocion', 30, array['iinf']::text[], 'Comisión de Ingeniería en Informática.'),
  ('sec-cda-fi-v', 'Verano', 'cda', 'fi', 'verano-2027', array['20107']::text[], '[{"day":"viernes","start":"09:00","end":"13:00"}]'::jsonb, 'Campus Pilar, laboratorio 2', 'hibrida', 'promocion', 20, array['iind', 'iinf']::text[], 'Optativa. Conviene tener Programación I aprobada o en curso.'),
  ('sec-vol-fi-v', 'Verano', 'vol', 'fi', 'verano-2027', array['20106']::text[], '[{"day":"sabado","start":"09:00","end":"12:00"}]'::jsonb, 'Centro comunitario de Derqui', 'presencial', 'promocion', 15, '{}'::text[], 'Actividad de vida universitaria. Sale una combi desde el Campus Pilar a las 8:30.'),
  ('sec-fin-fce-vm', 'Verano mañana', 'fin', 'fce', 'verano-2027', array['20105']::text[], '[{"day":"martes","start":"09:00","end":"12:00"},{"day":"jueves","start":"09:00","end":"12:00"}]'::jsonb, 'Sede Buenos Aires, aula 5', 'presencial', 'regularidad', 2, '{}'::text[], 'Cursada intensiva de verano: dos clases por semana durante 7 semanas.'),
  ('sec-fin-fce-vn', 'Verano noche', 'fin', 'fce', 'verano-2027', array['20105']::text[], '[{"day":"martes","start":"18:30","end":"21:30"},{"day":"jueves","start":"18:30","end":"21:30"}]'::jsonb, 'Sede Buenos Aires, aula 5', 'presencial', 'regularidad', 30, '{}'::text[], 'Cursada intensiva de verano: dos clases por semana durante 7 semanas.'),
  ('sec-ndg-fce-v', 'Verano', 'ndg', 'fce', 'verano-2027', array['20103']::text[], '[{"day":"lunes","start":"19:00","end":"21:00"}]'::jsonb, 'Virtual', 'virtual', 'promocion', 40, array['ladm', 'cpub']::text[], 'Optativa. Las clases son por Zoom y quedan grabadas en el aula del Campus Virtual.'),
  ('sec-vol-fce-a', 'Única', 'vol', 'fce', 'act-2c-2026', array['20105']::text[], '[{"day":"sabado","start":"09:00","end":"12:00"}]'::jsonb, 'Sede Buenos Aires, hall central', 'presencial', 'promocion', 20, '{}'::text[], 'Actividad de vida universitaria: apoyo escolar en un comedor comunitario cerca de la sede.')
on conflict (id) do update set name = excluded.name, subject_id = excluded.subject_id, school_id = excluded.school_id, term_id = excluded.term_id, teacher_ids = excluded.teacher_ids, schedule = excluded.schedule, location = excluded.location, modality = excluded.modality, instance = excluded.instance, capacity = excluded.capacity, program_ids = excluded.program_ids, notes = excluded.notes;

delete from siu_plan_subjects where (program_id || ':' || subject_id) <> all (array['iind:am1', 'iind:aga', 'iind:qui', 'iind:iin', 'iind:an1', 'iind:pr1', 'iind:sre', 'iind:am2', 'iind:fi1', 'iind:fi2', 'iind:pye', 'iind:iop', 'iind:ter', 'iind:iec', 'iind:gca', 'iind:cst', 'iind:etp', 'iind:pfi', 'iind:cda', 'iind:log', 'iind:tor', 'iind:vol', 'iind:cor', 'iind:lid', 'iinf:am1', 'iinf:aga', 'iinf:pr1', 'iinf:iin', 'iinf:qui', 'iinf:an1', 'iinf:sre', 'iinf:am2', 'iinf:fi1', 'iinf:pr2', 'iinf:edd', 'iinf:pye', 'iinf:bdd', 'iinf:sop', 'iinf:fi2', 'iinf:isw', 'iinf:etp', 'iinf:pfi', 'iinf:cda', 'iinf:iar', 'iinf:tor', 'iinf:vol', 'iinf:cor', 'iinf:lid', 'ladm:iad', 'ladm:iec', 'ladm:am1', 'ladm:co1', 'ladm:an1', 'ladm:mkt', 'ladm:fin', 'ladm:co2', 'ladm:etp', 'ladm:ndg', 'ladm:tor', 'ladm:vol', 'cpub:iad', 'cpub:iec', 'cpub:am1', 'cpub:co1', 'cpub:an1', 'cpub:co2', 'cpub:fin', 'cpub:mkt', 'cpub:etp', 'cpub:ndg', 'cpub:tor', 'cpub:vol']::text[]);

insert into siu_study_plans (program_id, name, years, electives_required, university_life_required) values
  ('iind', 'Plan 2019', 5, 2, 3),
  ('iinf', 'Plan 2019', 5, 2, 3),
  ('ladm', 'Plan 2021', 4, 1, 2),
  ('cpub', 'Plan 2021', 5, 1, 2)
on conflict (program_id) do update set name = excluded.name, years = excluded.years, electives_required = excluded.electives_required, university_life_required = excluded.university_life_required;

insert into siu_plan_subjects (program_id, subject_id, year, kind, position) values
  ('iind', 'am1', 1, 'obligatoria', 0),
  ('iind', 'aga', 1, 'obligatoria', 1),
  ('iind', 'qui', 1, 'obligatoria', 2),
  ('iind', 'iin', 1, 'obligatoria', 3),
  ('iind', 'an1', 1, 'obligatoria', 4),
  ('iind', 'pr1', 1, 'obligatoria', 5),
  ('iind', 'sre', 1, 'obligatoria', 6),
  ('iind', 'am2', 2, 'obligatoria', 7),
  ('iind', 'fi1', 2, 'obligatoria', 8),
  ('iind', 'fi2', 2, 'obligatoria', 9),
  ('iind', 'pye', 2, 'obligatoria', 10),
  ('iind', 'iop', 3, 'obligatoria', 11),
  ('iind', 'ter', 3, 'obligatoria', 12),
  ('iind', 'iec', 3, 'obligatoria', 13),
  ('iind', 'gca', 4, 'obligatoria', 14),
  ('iind', 'cst', 4, 'obligatoria', 15),
  ('iind', 'etp', 4, 'obligatoria', 16),
  ('iind', 'pfi', 5, 'obligatoria', 17),
  ('iind', 'cda', 4, 'optativa', 18),
  ('iind', 'log', 4, 'optativa', 19),
  ('iind', 'tor', null, 'vida-universitaria', 20),
  ('iind', 'vol', null, 'vida-universitaria', 21),
  ('iind', 'cor', null, 'vida-universitaria', 22),
  ('iind', 'lid', null, 'vida-universitaria', 23),
  ('iinf', 'am1', 1, 'obligatoria', 0),
  ('iinf', 'aga', 1, 'obligatoria', 1),
  ('iinf', 'pr1', 1, 'obligatoria', 2),
  ('iinf', 'iin', 1, 'obligatoria', 3),
  ('iinf', 'qui', 1, 'obligatoria', 4),
  ('iinf', 'an1', 1, 'obligatoria', 5),
  ('iinf', 'sre', 1, 'obligatoria', 6),
  ('iinf', 'am2', 2, 'obligatoria', 7),
  ('iinf', 'fi1', 2, 'obligatoria', 8),
  ('iinf', 'pr2', 2, 'obligatoria', 9),
  ('iinf', 'edd', 2, 'obligatoria', 10),
  ('iinf', 'pye', 2, 'obligatoria', 11),
  ('iinf', 'bdd', 3, 'obligatoria', 12),
  ('iinf', 'sop', 3, 'obligatoria', 13),
  ('iinf', 'fi2', 3, 'obligatoria', 14),
  ('iinf', 'isw', 4, 'obligatoria', 15),
  ('iinf', 'etp', 4, 'obligatoria', 16),
  ('iinf', 'pfi', 5, 'obligatoria', 17),
  ('iinf', 'cda', 4, 'optativa', 18),
  ('iinf', 'iar', 4, 'optativa', 19),
  ('iinf', 'tor', null, 'vida-universitaria', 20),
  ('iinf', 'vol', null, 'vida-universitaria', 21),
  ('iinf', 'cor', null, 'vida-universitaria', 22),
  ('iinf', 'lid', null, 'vida-universitaria', 23),
  ('ladm', 'iad', 1, 'obligatoria', 0),
  ('ladm', 'iec', 1, 'obligatoria', 1),
  ('ladm', 'am1', 1, 'obligatoria', 2),
  ('ladm', 'co1', 1, 'obligatoria', 3),
  ('ladm', 'an1', 1, 'obligatoria', 4),
  ('ladm', 'mkt', 2, 'obligatoria', 5),
  ('ladm', 'fin', 2, 'obligatoria', 6),
  ('ladm', 'co2', 3, 'obligatoria', 7),
  ('ladm', 'etp', 4, 'obligatoria', 8),
  ('ladm', 'ndg', 3, 'optativa', 9),
  ('ladm', 'tor', null, 'vida-universitaria', 10),
  ('ladm', 'vol', null, 'vida-universitaria', 11),
  ('cpub', 'iad', 1, 'obligatoria', 0),
  ('cpub', 'iec', 1, 'obligatoria', 1),
  ('cpub', 'am1', 1, 'obligatoria', 2),
  ('cpub', 'co1', 1, 'obligatoria', 3),
  ('cpub', 'an1', 1, 'obligatoria', 4),
  ('cpub', 'co2', 2, 'obligatoria', 5),
  ('cpub', 'fin', 2, 'obligatoria', 6),
  ('cpub', 'mkt', 3, 'obligatoria', 7),
  ('cpub', 'etp', 4, 'obligatoria', 8),
  ('cpub', 'ndg', 4, 'optativa', 9),
  ('cpub', 'tor', null, 'vida-universitaria', 10),
  ('cpub', 'vol', null, 'vida-universitaria', 11)
on conflict (program_id, subject_id) do update set year = excluded.year, kind = excluded.kind, position = excluded.position;

insert into siu_course_enrollments (id, transaction_number, person_id, section_id, enrolled_at, status) values
  ('ic-1', 'T-100001', '30101', 'sec-aga-fi-a', '2026-03-02T13:00:00.000Z', 'aceptada'),
  ('ic-2', 'T-100002', '30106', 'sec-aga-fi-a', '2026-03-02T13:00:00.000Z', 'aceptada'),
  ('ic-3', 'T-100003', '30104', 'sec-aga-fi-a', '2026-03-03T13:00:00.000Z', 'aceptada'),
  ('ic-4', 'T-100004', '30108', 'sec-iec-fce-a', '2026-03-03T13:00:00.000Z', 'aceptada'),
  ('ic-5', 'T-100005', '30101', 'sec-am1-fi-a', '2026-08-03T13:00:00.000Z', 'aceptada'),
  ('ic-6', 'T-100006', '30101', 'sec-pr1-fi-a', '2026-08-03T13:00:00.000Z', 'aceptada'),
  ('ic-7', 'T-100007', '30102', 'sec-am1-fi-a', '2026-08-03T13:00:00.000Z', 'aceptada'),
  ('ic-8', 'T-100008', '30102', 'sec-pr1-fi-a', '2026-08-04T13:00:00.000Z', 'aceptada'),
  ('ic-9', 'T-100009', '30105', 'sec-am1-fi-a', '2026-08-05T13:00:00.000Z', 'aceptada'),
  ('ic-10', 'T-100010', '30103', 'sec-am1-fi-b', '2026-08-03T13:00:00.000Z', 'aceptada'),
  ('ic-11', 'T-100011', '30104', 'sec-am1-fi-b', '2026-08-04T13:00:00.000Z', 'aceptada'),
  ('ic-12', 'T-100012', '30104', 'sec-pr1-fi-a', '2026-08-12T13:00:00.000Z', 'aceptada'),
  ('ic-13', 'T-100013', '30106', 'sec-am1-fi-b', '2026-08-06T13:00:00.000Z', 'aceptada'),
  ('ic-14', 'T-100014', '30107', 'sec-am1-fce-a', '2026-08-03T13:00:00.000Z', 'aceptada'),
  ('ic-15', 'T-100015', '30107', 'sec-co1-fce-a', '2026-08-03T13:00:00.000Z', 'aceptada'),
  ('ic-16', 'T-100016', '30108', 'sec-am1-fce-a', '2026-08-04T13:00:00.000Z', 'aceptada'),
  ('ic-17', 'T-100017', '30108', 'sec-co1-fce-a', '2026-08-04T13:00:00.000Z', 'aceptada'),
  ('ic-18', 'T-100018', '30109', 'sec-am1-fce-a', '2026-08-05T13:00:00.000Z', 'aceptada'),
  ('ic-19', 'T-100019', '30110', 'sec-co1-fce-a', '2026-08-05T13:00:00.000Z', 'aceptada'),
  ('ic-20', 'T-100020', '30103', 'sec-fi1-fi-v', '2026-11-03T13:00:00.000Z', 'aceptada'),
  ('ic-21', 'T-100021', '30105', 'sec-fi1-fi-v', '2026-11-04T13:00:00.000Z', 'aceptada'),
  ('ic-22', 'T-100022', '30107', 'sec-fin-fce-vm', '2026-11-03T13:00:00.000Z', 'aceptada'),
  ('ic-23', 'T-100023', '30109', 'sec-fin-fce-vm', '2026-11-04T13:00:00.000Z', 'aceptada')
on conflict (id) do update set transaction_number = excluded.transaction_number, person_id = excluded.person_id, section_id = excluded.section_id, enrolled_at = excluded.enrolled_at, status = excluded.status;

insert into siu_exam_boards (id, subject_id, school_id, exam_period, date, location, teacher_ids, capacity, enrollment_start, enrollment_end, notes) values
  ('mesa-aga-fi-dic', 'aga', 'fi', 'Turno Diciembre 2026', '2026-12-09T12:00:00.000Z', 'Campus Pilar, aula 12', array['20101', '20102']::text[], 2, '2026-11-09T03:00:00.000Z', '2026-12-05T02:59:00.000Z', 'Escrito, de 3 horas. Llevá DNI o libreta universitaria.'),
  ('mesa-sre-fi-dic', 'sre', 'fi', 'Turno Diciembre 2026', '2026-12-07T17:00:00.000Z', 'Campus Pilar, aula 8', array['20104', '20102']::text[], 2, '2026-11-09T03:00:00.000Z', '2026-12-05T02:59:00.000Z', 'Llevá los útiles de dibujo técnico.'),
  ('mesa-am1-fi-dic', 'am1', 'fi', 'Turno Diciembre 2026', '2026-12-11T12:00:00.000Z', 'Campus Pilar, aula 14', array['20101', '20102']::text[], 40, '2026-11-09T03:00:00.000Z', '2026-12-05T02:59:00.000Z', 'Escrito. Se puede usar calculadora científica no programable.'),
  ('mesa-iec-fce-dic', 'iec', 'fce', 'Turno Diciembre 2026', '2026-12-10T21:00:00.000Z', 'Sede Buenos Aires, aula 3', array['20103']::text[], 30, '2026-11-09T03:00:00.000Z', '2026-12-05T02:59:00.000Z', null),
  ('mesa-co1-fce-dic', 'co1', 'fce', 'Turno Diciembre 2026', '2026-12-14T21:00:00.000Z', 'Sede Buenos Aires, aula 5', array['20105']::text[], 30, '2026-11-09T03:00:00.000Z', '2026-12-05T02:59:00.000Z', null)
on conflict (id) do update set subject_id = excluded.subject_id, school_id = excluded.school_id, exam_period = excluded.exam_period, date = excluded.date, location = excluded.location, teacher_ids = excluded.teacher_ids, capacity = excluded.capacity, enrollment_start = excluded.enrollment_start, enrollment_end = excluded.enrollment_end, notes = excluded.notes;

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

insert into siu_history (id, person_id, subject_id, type, date, grade, result, grade_record, section_id, assessment_id, loaded_at) values
  ('ha-1', '30101', 'aga', 'cursada', '2026-07-08T03:00:00.000Z', 6, 'regular', 'C-2026-0412', null, null, null),
  ('ha-2', '30106', 'aga', 'cursada', '2026-07-08T03:00:00.000Z', 7, 'regular', 'C-2026-0412', null, null, null),
  ('ha-3', '30108', 'iec', 'promocion', '2026-07-06T03:00:00.000Z', 9, 'promocionado', 'P-2026-0087', null, null, null),
  ('ha-4', '30101', 'iin', 'promocion', '2025-07-04T03:00:00.000Z', 8, 'promocionado', 'P-2025-0101', null, null, null),
  ('ha-5', '30101', 'qui', 'promocion', '2025-12-05T03:00:00.000Z', 7, 'promocionado', 'P-2025-0230', null, null, null),
  ('ha-6', '30101', 'an1', 'examen', '2025-12-15T03:00:00.000Z', 9, 'aprobado', 'E-2025-0318', null, null, null),
  ('ha-7', '30108', 'iad', 'equivalencia', '2026-03-20T03:00:00.000Z', 8, 'aprobado', 'R-2026-0014', null, null, null),
  ('ha-8', '30104', 'iin', 'promocion', '2025-07-04T03:00:00.000Z', 8, 'promocionado', 'P-2025-0101', null, null, null),
  ('ha-9', '30104', 'tor', 'promocion', '2025-11-20T03:00:00.000Z', null, 'promocionado', 'P-2025-0198', null, null, null),
  ('ha-10', '30104', 'qui', 'examen', '2025-12-12T03:00:00.000Z', 6, 'aprobado', 'E-2025-0301', null, null, null),
  ('ha-11', '30104', 'an1', 'examen', '2025-12-15T03:00:00.000Z', 7, 'aprobado', 'E-2025-0318', null, null, null),
  ('ha-12', '30104', 'aga', 'cursada', '2026-07-08T03:00:00.000Z', 7, 'regular', 'C-2026-0412', null, null, null),
  ('ha-13', '30101', 'sre', 'cursada', '2025-11-27T03:00:00.000Z', 6, 'regular', 'C-2025-0577', null, null, null),
  ('ha-14', '30105', 'sre', 'cursada', '2025-11-27T03:00:00.000Z', 7, 'regular', 'C-2025-0577', null, null, null),
  ('ha-15', '30101', 'sre', 'examen', '2026-02-23T03:00:00.000Z', 2, 'desaprobado', 'E-2026-0045', null, null, null),
  ('ha-16', '30101', 'aga', 'evaluacion', '2026-04-21T11:00:00.000Z', 6, 'aprobado', 'EV-2026-0103', 'sec-aga-fi-a', 'ev-1', null),
  ('ha-17', '30101', 'aga', 'evaluacion', '2026-06-23T11:00:00.000Z', 7, 'aprobado', 'EV-2026-0188', 'sec-aga-fi-a', 'ev-2', null),
  ('ha-18', '30106', 'aga', 'evaluacion', '2026-04-21T11:00:00.000Z', 8, 'aprobado', 'EV-2026-0103', 'sec-aga-fi-a', 'ev-1', null),
  ('ha-19', '30106', 'aga', 'evaluacion', '2026-06-23T11:00:00.000Z', 6, 'aprobado', 'EV-2026-0188', 'sec-aga-fi-a', 'ev-2', null),
  ('ha-20', '30104', 'aga', 'evaluacion', '2026-04-21T11:00:00.000Z', 7, 'aprobado', 'EV-2026-0103', 'sec-aga-fi-a', 'ev-1', null),
  ('ha-21', '30104', 'aga', 'evaluacion', '2026-06-23T11:00:00.000Z', 6, 'aprobado', 'EV-2026-0188', 'sec-aga-fi-a', 'ev-2', null),
  ('ha-22', '30101', 'pr1', 'evaluacion', '2026-10-16T12:00:00.000Z', 9, 'aprobado', 'EV-2026-0412', 'sec-pr1-fi-a', 'ev-11', '2026-11-09T21:00:00.000Z'),
  ('ha-23', '30102', 'pr1', 'evaluacion', '2026-10-16T12:00:00.000Z', 8, 'aprobado', 'EV-2026-0412', 'sec-pr1-fi-a', 'ev-11', '2026-11-09T21:00:00.000Z'),
  ('ha-24', '30104', 'pr1', 'evaluacion', '2026-10-16T12:00:00.000Z', null, 'ausente', 'EV-2026-0412', 'sec-pr1-fi-a', 'ev-11', '2026-11-09T21:00:00.000Z')
on conflict (id) do update set person_id = excluded.person_id, subject_id = excluded.subject_id, type = excluded.type, date = excluded.date, grade = excluded.grade, result = excluded.result, grade_record = excluded.grade_record, section_id = excluded.section_id, assessment_id = excluded.assessment_id, loaded_at = excluded.loaded_at;

insert into siu_provisional_results (id, person_id, section_id, assessment_id, grade, date, loaded_at) values
  ('ap-1', '30101', 'sec-am1-fi-a', 'ev-4', 7, '2026-09-21T11:00:00.000Z', '2026-11-10T12:00:00.000Z'),
  ('ap-2', '30102', 'sec-am1-fi-a', 'ev-4', 8, '2026-09-21T11:00:00.000Z', '2026-11-10T12:00:00.000Z'),
  ('ap-3', '30105', 'sec-am1-fi-a', 'ev-4', 4, '2026-09-21T11:00:00.000Z', '2026-11-10T12:00:00.000Z'),
  ('ap-4', '30103', 'sec-am1-fi-b', 'ev-7', 6, '2026-09-22T17:00:00.000Z', null),
  ('ap-5', '30104', 'sec-am1-fi-b', 'ev-7', 9, '2026-09-22T17:00:00.000Z', null),
  ('ap-6', '30106', 'sec-am1-fi-b', 'ev-7', 5, '2026-09-22T17:00:00.000Z', null),
  ('ap-7', '30107', 'sec-am1-fce-a', 'ev-9', 8, '2026-09-28T21:00:00.000Z', null),
  ('ap-8', '30108', 'sec-am1-fce-a', 'ev-9', 7, '2026-09-28T21:00:00.000Z', null),
  ('ap-9', '30109', 'sec-am1-fce-a', 'ev-9', 6, '2026-09-28T21:00:00.000Z', null),
  ('ap-10', '30107', 'sec-co1-fce-a', 'ev-13', 6, '2026-10-06T21:00:00.000Z', null),
  ('ap-11', '30108', 'sec-co1-fce-a', 'ev-13', 8, '2026-10-06T21:00:00.000Z', null),
  ('ap-12', '30110', 'sec-co1-fce-a', 'ev-13', 7, '2026-10-06T21:00:00.000Z', null)
on conflict (id) do update set person_id = excluded.person_id, section_id = excluded.section_id, assessment_id = excluded.assessment_id, grade = excluded.grade, date = excluded.date, loaded_at = excluded.loaded_at;

insert into siu_absences (id, person_id, section_id, date, justified) values
  ('in-1', '30101', 'sec-am1-fi-a', '2026-09-23T11:00:00.000Z', false),
  ('in-2', '30101', 'sec-pr1-fi-a', '2026-09-18T11:00:00.000Z', true),
  ('in-3', '30101', 'sec-pr1-fi-a', '2026-10-16T11:00:00.000Z', false),
  ('in-4', '30102', 'sec-am1-fi-a', '2026-09-14T11:00:00.000Z', false),
  ('in-5', '30105', 'sec-am1-fi-a', '2026-08-12T11:00:00.000Z', false),
  ('in-6', '30105', 'sec-am1-fi-a', '2026-10-05T11:00:00.000Z', false),
  ('in-7', '30105', 'sec-am1-fi-a', '2026-10-14T11:00:00.000Z', true),
  ('in-8', '30103', 'sec-am1-fi-b', '2026-09-15T11:00:00.000Z', false),
  ('in-9', '30107', 'sec-am1-fce-a', '2026-09-08T11:00:00.000Z', false),
  ('in-10', '30107', 'sec-am1-fce-a', '2026-10-13T11:00:00.000Z', true)
on conflict (id) do update set person_id = excluded.person_id, section_id = excluded.section_id, date = excluded.date, justified = excluded.justified;

insert into siu_absence_limits (section_id, max) values
  ('sec-am1-fi-a', 3),
  ('sec-am1-fi-b', 3),
  ('sec-am1-fce-a', 3),
  ('sec-pr1-fi-a', 3),
  ('sec-co1-fce-a', 3),
  ('sec-aga-fi-a', 3),
  ('sec-iec-fce-a', 3),
  ('sec-fi1-fi-v', 3),
  ('sec-fi1-fi-vt', 3),
  ('sec-pr1-fi-v', 3),
  ('sec-tor-fi-a', 3),
  ('sec-lid-fi-v', 3),
  ('sec-am1-fce-v', 3),
  ('sec-pye-fi-va', 3),
  ('sec-pye-fi-vb', 3),
  ('sec-pye-fi-vc', 3),
  ('sec-cda-fi-v', 3),
  ('sec-vol-fi-v', 3),
  ('sec-fin-fce-vm', 3),
  ('sec-fin-fce-vn', 3),
  ('sec-ndg-fce-v', 3),
  ('sec-vol-fce-a', 3)
on conflict (section_id) do update set max = excluded.max;

insert into siu_certificates (person_id, type, meets_conditions) values
  ('30101', 'alumno-regular', true),
  ('30101', 'examen-final', true),
  ('30102', 'alumno-regular', true),
  ('30102', 'examen-final', false),
  ('30103', 'alumno-regular', true),
  ('30103', 'examen-final', false),
  ('30104', 'alumno-regular', true),
  ('30104', 'examen-final', true),
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
