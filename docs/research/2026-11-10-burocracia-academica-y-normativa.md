# Burocracia académica y normativa que condiciona la integración

Fecha: 2026-11-10. Ticket [#1](https://github.com/ignaciogaspar/campus-hackai/issues/1).

Pregunta: qué procesos académicos del alumno en una universidad privada argentina están regulados por normativa, qué exige cada norma y qué traba o permite automatizarlos e integrarlos, sin reemplazar al sistema de registro oficial.

No es asesoramiento legal. Todo lo que dice «Fuente» sale de la URL que lo acompaña. Lo que no se encontró en una fuente oficial figura como **no encontrado**. Lo que es razonamiento nuestro figura como **inferencia**.

## Cómo se hizo y límites

- Las normas se leyeron en las páginas oficiales (InfoLEG, argentina.gob.ar, Boletín Oficial citado desde argentina.gob.ar) y en los PDF y páginas de la Universidad Austral. Las páginas se procesaron con una herramienta de lectura que devuelve resúmenes: los números de artículo y los plazos están tomados de ahí, y las citas literales son cortas. **Antes de citar una norma en el pitch o en un doc para terceros, abrir el link y confirmar el artículo.**
- InfoLEG bloquea la descarga directa con `curl` (error 403); por eso no hay texto bajado de las normas del Estado.
- La nota se escribió sobre `main`, donde todavía no estaban los ADR 0004 y 0005, así que no se usaron.
- **Verificación posterior (10/11/2026):** se confirmaron contra el texto oficial el art. 29 inc. j de la Ley 24.521, el plazo de diez días corridos del art. 14 de la Ley 25.326 y los arts. 1 y 4 de la Res. 1892/2022 (SICER 2.0, deja sin efecto la Res. 231/2018). El resto sigue con la advertencia de arriba.
- No se navegó SIU ni Campus (el relevamiento está en [2026-11-10-relevamiento-siu-campus.md](2026-11-10-relevamiento-siu-campus.md)). Con datos personales: ninguno.
- No se consultó a Austral. Lo de Austral es solo lo que publica.

## Resumen para decidir

1. **Casi ningún proceso de cursada tiene una norma nacional que diga cómo hacerlo.** La ley deja a cada universidad el régimen de admisión, permanencia, promoción y equivalencias (art. 29 inc. j). Las reglas concretas de inscripción a materias y a exámenes, correlatividades y actas **no se encontraron** en normas nacionales; están en reglamentos de cada universidad (Austral: ver sección 3).
2. **Lo que sí está regulado a nivel nacional y toca al alumno:** ingreso (art. 7 de la Ley 24.521), títulos y certificados analíticos con intervención del Ministerio (Res. 1892/2022 y Registro Público de Graduados), educación a distancia (Res. 2599/2023) y datos personales (Ley 25.326).
3. **Austral dice que sus notas se registran en SIU** y que el certificado analítico se legaliza ante dependencias públicas. SIU es el sistema de registro. La integración razonable es leer o iniciar trámites desde HackAI y dejar que SIU registre (inferencia, ver sección 5).
4. **Matriculación en el aula virtual:** no se encontró ninguna norma. Sí hay una interfaz oficial SIU Guaraní a Moodle que crea usuarios y matricula por servicios web.

## 1. Normas nacionales encontradas

| Norma | Qué dice (resumen) | Fuente |
|---|---|---|
| Ley 24.521 de Educación Superior, art. 29 inc. j | Las universidades tienen autonomía para establecer el régimen de admisión, permanencia y promoción de estudiantes y el de equivalencias | [InfoLEG](https://servicios.infoleg.gob.ar/infolegInternet/anexos/25000-29999/25394/texact.htm) |
| Ley 24.521, art. 38 | Las universidades dictan normas y acuerdos para facilitar articulación y equivalencias entre carreras de una misma o de distintas instituciones | idem |
| Ley 24.521, arts. 40 a 42 | Solo las universidades otorgan grados de licenciado, magíster y doctor; el Ministerio da el reconocimiento oficial de los títulos, que tienen validez nacional | idem |
| Ley 24.521, art. 44 y 46 | Evaluación externa de las instituciones al menos cada seis años; la CONEAU la coordina y acredita carreras | idem |
| Ley 27.204, art. 4 (nuevo art. 7 de la 24.521) | Quien aprueba el secundario ingresa al grado «de manera libre e irrestricta». Mayores de 25 sin secundario: ingreso con evaluaciones de preparación o experiencia. La nivelación no puede ser selectiva ni excluyente. Alcanza a instituciones privadas autorizadas (art. 1 de la ley). La gratuidad (art. 2 bis) es solo para gestión estatal | [argentina.gob.ar](https://www.argentina.gob.ar/normativa/nacional/ley-27204-254825/texto), publicada en el Boletín Oficial el 11/11/2015 |
| Ley 24.521, art. 50 | Regularidad de los estudios, pero lo regula **para universidades nacionales** (texto sustituido por Ley 27.204, art. 5). No se encontró un equivalente nacional para privadas | [InfoLEG](https://servicios.infoleg.gob.ar/infolegInternet/anexos/25000-29999/25394/texact.htm), [argentina.gob.ar](https://www.argentina.gob.ar/normativa/nacional/ley-27204-254825/texto) |
| Ley 25.326 de Protección de los Datos Personales | Calidad y finalidad de los datos (art. 4), consentimiento (art. 5), datos sensibles (arts. 2 y 7), seguridad (art. 9), confidencialidad (art. 10), cesión con consentimiento (art. 11), acceso en 10 días corridos (art. 14), rectificación o supresión en 5 días hábiles (art. 16), servicios por cuenta de terceros: no usar los datos para otro fin y destruirlos al terminar (art. 25) | [InfoLEG](https://servicios.infoleg.gob.ar/infolegInternet/anexos/60000-64999/64790/texact.htm) |
| Ley 25.506 de Firma Digital | Reconoce firma electrónica y firma digital. La digital se presume del titular del certificado (art. 7) y presume integridad (art. 8); es válida si el certificado lo emitió o reconoció un certificador licenciado (art. 9). La firma electrónica, si se desconoce, la prueba quien la invoca (art. 5). El documento digital cumple el requisito de escritura (art. 6). La conservación puede hacerse con documentos digitales firmados, accesibles y con origen, destino, fecha y hora (art. 12) | [argentina.gob.ar](https://www.argentina.gob.ar/normativa/nacional/ley-25506-70749/texto). Es el texto original: **no se verificó** si leyes o decretos posteriores lo modificaron |
| Resolución 2599/2023 (Ministerio de Educación), educación a distancia | Una carrera es a distancia si la interacción pedagógica supera el 50% de la carga horaria. Exige un Sistema Institucional de Educación a Distancia (SIED) validado por resolución ministerial, evaluado por la CONEAU. Pide describir tecnologías y procedimientos de evaluación «confiables y válidos». **No** fija requisitos técnicos de plataforma, **no** menciona registro de actividad del estudiante ni conservación de registros | [argentina.gob.ar](https://www.argentina.gob.ar/normativa/nacional/norma-393379/texto). Dejó sin efecto el anexo de la Res. 2641/2017 según la [portada de esa resolución](https://www.argentina.gob.ar/normativa/nacional/resolución-2641-2017-275872/texto) y las búsquedas; la 2599 habla de «instituciones universitarias» sin distinguir públicas y privadas |
| Resolución 1892/2022 (Ministerio de Educación) | La intervención de la Dirección Nacional de Gestión Universitaria sobre diplomas y certificados analíticos se tramita por SICER 2.0 (deja sin efecto la Res. 231/2018). Las universidades envían la formalización de firmas de sus autoridades o el registro de firma electrónica. Cambios de nombre y de género en títulos son competencia de la universidad (art. 4) | [argentina.gob.ar](https://www.argentina.gob.ar/normativa/nacional/norma-367833/texto), Boletín Oficial 12/07/2022 |
| Resolución 231-E/2018 (anexo) | Lo que pedía el procedimiento anterior: informar al interesado que sus datos irán al Registro Público de Graduados; el certificado analítico debe mencionar el título secundario que habilitó el ingreso (o el acto de ingreso para mayores de 25 o la situación del título extranjero). **Quedó sin efecto por la 1892/2022**; se la cita como antecedente y no se verificó si esas exigencias se mantienen | [argentina.gob.ar](https://www.argentina.gob.ar/normativa/nacional/norma-306733/texto) |
| Resolución ME 3723-E/2017 | Crea el Registro Público de Graduados Universitarios. La consulta pública devuelve solo nombre y apellido, DNI, título e institución (art. 5). Habla de «universidades e institutos universitarios» sin excluir privadas. No fija plazos de carga | Copia publicada por la [UNC](https://www.unc.edu.ar/sites/default/files/RESOLUCI%C3%93N%20N%C2%BA%203723-17.pdf); **no se encontró el texto en el Boletín Oficial ni en argentina.gob.ar** y el anexo no se leyó |

## 2. Qué dice Austral sobre sí misma

- **Reglamento General de Estudiantes** (Res. CS 11/2025, vigente desde el 1/01/2026; aprobado por el Consejo Superior el 9/09/2025). Alcanza a estudiantes de pregrado, grado y posgrado, presenciales o a distancia. Es sobre todo de derechos y convivencia. Dice que las calificaciones en exámenes y trabajos prácticos «son de naturaleza pública», se registran en el SIU y constan en el certificado analítico, que se legaliza ante las dependencias públicas; no son «publicables» (no pueden difundirse). Reconoce el derecho a conocer las razones de una nota y pedir su reconsideración, a obtener constancias de estudios y a la protección de datos personales. Los familiares o empleadores que quieran información académica deben pedírsela al alumno (certificado o vista del legajo en el SIU), no a la universidad. Fuente: [PDF oficial](https://www.austral.edu.ar/wp-content/uploads/2026/02/Reglamento-General-de-Estudiantes-2026-web.pdf) (leído con la herramienta de texto de macOS, páginas 8 a 10 y 27). **No contiene** reglas de inscripción a materias o exámenes, correlatividades, regularidad ni plazos de actas.
- **Política de Privacidad** (versión 2.0, junio 2026, según la página). Para alumnos: la gestión académica (matrícula, calificaciones, legajo) se funda en ejecución de contrato; becas en consentimiento; cumplimiento legal ante ARCA, CONEAU y Ministerio de Educación. Responde a pedidos de derechos en 30 días corridos y se puede reclamar ante la AAIP. Hay proveedores con servidores en Estados Unidos y la Unión Europea, con cláusulas contractuales tipo. No fija plazos de conservación por tipo de dato. Fuente: [austral.edu.ar/politica-de-privacidad](https://www.austral.edu.ar/politica-de-privacidad/).
  - **Discrepancia a revisar:** la política dice 30 días corridos; el art. 14 de la Ley 25.326 dice diez días corridos para responder el acceso (fuente en la sección 1). No se encontró una explicación en la política.
- **Inscripción a grado.** Pide fotocopia del DNI y constancia de alumno regular, constancia de título secundario en trámite o copia del título; extranjeros: pasaporte o documento del Mercosur y convalidación del título secundario o universitario. Hay tres vías: curso de ingreso, ingreso directo y pase universitario. La página no detalla plazos ni menciona SIU. Fuente: [austral.edu.ar/admisiones/inscripciones](https://www.austral.edu.ar/admisiones/inscripciones/).
- **SIU en Austral.** El reporte de sostenibilidad 2024 dice que Austral implementó la Solución de Expediente Electrónico Integrado del SIU, con SUDOCU para documentos digitales y firma electrónica a través de SIU-Araí. El texto atribuye el SIU a «SUNEDU», lo que parece un error del reporte (SUNEDU es un organismo de Perú; esto es una observación nuestra, no confirmada). Fuente: [Reporte de Sostenibilidad 2024](https://www.austral.edu.ar/wp-content/uploads/2025/04/Reporte-Sostenibilidad-2024.pdf), sección Gobernanza.

## 3. Proceso por proceso

La columna «Implicancia» es **inferencia** del equipo, no texto de ninguna norma.

### 3.1 Inscripción a materias y a exámenes

- **Norma nacional:** no encontrada. La ley deja el régimen de permanencia y promoción a la universidad ([Ley 24.521, art. 29 j](https://servicios.infoleg.gob.ar/infolegInternet/anexos/25000-29999/25394/texact.htm)).
- **Austral:** el Reglamento General de Estudiantes no trae las reglas de inscripción (ver sección 2). El único reglamento de Austral con régimen de exámenes que se leyó es el de **posgrados de la Facultad de Derecho** (no aplica a grado): exige que asistencia, contenidos y actas de examen queden registrados en SIU Guaraní y regula examen final y recuperatorio (arts. 41, 48 y 49). Fuente: [Reglamento General de Posgrados FD](https://austral.edu.ar/wp-content/uploads/2025/08/Reglamento-General-de-Posgrados-FD-2022.pdf). Reglas de grado (correlatividades, plazos de inscripción y baja): **no encontradas en fuente de Austral**; probablemente estén en reglamentos por facultad o en la configuración de SIU, a confirmar con la universidad.
- **Sistema:** SIU Guaraní tiene autogestión para el alumno, según el relevamiento propio ([relevamiento](2026-11-10-relevamiento-siu-campus.md)); no se encontró documentación oficial de SIU sobre ese módulo (la búsqueda devolvió manuales de otras universidades, que no se usan acá).
- **Implicancia:** como las reglas viven en la configuración de SIU, un sistema que muestra o simula inscripciones no choca con ninguna norma nacional encontrada, pero para que la inscripción sea válida la tiene que registrar SIU.

### 3.2 Matriculación en el aula virtual

- **Norma:** no encontrada ninguna que regule la matriculación en un aula virtual. La Res. 2599/2023 regula el SIED de las carreras a distancia (sección 1), no el alta de un alumno en un curso de Moodle.
- **Técnico, fuente oficial del SIU:** la interfaz Guaraní a Moodle crea usuarios (exige al menos un email por persona) y matricula y desmatricula alumnos y docentes por servicios web REST de Moodle. Requiere el plugin «Roles WS Plugin (SIU)», un token y un rol de servicio. Un docente sin rol de Moodle asignado a su responsabilidad no se matricula. Probada con Moodle 3.4 a 4.0; con otras versiones «no se garantiza». «Generar Cursos Virtuales Masivamente» crea los cursos. Fuente: [wiki SIU, Guaraní 3.22.0, interfaz Moodle](https://documentacion.siu.edu.ar/wiki/SIU-Guarani/version3.22.0/interfaces/moodle). La lista de interfaces del mismo wiki nombra además API-REST Guaraní, Rest-Hooks, SICer y Preinscripción ([interfaces](https://documentacion.siu.edu.ar/wiki/SIU-Guarani/version3.22.0/interfaces)); **no se pudo leer el detalle de esas páginas**.
- **Moodle:** el complemento de matriculación por base de datos externa solo da de baja a quienes él matriculó, y los usuarios deben existir antes ([docs de Moodle](https://docs.moodle.org/503/en/External_database_enrolment)).
- **Implicancia (inferencia):** esto coincide con lo que ya dice el relevamiento (el SIU conoce el curso de Moodle) y con la idea «matriculación automática SIU a Moodle» de `alcance.md`, que ahí figura fuera de esta base. No se confirmó si Austral usa esta interfaz ni con qué versión de Moodle.

### 3.3 Actas de examen y registro de notas

- **Norma nacional sobre actas:** no encontrada (ni formato, ni plazo de cierre, ni conservación).
- **Austral:** las notas son públicas, se registran en SIU y van al certificado analítico (Reglamento General de Estudiantes, ver sección 2). El reglamento de posgrados FD obliga a registrar las actas en SIU Guaraní y habla de «Libro de Exámenes» (arts. 41 y 49, ver 3.1). Quién firma el acta y en qué plazo: **no encontrado**.
- **Firma:** si Austral firma actas digitalmente, la Ley 25.506 define qué firma tiene valor (sección 1). Qué tipo de firma usa Austral para las actas: **no encontrado**. Solo se sabe que implementó SUDOCU y Araí-Documentos como proveedor de firma electrónica (sección 2).
- **Implicancia (inferencia):** el acta y la nota oficial no deberían salir de HackAI; HackAI puede mostrar la nota y dejar al docente preparar la carga, pero el cierre y la firma quedan en el sistema de registro. Esto es una decisión de diseño; la norma nacional encontrada no la exige.

### 3.4 Constancias y certificados

- **Norma:** diplomas y certificados analíticos pasan por la intervención de la DNGU vía SICER 2.0, con firmas registradas de las autoridades (Res. 1892/2022, sección 1). El certificado analítico debe contener los datos de la resolución de reconocimiento oficial y validez nacional (Res. 231-E/2018, anexo V.2, **derogada**; vigencia actual de esa exigencia no verificada).
- **Austral:** el estudiante tiene derecho a obtener constancias de sus estudios (Reglamento General de Estudiantes). La constancia de alumno regular se usa en trámites; el portal de autogestión es el canal para certificados de posgrado según el reglamento de posgrados FD. El texto específico de la constancia de alumno regular de grado: **no encontrado**.
- **Implicancia (inferencia):** una constancia emitida por HackAI no es un certificado analítico ni un diploma; estos solo valen con el circuito oficial. Para constancias simples hay que ver con Austral qué valor se les da.

### 3.5 Equivalencias

- **Norma:** el régimen de equivalencias es de la universidad (art. 29 j) y el art. 38 pide normas que las faciliten. **No hay plazos ni procedimiento nacional** en lo encontrado.
- **Austral, posgrado Derecho:** equivalencias por escrito y fundadas, hasta el 25% de la carga horaria, con analítico, programa firmado y sellado y resolución de acreditación de CONEAU; las decide el Consejo de Dirección (art. 12 del [reglamento](https://austral.edu.ar/wp-content/uploads/2025/08/Reglamento-General-de-Posgrados-FD-2022.pdf)).
- **Austral, grado:** las páginas de carreras de ciencias biomédicas (Medicina, Psicología, Nutrición, Enfermería) piden solicitud al comité y historial y programas sellados y apostillados; el criterio incluye carga horaria, contenidos y nota. Esa información salió de una búsqueda, **las páginas no se abrieron una por una**: tratarla como no confirmada. Para el resto de las carreras: **no encontrado**.
- **Implicancia (inferencia):** es un trámite con decisión humana y documentación en papel o escaneada; lo automatizable es el seguimiento del estado, no la decisión.

### 3.6 Requisitos de ingreso

- **Norma:** [Ley 27.204, art. 4](https://www.argentina.gob.ar/normativa/nacional/ley-27204-254825/texto), nuevo art. 7 de la Ley 24.521 (sección 1). Para mayores de 25 sin secundario, las evaluaciones las establecen provincias, CABA o universidades.
- **Austral:** documentación y vías de ingreso en la sección 2. Austral informa un curso de ingreso; la ley dice que la nivelación no puede ser selectiva ni excluyente. Si el curso de ingreso de Austral es o no selectivo: **no encontrado**, y no se afirma nada al respecto.
- **Datos:** el certificado analítico final debe mencionar el título secundario que habilitó el ingreso (Res. 231-E/2018, anexo V.1, derogada; ver 3.4).

## 4. Datos personales: lo que condiciona a cualquier integración

Todo esto sale de la [Ley 25.326](https://servicios.infoleg.gob.ar/infolegInternet/anexos/60000-64999/64790/texact.htm) y de la política de Austral (sección 2).

- Los datos deben usarse según la finalidad con que se obtuvieron y ser pertinentes y no excesivos (art. 4).
- La cesión a un tercero requiere consentimiento previo, con excepciones, y cedente y cesionario responden solidariamente (art. 11).
- Quien trata datos por encargo de otro no puede usarlos para otro fin ni cederlos, y debe destruirlos al terminar, salvo autorización expresa (hasta dos años) (art. 25).
- Austral dice que comparte datos con proveedores como encargados bajo confidencialidad y que no cede datos a terceros con fines propios.
- Los datos sensibles (salud, discapacidad, religión, etc.) requieren consentimiento expreso (política de Austral, citando el art. 2).
- **Implicancia (inferencia):** una integración de HackAI con SIU y Moodle sería un tercero que recibe datos de alumnos. Antes de usar datos reales hace falta un acuerdo con Austral (encargado de tratamiento). Para la hackathon, el repo ya fija datos sintéticos (`AGENTS.md`).
- La Ley 25.326 no establece un plazo de conservación para registros académicos en lo que se leyó. **Plazo de conservación de actas y legajos: no encontrado.**

## 5. Qué traba y qué permite automatizar

| Tema | Fuente | Efecto |
|---|---|---|
| El Estado deja las reglas de inscripción, permanencia y equivalencias a cada universidad | Ley 24.521 art. 29 j | **Permite**: no hay norma nacional que impida mostrar o iniciar esos trámites desde otro sistema; las reglas hay que tomarlas de Austral |
| Las notas se registran en el SIU y van al certificado analítico | Reglamento General de Estudiantes de Austral | **Traba** reemplazar el registro: HackAI sería vista o iniciador, no registro oficial |
| Diplomas y certificados analíticos pasan por SICER 2.0 con firmas de las autoridades | Res. 1892/2022 | **Traba** emitirlos desde afuera del circuito; no es automatizable por HackAI |
| SIU tiene interfaz oficial con Moodle (usuarios, matrícula, cursos) | Wiki SIU 3.22.0 | **Permite** automatizar la matriculación, pero exige administrar Moodle y SIU; fuera del alcance del equipo |
| Ley 25.506 | InfoLEG/argentina.gob.ar | La firma digital con certificador licenciado tiene presunciones legales; una firma electrónica simple las pierde (art. 5 y 7) |
| Datos personales | Ley 25.326 | **Traba** usar datos reales sin acuerdo; los sintéticos no tienen este problema |

## 6. No encontrado o sin confirmar

- Reglas de inscripción a materias y a exámenes de **grado** de Austral: plazos, baja, correlatividades, regularidad, turnos. No están en el Reglamento General de Estudiantes.
- Quién firma las actas de Austral y con qué tipo de firma; plazo de cierre; conservación.
- Norma nacional sobre formato, firma o conservación de actas: no encontrada.
- Norma nacional sobre matriculación en aula virtual: no encontrada.
- Texto actual de la Ley 25.506 con sus modificaciones (se leyó el texto original); decretos reglamentarios.
- API REST de Guaraní (recursos, autenticación): el wiki lista «API-REST Guaraní» pero no se pudo leer la página.
- Si Austral usa la interfaz oficial SIU a Moodle y con qué versión.
- Texto de la Res. ME 3723-E/2017 en una fuente del Estado (se leyó una copia de la UNC); su anexo.
- Vigencia posterior a 2022 de SICER 2.0 y de la Res. 1892/2022.
- Régimen de CONEAU para carreras de grado de universidades privadas más allá del art. 44 a 46 de la Ley 24.521: no se buscó en la web de CONEAU.
- Plazos de conservación de datos académicos de Austral: la política no los fija.
- Información de grado de las páginas por carrera de Austral: solo vista en resultados de búsqueda.

## Fuentes

- Ley 24.521: https://servicios.infoleg.gob.ar/infolegInternet/anexos/25000-29999/25394/texact.htm
- Ley 25.326: https://servicios.infoleg.gob.ar/infolegInternet/anexos/60000-64999/64790/texact.htm
- Ley 25.506: https://www.argentina.gob.ar/normativa/nacional/ley-25506-70749/texto
- Ley 27.204: https://www.argentina.gob.ar/normativa/nacional/ley-27204-254825/texto
- Res. 2599/2023: https://www.argentina.gob.ar/normativa/nacional/norma-393379/texto
- Res. 2641/2017: https://www.argentina.gob.ar/normativa/nacional/resolución-2641-2017-275872/texto
- Res. 1892/2022: https://www.argentina.gob.ar/normativa/nacional/norma-367833/texto
- Res. 231-E/2018: https://www.argentina.gob.ar/normativa/nacional/norma-306733/texto
- Res. ME 3723-E/2017 (copia UNC): https://www.unc.edu.ar/sites/default/files/RESOLUCI%C3%93N%20N%C2%BA%203723-17.pdf
- Austral, Reglamento General de Estudiantes: https://www.austral.edu.ar/wp-content/uploads/2026/02/Reglamento-General-de-Estudiantes-2026-web.pdf
- Austral, Política de Privacidad: https://www.austral.edu.ar/politica-de-privacidad/
- Austral, Inscripciones: https://www.austral.edu.ar/admisiones/inscripciones/
- Austral, Reglamento General de Posgrados FD: https://austral.edu.ar/wp-content/uploads/2025/08/Reglamento-General-de-Posgrados-FD-2022.pdf
- Austral, Reporte de Sostenibilidad 2024: https://www.austral.edu.ar/wp-content/uploads/2025/04/Reporte-Sostenibilidad-2024.pdf
- SIU Guaraní 3.22.0, interfaz Moodle: https://documentacion.siu.edu.ar/wiki/SIU-Guarani/version3.22.0/interfaces/moodle
- SIU Guaraní 3.22.0, interfaces: https://documentacion.siu.edu.ar/wiki/SIU-Guarani/version3.22.0/interfaces
- Moodle, matriculación por base de datos externa: https://docs.moodle.org/503/en/External_database_enrolment
