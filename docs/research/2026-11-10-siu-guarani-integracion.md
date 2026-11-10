# SIU-Guaraní 3: licencia y mecanismos de integración

Fecha: 2026-11-10. Ticket #2. Pregunta: qué es SIU-Guaraní 3, bajo qué licencia se distribuye y qué mecanismos de integración documenta (API/servicios, Moodle), para modelar las tablas `siu_*` simuladas de forma fiel a la API real.

Reglas de esta nota: solo fuentes primarias del SIU (sitio, wiki de documentación, especificaciones de API). Cada afirmación lleva su URL. Lo que no se encontró dice «no encontrado» y lo que es deducción dice «inferencia». No hay datos personales: de los esquemas solo se listan nombres de campos.

## 1. Qué es

- SIU-Guaraní es el módulo de gestión académica del SIU: registra las actividades académicas de una institución desde la inscripción hasta el egreso. Fuente: <https://www.siu.edu.ar/siu-guarani/>
- El SIU es un consorcio de universidades en el marco de la Secretaría de Políticas Universitarias. Fuente (trabajo académico que cita al SIU, no página del SIU; secundaria): <https://documentas.redclara.net/bitstream/10786/835/1/11-3_Sistema_gestion_academica_SIU_guarani.pdf>. Nota: esta cifra y descripción vienen de un resultado de búsqueda y no se leyó el PDF completo; tomarla como orientativa.
- La wiki oficial documenta las versiones 3.18 a 3.23.0 (3.23.0 la más reciente listada) y una app móvil. Fuente: <https://documentacion.siu.edu.ar/wiki/SIU-Guarani> (última edición 2026-03-13 según la API de la wiki).
- Tiene módulo de Gestión (operaciones administrativas) y de Autogestión («3W», perfiles Alumno y Docente). Fuentes: <https://documentacion.siu.edu.ar/wiki/SIU-Guarani/Version3.18.0/Documentacion_de_Autogestion/Cursadas>, <https://documentacion.siu.edu.ar/wiki/SIU-Guarani/Version3.22.0/API_REST_GUARANI>
- Integra con plataformas de educación a distancia (Moodle), becas, encuestas y facturación/cobranzas. Fuente: <https://www.siu.edu.ar/siu-guarani/>

## 2. Licencia y distribución

**No encontrado / no confirmado: la licencia de SIU-Guaraní 3.** Lo que se revisó y no la declara:

- Página del producto: no menciona licencia ni modelo de distribución. <https://www.siu.edu.ar/siu-guarani/>
- Página del ecosistema: el único dato de licencia es «licencia libre» para SIU-Toba (el framework), no para Guaraní. <https://www.siu.edu.ar/ecosistema>
- Documentación de SIU-Toba: su código está en GitHub (SIU-Toba/framework), es software libre y los términos están en `licencia.txt` del repo. Esto es de Toba, no de Guaraní. <http://documentacion.siu.edu.ar/toba/docs/como-obtener/>
- Organización GitHub SIU-Toba: la única licencia visible en la primera página de repos es LGPL-3.0 (Structures_Graph, un fork). No hay repo de Guaraní ahí. <https://github.com/SIU-Toba>
- Wiki de Guaraní: la búsqueda de «licencia» solo devuelve el concepto de licencia estudiantil, no licencia de software. API de búsqueda: <https://documentacion.siu.edu.ar/wiki/api.php?action=query&list=search&srsearch=licencia&format=json>

Distribución, lo que sí está documentado:

- La app móvil y el código de la API-App se descargan «del colab» (portal de la comunidad SIU) con `svn checkout` desde el «nodo» de la institución, y la institución debe pedir al SIU por GDS (gestor de pedidos) una apk de prueba. Fuente: <https://documentacion.siu.edu.ar/wiki/SIU-Guarani/API-App>
- Inferencia (no confirmada): Guaraní se obtiene a través de la comunidad SIU (colab/portal) y no como descarga pública abierta. Falta una fuente que lo diga explícitamente.
- No encontrado: si una universidad privada (como la Austral) puede obtenerlo y bajo qué condiciones. Pregunta para el SIU: <https://www.siu.edu.ar/contacto>

## 3. API REST de Guaraní (documentada)

Fuentes: <https://documentacion.siu.edu.ar/wiki/SIU-Guarani/Version3.22.0/API_REST_GUARANI> y las especificaciones Swagger 2.0 publicadas por el SIU: <https://documentacion.siu.edu.ar/apis/specs/guarani_v2.json> (v2.1) y <https://documentacion.siu.edu.ar/apis/specs/guarani_v1.json> (v1.0). Índice de APIs: <https://documentacion.siu.edu.ar/apis/?spec=guarani_v2>.

Generalidades:

- La API REST «engloba un conjunto de servicios» para comunicar Guaraní con otros sistemas. Desde 3.22.0 está versionada y se accede en `http://<url_gestion>/rest/v2/`; en 3.20.0 aparecía `/rest/v1/`. Fuentes: página 3.22.0 arriba y <https://foro.comunidad.siu.edu.ar/t/acceso-a-documentacion-apis/24447> (foro oficial de la comunidad).
- `basePath` de la spec v2: `/guarani/rest/v2` (spec JSON arriba).
- Autenticación: `basic` o `digest`, usuarios definidos en `servidor_usuarios.ini` y permisos por recurso en `recursos_usuarios.php`. Se recomienda un usuario distinto por sistema consumidor (Tehuelche, Sanaviron-Quilmes, 3W, SICer). Fuente: página 3.22.0.
- Los permisos son por usuario y recurso (inferencia a partir de `recursos_usuarios.php`; el detalle del formato no se leyó).

### 3.1 Endpoints de la spec v2 (`guarani_v2.json`), agrupados

Lectura de inscripciones y cursada:

| Método y ruta | Descripción de la spec |
|---|---|
| `GET /inscripciones` | Inscripciones a cursada. Filtros: `comision`, `nro_transaccion`, `historicas` (vigentes por defecto), `estado_inscripcion` (AP aceptadas/pendientes, RB rechazadas/bajas, T todas) |
| `GET /inscripciones/{id_inscripcion}` | Datos de una inscripción a cursada |
| `GET /inscripciones-mesas` | Inscripciones a exámenes. Filtros: `llamado_mesa`, `nro_transaccion`, `historicas` |
| `GET /comisiones` | Comisiones activas. Filtros: `nombre`, `actividad`, `actividad_codigo`, `con_horarios`, `con_docentes`, `order`, `limit` (20), `page` |
| `GET /comisiones/{id_comision}` y `/docentes` | Datos de la comisión y sus docentes |
| `GET /docentes`, `/docentes/{id}`, `/docentes/{id}/comisiones`, `/docentes/{id}/mesas` | Docentes activos, sus comisiones y sus mesas de examen |
| `GET /personas/{persona}/agenda` | Agenda del día (parámetros `fecha`, `modalidad`) |
| `GET /personas/{persona}/datosanalitico` | Historia académica |
| `GET /alumnos/{alumno}/certificados/{certificado}` | Valida si el alumno cumple condiciones del certificado (`cumple_condiciones: boolean`) |
| `GET /planes-versiones`, `/planes-versiones/{id}/actividades` | Planes y sus actividades |
| `GET /propuestas-formativas`, `/propuestas-formativas/{id}` | Propuestas formativas |
| `GET /oferta-cursos`, `/licencias-estudiantiles`, `/alumnos`, `/alumnos-pasivos`, `/alumnos-no-regulares`, `/alumnos-cambios-calidades`, `/preinscriptos`, `/personas`, `/convocatorias...`, `/info`, `/status` | Otros listados |

Escritura y vínculo con plataformas virtuales:

| Método y ruta | Descripción de la spec |
|---|---|
| `GET/POST /cursos`, `GET/PUT/DELETE /cursos/{id_curso}` | Cursos de plataforma virtual; el esquema `Curso` tiene `id_curso`, `id_curso_externo`, `plataforma`, `comisiones` |
| `GET /cursos/{id_curso}/alumnos` | Alumnos del curso |
| `PUT/DELETE /cursos/{id_curso}/comisiones/{id_comision}` | Asocia o desvincula una comisión a un curso |
| `PUT /convocatorias/{id_convocatoria}` | Modifica una convocatoria |
| `POST /morosos`, `POST /notificaciones-pagos` | Reciben avisos de SQ (cobranzas) |

Hallazgos clave para el simulador:

- **No hay endpoint para inscribir** a cursada ni a examen: `/inscripciones` y `/inscripciones-mesas` solo tienen GET en v1.0 y v2.1 (se listaron todos los paths de ambas specs). La inscripción se hace desde Autogestión (sección 5). Fuente: specs JSON arriba. Es un resultado de esa spec; no se descarta que exista otro canal no documentado.
- **No hay endpoints de actas ni de constancias** en la spec, salvo la validación de certificado (`/alumnos/{alumno}/certificados/{certificado}`) y la historia académica (`datosanalitico`).
- **No hay endpoint de «cronograma de evaluaciones»** por ese nombre. Lo más cercano: `comisiones` (con `horarios`, `instancias`), `docentes/{id}/mesas` y `inscripciones-mesas` con `llamado_mesa`. Mesas de examen como recurso propio: no encontrado en la spec.
- v1 y v2 listan los mismos paths salvo `/alumnos-cambios-calidades`, `/alumnos-no-regulares`, `/alumnos-pasivos`, `/licencias-estudiantiles` y `POST /reaperturas-convocatorias`, que están en v2 y no en v1 (comparación de ambos JSON).
- Cambios de v2 según el changelog de la wiki: `fecha_evaluacion_ha` pasa a `fecha_evaluacion_ha_hasta` en convocatorias, y `datosanalitico` suma `fecha_inicio_tramite` y `nro_expediente`. Fuente: página 3.22.0.

### 3.2 Campos de los esquemas (solo nombres, spec v2)

- `Inscripcion`: `inscripcion`, `nro_transaccion`, `fecha_inscripcion`, `estado`, `propuesta`, `id_actividad`, `id_comision`, `sq_token`, más campos de la persona (apellido, nombres, género, documento, email, teléfono).
- `InscripcionMesa`: `inscripcion`, `nro_transaccion`, `fecha_inscripcion`, `estado`, `llamado_mesa`, más campos de la persona.
- `Comision`: `comision`, `nombre`, `catedra`, `modalidades`, `instancias`, `turno`, `ubicacion`, `actividad`, `periodo_lectivo`, `horarios`, `docentes`.
- `Historia` (analítico): `propuesta`, `plan_alumno`, `plan_vigente`, `tipo`, `actividad_nombre`, `actividad_codigo`, `creditos`, `fecha`, `nota`, `resultado`, `folio_fisico`, `acta_resolucion`, `promedio`, `promedio_sin_aplazos`, `forma_aprobacion`, `es_optativa`, `fecha_ingreso`, `fecha_egreso` y campos del título (resoluciones ministerial, CONEAU y SPU).
- `Agenda`: `tipo_actividad`, `tipo_persona`, `legajo`, `actividad`, `horario`, `ubicacion`, `modalidad`.

Fuente de los cuatro bloques: <https://documentacion.siu.edu.ar/apis/specs/guarani_v2.json>. Los tipos y valores de dominio de los campos `estado` y similares no vienen en la spec: no confirmados.

### 3.3 Tablas reales mencionadas por el SIU (para nombrar `siu_*`)

La página de la API-App lista las tablas de la base de Gestión que la app necesita leer: `sga_alumnos`, `sga_comisiones`, `sga_comisiones_bh`, `sga_insc_cursada`, `sga_insc_examen`, `sga_llamados_mesa`, `sga_mesas_examen`, `sga_clases`, `sga_clases_tipos`, `sga_asignaciones`, `sga_edificaciones`, `sga_elementos`, `sga_espacios`, `sga_espacios_asignacion`, `sga_ubicaciones`, `mdp_personas`, `men_documentos`, `men_mensajes`, `men_destinatarios`, `rep_archivos`, `acc_login_externos`. Fuente: <https://documentacion.siu.edu.ar/wiki/SIU-Guarani/API-App>. El modelo completo no se encontró en una fuente pública; las columnas de esas tablas, no confirmadas.

## 4. Integración con Moodle (documentada por el SIU, versión 3.21)

Fuentes: <https://documentacion.siu.edu.ar/wiki/SIU-Guarani/version3.21.0/interfaces/moodle>, <https://documentacion.siu.edu.ar/wiki/SIU-Guarani/version3.21.0/interfaces/moodle_comandos>, <https://documentacion.siu.edu.ar/wiki/SIU-Guarani/Version3.17.0/principales_circuitos_funcionales/circuito_cursos_virtuales>.

- Mecanismo: Guaraní llama a los **web services REST de Moodle** con un token. Se configura en Gestión, operación «Administrar Configuración del Sistema», creando una «Plataforma de Educación Virtual» (nombre, host, activa, URL del servicio, usuario, token, responsables académicas, roles, categoría de cursos).
- Compatibilidad documentada: Guaraní 3.21 se probó con Moodle 3.4 a 4.0 y «no se garantiza» con otras versiones de este último (misma página).
- En Moodle hay que instalar el plugin «Roles WS Plugin (SIU)» (función `local_user_get_roles`), habilitar servicios web y protocolo REST, crear un servicio y un rol con las capacidades `webservice:createtoken`, `webservice/rest:use` y `moodle/role:manage`.
- Funciones de Moodle que Guaraní necesita: `core_webservice_get_site_info`, `core_course_get_categories`, `core_course_get_courses`, `core_course_get_courses_by_field`, `core_enrol_get_enrolled_users`, `core_enrol_get_users_courses`, `core_user_create_users`, `core_user_update_users`, `enrol_manual_enrol_users`, `enrol_manual_unenrol_users`, `core_course_create_courses`, `core_course_import_course`, `core_user_get_users`, `local_user_get_roles`, `core_group_create_groups`, `core_group_add_group_members`, `core_group_delete_groups`.
- Flujo: se crea un curso virtual por comisión o se vincula la comisión a un curso existente (Administrar Comisiones, pestaña Moodle, o el docente desde Autogestión > Cursadas > Moodle), y se sincroniza la matrícula de alumnos y docentes según inscripciones y responsabilidades docentes. Hay creación masiva en la operación «Generar Cursos Virtuales Masivamente». Se puede vincular más de una plataforma.
- Usuarios: las personas de Guaraní necesitan al menos un email; el usuario solo admite minúsculas, números y `_ - . @`. Hay comandos de consola `exportar_usuarios_moodle` (CSV), `vincular_usuarios_moodle` (por `username`, `fullname`, `email`), `resolver_eliminacion_manual_moodle`, `actualizar_alumnos_comision_moodle` y `actualizar_docentes_comision_moodle`. Si se borra a mano un usuario o curso en Moodle, Guaraní no se entera (página de comandos).
- La plataforma vive en la tabla `int_pv_plataformas` (página de comandos). Single Sign-On con Moodle documentado aparte: <https://documentacion.siu.edu.ar/wiki/SIU-Guarani/version3.21.0/interfaces/moodle_sso>.
- Dirección: Guaraní es quien escribe en Moodle (crea cursos, usuarios y matrículas). La documentación revisada no describe a Moodle escribiendo en Guaraní. Esto es lo que dicen las páginas; el sentido «solo Guaraní a Moodle» como regla no está declarado literalmente.
- Qué no se encontró: integración de **notas** de Moodle hacia Guaraní. No aparece en las funciones listadas ni en el circuito.
- Otras universidades: hay documentos de universidades (por ejemplo UNLP) que describen el flujo y un aviso de que la sincronización con Guaraní 3 estaba inactiva durante una migración. Solo se vieron en resultados de búsqueda, sin leer los documentos; quedan **pendientes de verificar** antes de citarlos: <https://www1.ing.unlp.edu.ar/sitio/gestion/archivos/cambio-de-version-a-Guarani-3.pdf>, <https://agro.unlp.edu.ar/node/3207>.

## 5. Lo que ya cubre la interfaz de Autogestión (alumno y docente)

Documentación oficial 3.18 (la más antigua listada con estas páginas; pueden haber cambiado en 3.23):

- Inscripción a materias (cursada): el alumno ve actividades de su plan, y por cada comisión nombre, período lectivo, instancias, cupo, inscriptos, horario y docentes, con botón «Inscribirse»; si hay subcomisiones las agrupa por tipo. <https://documentacion.siu.edu.ar/wiki/SIU-Guarani/Version3.18.0/Documentacion_de_Autogestion/Inscripcion_a_Materias>
- Inscripción a exámenes: requiere mesas con período de inscripción vigente; muestra actividad, fecha y hora, turno, mesa, llamado, instancias que acepta, ubicación, cátedra, docentes y cupos; al inscribirse devuelve un número de transacción y comprobante; permite darse de baja mientras esté vigente. Parámetro `exa_instancia_automatica`. <https://documentacion.siu.edu.ar/wiki/SIU-Guarani/Version3.18.0/Documentacion_de_Autogestion/Inscripcion_a_Examenes>
- Constancias y certificados: el alumno solicita (copias, ante quién, observaciones) y ve el estado: descarga online o retiro por ventanilla, con fecha de vencimiento. <https://documentacion.siu.edu.ar/wiki/SIU-Guarani/Version3.18.0/Documentacion_de_Autogestion/Solicitar_constancias_y_certificados>
- Docente, Cursadas: cargar notas de cursada, crear evaluaciones y cargar sus notas, consultar alumnos, cerrar actas y vincular con Moodle. <https://documentacion.siu.edu.ar/wiki/SIU-Guarani/Version3.18.0/Documentacion_de_Autogestion/Cursadas>
- Existen además páginas de Exámenes, Reportes, Administrar derechos en comisiones y en mesas (títulos en el listado de la wiki; no leídas): <https://documentacion.siu.edu.ar/wiki/api.php?action=query&list=allpages&apprefix=SIU-Guarani/Version3.18.0/Documentacion_de_Autogestion&format=json>

Estas son descripciones de pantalla, no contratos de API. El 3W (Autogestión) se comunica con Gestión por REST (la página de la API cita «gestion-3w-rest»; su contenido no se leyó).

## 6. Respuesta corta para el modelado de `siu_*`

- La API oficial expone lecturas (inscripciones a cursada y a examen, comisiones, docentes y sus mesas, agenda, analítico) y, para escritura, solo el vínculo curso virtual / comisión; inscribir no está en la spec.
- Un simulador fiel debería: exponer inscripciones como solo lectura vía API y modelar la inscripción como acción de la app de Autogestión (con `nro_transaccion`, estado y comprobante), modelar «curso virtual vinculado a comisión» con `plataforma`, `id_curso_externo` y comisiones, y no inventar endpoints de actas, constancias ni mesas.
- Valores de dominio (estados de inscripción, instancias, calidades) y la estructura de actas: no confirmados; salvo `estado_inscripcion` AP/RB/T como filtro de lectura.

## 7. Pendiente

1. Licencia y condiciones de obtención de Guaraní 3: no encontradas en fuentes públicas. Consultar al SIU (<https://www.siu.edu.ar/contacto>) o al responsable de Guaraní en la Universidad Austral.
2. Leer las páginas de Exámenes, Reportes y la de gestión-3W REST de la wiki si se necesita más detalle de actas.
3. Verificar los documentos UNLP citados en 4 antes de usarlos como evidencia de integraciones en otras universidades.
4. Todo lo anterior describe versiones 3.18 a 3.22 de la documentación pública; la versión instalada en la Austral no está confirmada.
