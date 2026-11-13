-- Generado por npm run moodle:seed desde lib/adapters/synthetic-data.ts. No lo edites a mano.

begin;

delete from moodle_enrolments e where not exists (
  select 1 from (values ('301', 'c-am1-fi-a'), ('302', 'c-am1-fi-b'), ('303', 'c-am1-fce-a'), ('304', 'c-pr1-fi-a'), ('305', 'c-co1-fce-a'), ('301', 'c-aga-fi-a'), ('303', 'c-iec-fce-a'), ('302', 'c-fi1-fi-v'), ('302', 'c-fi1-fi-vt'), ('304', 'c-pr1-fi-v'), ('304', 'c-tor-fi-a'), ('304', 'c-lid-fi-v'), ('303', 'c-am1-fce-v'), ('306', 'c-pye-fi-va'), ('307', 'c-pye-fi-vb'), ('307', 'c-pye-fi-vc'), ('307', 'c-cda-fi-v'), ('306', 'c-vol-fi-v'), ('401', 'c-aga-fi-a'), ('406', 'c-aga-fi-a'), ('404', 'c-aga-fi-a'), ('408', 'c-iec-fce-a'), ('401', 'c-am1-fi-a'), ('401', 'c-pr1-fi-a'), ('402', 'c-am1-fi-a'), ('402', 'c-pr1-fi-a'), ('405', 'c-am1-fi-a'), ('403', 'c-am1-fi-b'), ('404', 'c-am1-fi-b'), ('406', 'c-am1-fi-b'), ('407', 'c-am1-fce-a'), ('407', 'c-co1-fce-a'), ('408', 'c-am1-fce-a'), ('408', 'c-co1-fce-a'), ('409', 'c-am1-fce-a'), ('410', 'c-co1-fce-a'), ('403', 'c-fi1-fi-v'), ('405', 'c-fi1-fi-v')) as keep (user_id, course_id)
  where keep.user_id = e.user_id and keep.course_id = e.course_id
);

insert into moodle_users (id, username, first_name, last_name, email) values
  ('301', 'mariana.ledesma', 'Mariana', 'Ledesma', 'mariana.ledesma@example.edu.ar'),
  ('302', 'gustavo.ferreyra', 'Gustavo', 'Ferreyra', 'gustavo.ferreyra@example.edu.ar'),
  ('303', 'carolina.bustos', 'Carolina', 'Bustos', 'carolina.bustos@example.edu.ar'),
  ('304', 'diego.arrieta', 'Diego', 'Arrieta', 'diego.arrieta@example.edu.ar'),
  ('305', 'silvina.rosales', 'Silvina', 'Rosales', 'silvina.rosales@example.edu.ar'),
  ('306', 'romina.quiroga', 'Romina', 'Quiroga', 'romina.quiroga@example.edu.ar'),
  ('307', 'pablo.molina', 'Pablo', 'Molina', 'pablo.molina@example.edu.ar'),
  ('401', 'tomas.aguirre', 'Tomás', 'Aguirre', 'tomas.aguirre@alumnos.example.edu.ar'),
  ('402', 'lucia.benitez', 'Lucía', 'Benítez', 'lucia.benitez@alumnos.example.edu.ar'),
  ('403', 'martin.cabrera', 'Martín', 'Cabrera', 'martin.cabrera@alumnos.example.edu.ar'),
  ('404', 'sofia.dominguez', 'Sofía', 'Domínguez', 'sofia.dominguez@alumnos.example.edu.ar'),
  ('405', 'joaquin.escobar', 'Joaquín', 'Escobar', 'joaquin.escobar@alumnos.example.edu.ar'),
  ('406', 'valentina.funes', 'Valentina', 'Funes', 'valentina.funes@alumnos.example.edu.ar'),
  ('407', 'agustina.gimenez', 'Agustina', 'Giménez', 'agustina.gimenez@alumnos.example.edu.ar'),
  ('408', 'nicolas.herrera', 'Nicolás', 'Herrera', 'nicolas.herrera@alumnos.example.edu.ar'),
  ('409', 'camila.ibarra', 'Camila', 'Ibarra', 'camila.ibarra@alumnos.example.edu.ar'),
  ('410', 'federico.juarez', 'Federico', 'Juárez', 'federico.juarez@alumnos.example.edu.ar'),
  ('501', 'secretaria.fi', 'Secretaría', 'FI', 'secretaria.fi@example.edu.ar')
on conflict (id) do update set username = excluded.username, first_name = excluded.first_name, last_name = excluded.last_name, email = excluded.email;

insert into moodle_courses (id, short_name, full_name, siu_section_ids) values
  ('c-am1-fi-a', '2C-2026-AM1-FI-A', 'Análisis Matemático I - Comisión A (FI) - Grado 2do Cuatrimestre 2026', array['sec-am1-fi-a']::text[]),
  ('c-am1-fi-b', '2C-2026-AM1-FI-B', 'Análisis Matemático I - Comisión B (FI) - Grado 2do Cuatrimestre 2026', array['sec-am1-fi-b']::text[]),
  ('c-am1-fce-a', '2C-2026-AM1-FCE-A', 'Análisis Matemático I - Comisión A (FCE) - Grado 2do Cuatrimestre 2026', array['sec-am1-fce-a']::text[]),
  ('c-pr1-fi-a', '2C-2026-PR1-FI-A', 'Programación I - Comisión A (FI) - Grado 2do Cuatrimestre 2026', array['sec-pr1-fi-a']::text[]),
  ('c-co1-fce-a', '2C-2026-CO1-FCE-A', 'Contabilidad I - Comisión A (FCE) - Grado 2do Cuatrimestre 2026', array['sec-co1-fce-a']::text[]),
  ('c-aga-fi-a', '1C-2026-AGA-FI-A', 'Álgebra y Geometría Analítica - Comisión A (FI) - Grado 1er Cuatrimestre 2026', array['sec-aga-fi-a']::text[]),
  ('c-iec-fce-a', '1C-2026-IEC-FCE-A', 'Introducción a la Economía - Comisión A (FCE) - Grado 1er Cuatrimestre 2026', array['sec-iec-fce-a']::text[]),
  ('c-fi1-fi-v', 'VERANO-2027-FI1-FI-Verano', 'Física I - Comisión Verano (FI) - Curso de Verano 2027', array['sec-fi1-fi-v']::text[]),
  ('c-fi1-fi-vt', 'VERANO-2027-FI1-FI-Verano tarde', 'Física I - Comisión Verano tarde (FI) - Curso de Verano 2027', array['sec-fi1-fi-vt']::text[]),
  ('c-pr1-fi-v', 'VERANO-2027-PR1-FI-Verano', 'Programación I - Comisión Verano (FI) - Curso de Verano 2027', array['sec-pr1-fi-v']::text[]),
  ('c-tor-fi-a', 'ACT-2C-2026-TOR-FI-Única', 'Taller de Oratoria - Comisión Única (FI) - Actividades de Vida Universitaria 2do Cuatrimestre 2026', array['sec-tor-fi-a']::text[]),
  ('c-lid-fi-v', 'VERANO-2027-LID-FI-Verano', 'Taller de Liderazgo - Comisión Verano (FI) - Curso de Verano 2027', array['sec-lid-fi-v']::text[]),
  ('c-am1-fce-v', 'VERANO-2027-AM1-FCE-Verano', 'Análisis Matemático I - Comisión Verano (FCE) - Curso de Verano 2027', array['sec-am1-fce-v']::text[]),
  ('c-pye-fi-va', 'VERANO-2027-PYE-FI-Verano A', 'Probabilidad y Estadística - Comisión Verano A (FI) - Curso de Verano 2027', array['sec-pye-fi-va']::text[]),
  ('c-pye-fi-vb', 'VERANO-2027-PYE-FI-Verano B', 'Probabilidad y Estadística - Comisión Verano B (FI) - Curso de Verano 2027', array['sec-pye-fi-vb']::text[]),
  ('c-pye-fi-vc', 'VERANO-2027-PYE-FI-Verano C', 'Probabilidad y Estadística - Comisión Verano C (FI) - Curso de Verano 2027', array['sec-pye-fi-vc']::text[]),
  ('c-cda-fi-v', 'VERANO-2027-CDA-FI-Verano', 'Ciencia de Datos - Comisión Verano (FI) - Curso de Verano 2027', array['sec-cda-fi-v']::text[]),
  ('c-vol-fi-v', 'VERANO-2027-VOL-FI-Verano', 'Voluntariado Universitario - Comisión Verano (FI) - Curso de Verano 2027', array['sec-vol-fi-v']::text[])
on conflict (id) do update set short_name = excluded.short_name, full_name = excluded.full_name, siu_section_ids = excluded.siu_section_ids;

insert into moodle_enrolments (user_id, course_id, role) values
  ('301', 'c-am1-fi-a', 'editingteacher'),
  ('302', 'c-am1-fi-b', 'editingteacher'),
  ('303', 'c-am1-fce-a', 'editingteacher'),
  ('304', 'c-pr1-fi-a', 'editingteacher'),
  ('305', 'c-co1-fce-a', 'editingteacher'),
  ('301', 'c-aga-fi-a', 'editingteacher'),
  ('303', 'c-iec-fce-a', 'editingteacher'),
  ('302', 'c-fi1-fi-v', 'editingteacher'),
  ('302', 'c-fi1-fi-vt', 'editingteacher'),
  ('304', 'c-pr1-fi-v', 'editingteacher'),
  ('304', 'c-tor-fi-a', 'editingteacher'),
  ('304', 'c-lid-fi-v', 'editingteacher'),
  ('303', 'c-am1-fce-v', 'editingteacher'),
  ('306', 'c-pye-fi-va', 'editingteacher'),
  ('307', 'c-pye-fi-vb', 'editingteacher'),
  ('307', 'c-pye-fi-vc', 'editingteacher'),
  ('307', 'c-cda-fi-v', 'editingteacher'),
  ('306', 'c-vol-fi-v', 'editingteacher'),
  ('401', 'c-aga-fi-a', 'student'),
  ('406', 'c-aga-fi-a', 'student'),
  ('404', 'c-aga-fi-a', 'student'),
  ('408', 'c-iec-fce-a', 'student'),
  ('401', 'c-am1-fi-a', 'student'),
  ('401', 'c-pr1-fi-a', 'student'),
  ('402', 'c-am1-fi-a', 'student'),
  ('402', 'c-pr1-fi-a', 'student'),
  ('405', 'c-am1-fi-a', 'student'),
  ('403', 'c-am1-fi-b', 'student'),
  ('404', 'c-am1-fi-b', 'student'),
  ('406', 'c-am1-fi-b', 'student'),
  ('407', 'c-am1-fce-a', 'student'),
  ('407', 'c-co1-fce-a', 'student'),
  ('408', 'c-am1-fce-a', 'student'),
  ('408', 'c-co1-fce-a', 'student'),
  ('409', 'c-am1-fce-a', 'student'),
  ('410', 'c-co1-fce-a', 'student'),
  ('403', 'c-fi1-fi-v', 'student'),
  ('405', 'c-fi1-fi-v', 'student')
on conflict (user_id, course_id) do update set role = excluded.role;

insert into moodle_announcements (id, course_id, author_id, subject, message, created_at, attachments) values
  ('av-1', 'c-am1-fi-a', '301', 'Cambio de aula para el segundo parcial', 'El segundo parcial del lunes 16 se toma en el aula 20. Traigan DNI.', '2026-11-06T20:12:00.000Z', '[]'::jsonb),
  ('av-2', 'c-co1-fce-a', '305', 'Temas del segundo parcial', 'Les dejo la lista de temas que entran en el segundo parcial.', '2026-11-03T23:40:00.000Z', '[{"name":"temas-segundo-parcial.pdf","url":"/simulado/moodle/pluginfile.php/co1/temas-segundo-parcial.pdf","contentType":"application/pdf","size":48213}]'::jsonb),
  ('av-3', 'c-pr1-fi-a', '304', 'Consulta antes del parcial', 'El jueves 19 a las 18 hay consulta por Meet para el parcial del viernes 20. Entra todo hasta recursión. El enlace está en el aula.', '2026-11-09T22:30:00.000Z', '[]'::jsonb)
on conflict (id) do update set course_id = excluded.course_id, author_id = excluded.author_id, subject = excluded.subject, message = excluded.message, created_at = excluded.created_at, attachments = excluded.attachments;

insert into moodle_contents (id, course_id, topic, name, type, url, modified_at) values
  ('r-1', 'c-am1-fi-a', 'Unidad 1: Límites', 'Guía de ejercicios 1', 'file', '/simulado/moodle/pluginfile.php/am1-fi-a/guia-1.pdf', '2026-08-11T12:00:00.000Z'),
  ('r-2', 'c-am1-fi-a', 'Unidad 2: Derivadas', 'Guía de ejercicios 2', 'file', '/simulado/moodle/pluginfile.php/am1-fi-a/guia-2.pdf', '2026-09-29T12:00:00.000Z'),
  ('r-3', 'c-am1-fi-b', 'Bibliografía', 'Apunte de la cátedra', 'url', '/simulado/moodle/mod/url/view.php?id=r-3', '2026-08-12T18:00:00.000Z'),
  ('r-4', 'c-pr1-fi-a', 'Trabajos prácticos', 'Enunciado del TP integrador', 'file', '/simulado/moodle/pluginfile.php/pr1-fi-a/tp-integrador.pdf', '2026-09-04T13:00:00.000Z'),
  ('r-5', 'c-am1-fce-a', 'Unidad 1', 'Apunte de funciones', 'file', '/simulado/moodle/pluginfile.php/am1-fce-a/funciones.pdf', '2026-08-14T22:00:00.000Z'),
  ('r-6', 'c-pr1-fi-a', 'Unidad 4: Recursión', 'Guía de ejercicios de recursión', 'file', '/simulado/moodle/pluginfile.php/pr1-fi-a/guia-recursion.pdf', '2026-11-06T14:00:00.000Z')
on conflict (id) do update set course_id = excluded.course_id, topic = excluded.topic, name = excluded.name, type = excluded.type, url = excluded.url, modified_at = excluded.modified_at;

insert into moodle_assignments (id, course_id, name, due_date) values
  ('t-1', 'c-pr1-fi-a', 'Entrega del TP integrador', '2026-10-17T02:59:00.000Z'),
  ('t-2', 'c-pr1-fi-a', 'Ejercicios de recursión', '2026-11-22T02:59:00.000Z'),
  ('t-3', 'c-am1-fi-a', 'Guía 3 resuelta', '2026-11-14T02:59:00.000Z'),
  ('t-4', 'c-co1-fce-a', 'Práctico de asientos', null)
on conflict (id) do update set course_id = excluded.course_id, name = excluded.name, due_date = excluded.due_date;

commit;
