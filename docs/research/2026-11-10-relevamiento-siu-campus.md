# Relevamiento de SIU Guaraní y Campus Virtual

Fecha: 2026-11-10. Resumen del relevamiento de funcionalidades, pasos y clicks de los dos sistemas.

**Fuente completa:** pestaña [Análisis de Claude de SIU y Campus](https://docs.google.com/document/d/1vzCAqms9f6OHlAU2imse0ZOsw-SNLW2Ol5P_9auUWtk/edit?tab=t.9cmmezz46i8q) del Google Doc del equipo. Tiene cada pantalla con para qué sirve, cómo se llega, pasos, qué muestra y fricciones. Esta nota es el índice: para el detalle de una pantalla, ir a la pestaña. Si la pestaña no alcanza, la skill `relevar-siu-campus` vuelve a relevar un área puntual.

## Método

- Una cuenta de alumno de Ingeniería en Informática, en el navegador, **solo lectura**: no se confirmó, envió ni modificó nada.
- Los datos personales se reemplazaron por marcadores (`<nota>`, `<promedio>`).
- «Clicks» cuenta desde la pantalla de inicio de cada sistema (SIU: `/portal/inicio_alumno`; Campus: `/my/`), navegando por menús, sin escribir URLs.
- Lo que no se pudo ver figura como sin verificar.
- Límite: una sola cuenta, un solo día, sin vista docente ni administrativa, sin probar en un celular.

## Mapa de navegación

### SIU Guaraní (portal del alumno)

Portal multipágina con Bootstrap 2; cada click recarga. URLs `/portal/<pantalla>`. Sin breadcrumbs, buscador ni ayuda.

- **Barra superior:** logo (inicio), sobre de mensajes con contador, menú de usuario (Configuración, Cerrar sesión), selector «Propuesta: <carrera>».
- **Inscripción a Materias** (`/portal/cursada`) e **Inscripción a Exámenes** (`/portal/examen`): links directos.
- **Reportes** (13 ítems): Actuación provisoria, Agenda, Historia académica, Inasistencias, Mis inscripciones, Cronograma de evaluaciones, Oferta de comisiones, Plan de estudios, Seguimiento de Solicitud de Título (dos variantes), Solicitudes de Readmisión, Promedio y porcentaje de avance, Vida Universitaria.
- **Trámites** (5 ítems): Orientación, Solicitar Constancias y Certificados, Reasignar Optativa, Descargar Analítico y Diploma Digital, Requisitos de Ingreso.
- **Perfil: Alumno** (selector con una sola opción).

### Campus Virtual (Moodle 5.1, tema Lambda 2)

- **Encabezado:** logo, campana de notificaciones, burbuja de mensajes, menú de usuario (Perfil, Calificaciones, Calendario, Mensajes, Archivos privados, Reportes, Accessibility settings, Preferencias, Salir).
- **Menú principal:** Página Principal, Mis cursos (`/my/`), Calendario, Biblioteca digital (externo), Planning (grilla de aulas en un iframe), Ayuda Campus, lupa de cursos.
- **Dentro de un curso:** barra Curso, Participantes, Calificaciones, Actividades, Competencias, Más; foro Avisos fijo arriba; pestañas por tema o semana (formato Onetopic); índice a la izquierda y cajón de bloques a la derecha.

## Hallazgos clave

1. **Los dos sistemas no se hablan.** Dos calendarios, dos bandejas de mensajes, notas en ambos sin aclarar cuál es la oficial. Único puente: el botón «Ir» de SIU > Mis inscripciones, que abre el curso de Moodle. Ese botón prueba que el SIU conoce el curso de Moodle de cada materia.
2. **El SIU es corto en clicks y largo en respuestas.** Casi todo está a 1 o 2 clicks, pero «qué me falta para recibirme», «qué finales tengo pendientes» y «cuántas faltas tengo» exigen cruzar Plan de estudios, Historia académica e Inasistencias a mano.
3. **El inicio del Campus no muestra nada accionable.** Solo 14 tarjetas de cursos idénticas, mezclando 1C, 2C, anuales y 2025, con nombres en código (`<período> | <año> | <carrera> | <sigla> <Nombre>`, en formato irregular). El período se puede derivar del nombre.
4. **Las tareas frecuentes del Campus cuestan 3 a 5 clicks** y cada cambio de pestaña recarga la página. El alumno busca la semana actual entre hasta 16 pestañas.
5. **Notificaciones solo por Web y Email.** No hay canal push; la app oficial de Moodle no recibe avisos. El alumno no puede suscribirse ni desuscribirse del foro de Avisos.
6. **El alumno no puede darse de baja de un curso del Campus**, y el catálogo de grado no permite auto-matricularse.
7. **«Aspirantes - fi»** es una propuesta pasiva que el selector de propuesta sigue listando; de ahí sale probablemente el aviso de requisitos de ingreso vencidos, que Trámites contradice.
8. **Pantallas rotas o vacías para el alumno:** Agenda (en blanco) y Configuración (vuelve al inicio) en el SIU; Reportes (acceso denegado) y Solicitar curso de Teams (deshabilitado) en el Campus; cinco trámites del SIU con mensajes de una línea.
9. **Diseño de escritorio.** El SIU bloquea el zoom; tablas de 7 a 13 columnas; el Campus esconde accesos en cajones y usa iframes de ancho fijo.
10. **Privacidad:** «Usuarios en línea», último acceso de compañeros, email visible, una contraseña de matriculación en texto plano en un bloque, y ningún período de retención de datos definido.
11. **Escala de la oferta:** Oferta de comisiones carga unas 256 actividades y 518 comisiones en una página sin paginar; el catálogo del Campus tiene 1267 categorías.

Lo que el relevamiento confirma, matiza o no reproduce de cada queja del research está cruzado en [problema.md](../product/problema.md).

## Clicks de las tareas frecuentes

| Tarea | Sistema | Clicks |
| --- | --- | --- |
| Ver mis materias del cuatrimestre | Campus | 0, mezcladas con cursos viejos |
| Entrar a una materia | Campus | 1 |
| Ver un archivo de la semana | Campus | 3 |
| Leer el último aviso de una materia | Campus | 3 |
| Entregar una tarea | Campus | 5 |
| Ver qué vence pronto | Campus | 1 (Calendario; nada en el inicio) |
| Ver mis notas del Campus | Campus | 2 a 3 |
| Inscribirme a una materia | SIU | 3 |
| Darme de baja de una materia | SIU | 2 a 3 |
| Inscribirme a un final | SIU | 4 estimado, sin verificar |
| Ver fechas de parciales | SIU | 2 |
| Ver mi historia académica | SIU | 3 |
| Ver mi promedio | SIU | 2 |
| Saber qué me falta para recibirme | SIU | 2 por pantalla, sin respuesta directa |
| Saber cuántas faltas tengo | SIU | 2, contando filas |
| Pedir constancia de alumno regular | SIU | 4 |
| Leer comunicados de la facultad | SIU | 2 |

La tabla con las rutas completas está en [problema.md](../product/problema.md#línea-base-pasos-y-clicks-de-las-tareas-frecuentes).

## Pendiente de verificar

- Flujo completo de inscripción a un final y su baja (no había mesas abiertas).
- Confirmaciones y mensajes de error al inscribirse o darse de baja de una materia.
- Devolución del docente en una tarea calificada, y si se trunca con «…».
- Qué cambia al elegir la propuesta «Aspirantes - fi».
- Qué hace «Verificar» en las correlativas del Plan de estudios.
- Cómo se obtiene el PDF de una constancia y qué estados tiene la solicitud.
- Experiencia real en celular de ambos sistemas (solo inferida del código).
- Contenido de la guía de Ayuda Campus, del PDF de la app y de la Zona de entrenamiento.
- Toda la vista docente y la administrativa: no se relevaron.
