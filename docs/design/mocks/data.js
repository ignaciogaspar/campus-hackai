/* Datos de ejemplo de los mocks. Todo es sintético. Lo de Tomás Aguirre
   coincide con hackai/lib/adapters/synthetic-data.ts: el «hoy» es el martes
   10/11/2026 a las 12:00. La carga alta (?carga=alta) es un alumno inventado
   con 7 materias, para ver que Hoy no se desborda. El copy se edita solo acá. */
window.HK = {
  hoy: { fecha: 'Martes 10 de noviembre' },
  facultad: 'Facultad de Ingeniería',

  alumno: { nombre: 'Tomás', apellido: 'Aguirre', iniciales: 'TA' },
  alumnoAlta: { nombre: 'Valentina', apellido: 'Paz', iniciales: 'VP' },
  docente: { nombre: 'Mariana', apellido: 'Ledesma', iniciales: 'ML' },

  /* Carga normal: Tomás, 2 materias */
  normal: {
    materias: [
      { sigla: 'AM1', nombre: 'Análisis Matemático I', comision: 'A', docente: 'Mariana Ledesma', noLeidos: 3, proximo: 'Parcial el lun 16' },
      { sigla: 'PR1', nombre: 'Programación I', comision: 'A', docente: 'Diego Arrieta', noLeidos: 1, proximo: 'Parcial el vie 20' },
    ],
    /* Regularizadas sin final aprobado: lo que falta para cerrarlas */
    faltaFinal: [
      { sigla: 'AGA', nombre: 'Álgebra y Geometría Analítica', regular: 'Regular con 6 · 1er cuatrimestre 2026', vence: 'La regularidad vence en julio de 2028', mesa: { texto: 'Final el mié 9/12 · 09:00 · Campus Pilar, aula 12', inscripto: true } },
    ],
    /* Aprobadas, por año de la carrera (inventadas para el mock) */
    aprobadas: [
      { anio: '1er año', items: [
        { nombre: 'Introducción a la Ingeniería', nota: 8, como: 'Promoción', fecha: 'jul 2026' },
        { nombre: 'Antropología I', nota: 9, como: 'Final', fecha: 'jul 2026' },
      ] },
    ],
    proximo: { iso: '2026-11-16', sigla: 'AM1', titulo: 'Segundo parcial', materia: 'Análisis Matemático I', meta: 'Lunes 16 de noviembre · 08:00 · Aula 20', dias: 6 },
    /* Próximas dos semanas, sin el próximo parcial (va arriba) */
    semanas: [
      { iso: '2026-11-13', sigla: 'AM1', dow: 'vie', num: 13, mes: 'nov', titulo: 'Guía 3 resuelta', materia: 'Análisis Matemático I', meta: 'Entrega · vence 23:59', origen: 'moodle' },
      { iso: '2026-11-20', sigla: 'PR1', dow: 'vie', num: 20, mes: 'nov', titulo: 'Parcial', materia: 'Programación I', meta: '09:00', origen: 'siu' },
      { iso: '2026-11-21', sigla: 'PR1', dow: 'sáb', num: 21, mes: 'nov', titulo: 'Ejercicios de recursión', materia: 'Programación I', meta: 'Entrega · vence 23:59', origen: 'moodle' },
      { iso: '2026-11-25', sigla: 'AM1', dow: 'mié', num: 25, mes: 'nov', titulo: 'Recuperatorio', materia: 'Análisis Matemático I', meta: '08:00 · solo si lo necesitás', origen: 'siu' },
    ],
    masAdelante: { dow: 'mié', num: 9, mes: 'dic', titulo: 'Final', materia: 'Álgebra y Geometría Analítica', meta: '09:00 · Campus Pilar, aula 12 · inscripto', origen: 'siu' },
    pasadas: [
      { dow: 'lun', num: 21, mes: 'sep', titulo: 'Primer parcial', materia: 'Análisis Matemático I', meta: 'Nota provisoria: 7', origen: 'siu' },
      { dow: 'vie', num: 16, mes: 'oct', titulo: 'TP integrador', materia: 'Programación I', meta: 'Nota provisoria: 9', origen: 'siu' },
    ],
    inscripciones: [
      { titulo: 'Final de Análisis Matemático I', meta: 'Turno Diciembre · vie 11/12 · quedan 31 lugares', cierra: 'Cierra el 4/12', nota: 'Necesitás la regularidad: la tenés si aprobás el segundo parcial.' },
    ],
    inscripcionesTotal: 2,
  },

  /* Carga alta: alumno inventado con 7 materias */
  alta: {
    materias: [
      { sigla: 'AM2', nombre: 'Análisis Matemático II', comision: 'B', docente: 'Gustavo Ferreyra', noLeidos: 2, proximo: 'Parcial el jue 12' },
      { sigla: 'FI2', nombre: 'Física II', comision: 'A', docente: 'Rocío Quiroga', noLeidos: 0, proximo: 'Parcial el lun 16' },
      { sigla: 'QUI', nombre: 'Química General', comision: 'A', docente: 'Esteban Villalba', noLeidos: 5, proximo: 'TP el mié 18' },
      { sigla: 'PYE', nombre: 'Probabilidad y Estadística', comision: 'C', docente: 'Paula Medina', noLeidos: 1, proximo: 'Parcial el vie 20' },
      { sigla: 'PR2', nombre: 'Programación II', comision: 'A', docente: 'Diego Arrieta', noLeidos: 0, proximo: 'Entrega el dom 22' },
      { sigla: 'ING', nombre: 'Inglés Técnico', comision: 'B', docente: 'Laura Benavídez', noLeidos: 0, proximo: 'Oral el mar 24' },
      { sigla: 'ANT', nombre: 'Antropología', comision: 'D', docente: 'Ignacio Sosa', noLeidos: 3, proximo: 'Ensayo el jue 26' },
    ],
    faltaFinal: [
      { sigla: 'FI1', nombre: 'Física I', regular: 'Regular con 7 · 1er cuatrimestre 2026', vence: 'La regularidad vence en julio de 2028', mesa: { texto: 'Final el vie 11/12 · 09:00 · Campus Pilar, aula 14', inscripto: true } },
      { sigla: 'AL2', nombre: 'Álgebra II', regular: 'Regular con 6 · 2do cuatrimestre 2025', vence: 'La regularidad vence en diciembre de 2027', mesa: { texto: 'Mesa del lun 14/12 · te podés inscribir hasta el 4/12', inscripto: false } },
    ],
    aprobadas: [
      { anio: '2do año', items: [
        { nombre: 'Estática y Resistencia de Materiales', nota: 7, como: 'Final', fecha: 'mar 2026' },
        { nombre: 'Programación I', nota: 8, como: 'Promoción', fecha: 'jul 2026' },
        { nombre: 'Sistemas de Representación', nota: 9, como: 'Promoción', fecha: 'jul 2026' },
        { nombre: 'Antropología II', nota: 8, como: 'Final', fecha: 'jul 2026' },
      ] },
      { anio: '1er año', items: [
        { nombre: 'Análisis Matemático I', nota: 7, como: 'Final', fecha: 'dic 2025' },
        { nombre: 'Álgebra y Geometría Analítica', nota: 6, como: 'Final', fecha: 'feb 2025' },
        { nombre: 'Química', nota: 8, como: 'Promoción', fecha: 'dic 2024' },
        { nombre: 'Introducción a la Ingeniería', nota: 9, como: 'Promoción', fecha: 'jul 2024' },
        { nombre: 'Antropología I', nota: 10, como: 'Final', fecha: 'dic 2024' },
        { nombre: 'Inglés I', nota: 8, como: 'Promoción', fecha: 'dic 2024' },
      ] },
    ],
    proximo: { iso: '2026-11-12', sigla: 'AM2', titulo: 'Segundo parcial', materia: 'Análisis Matemático II', meta: 'Jueves 12 de noviembre · 14:00 · Aula 7', dias: 2 },
    semanas: [
      { iso: '2026-11-13', sigla: 'QUI', dow: 'vie', num: 13, mes: 'nov', titulo: 'Informe de laboratorio 4', materia: 'Química General', meta: 'Entrega · vence 18:00', origen: 'moodle' },
      { iso: '2026-11-16', sigla: 'FI2', dow: 'lun', num: 16, mes: 'nov', titulo: 'Segundo parcial', materia: 'Física II', meta: '08:00', origen: 'siu' },
      { iso: '2026-11-18', sigla: 'QUI', dow: 'mié', num: 18, mes: 'nov', titulo: 'TP de estequiometría', materia: 'Química General', meta: 'Entrega · vence 23:59', origen: 'moodle' },
      { iso: '2026-11-20', sigla: 'PYE', dow: 'vie', num: 20, mes: 'nov', titulo: 'Segundo parcial', materia: 'Probabilidad y Estadística', meta: '10:00', origen: 'siu' },
      { iso: '2026-11-20', sigla: 'QUI', dow: 'vie', num: 20, mes: 'nov', titulo: 'Cuestionario 5', materia: 'Química General', meta: 'Entrega · vence 23:59', origen: 'moodle' },
      { iso: '2026-11-20', sigla: 'ING', dow: 'vie', num: 20, mes: 'nov', titulo: 'Quiz de vocabulario', materia: 'Inglés Técnico', meta: 'Entrega · vence 21:00', origen: 'moodle' },
      { iso: '2026-11-22', sigla: 'PR2', dow: 'dom', num: 22, mes: 'nov', titulo: 'TP de listas enlazadas', materia: 'Programación II', meta: 'Entrega · vence 23:59', origen: 'moodle' },
      { iso: '2026-11-24', sigla: 'ING', dow: 'mar', num: 24, mes: 'nov', titulo: 'Oral', materia: 'Inglés Técnico', meta: '11:30', origen: 'siu' },
      { iso: '2026-11-26', sigla: 'ANT', dow: 'jue', num: 26, mes: 'nov', titulo: 'Entrega del ensayo', materia: 'Antropología', meta: 'Entrega · vence 20:00', origen: 'moodle' },
    ],
    masAdelante: { dow: 'vie', num: 11, mes: 'dic', titulo: 'Final', materia: 'Física I', meta: '09:00 · Campus Pilar, aula 14 · inscripto', origen: 'siu' },
    pasadas: [
      { dow: 'mar', num: 3, mes: 'nov', titulo: 'Primer parcial', materia: 'Inglés Técnico', meta: 'Nota provisoria: 8', origen: 'siu' },
    ],
    inscripciones: [
      { titulo: 'Final de Análisis Matemático II', meta: 'Turno Diciembre · lun 14/12 · quedan 12 lugares', cierra: 'Cierra el 4/12' },
      { titulo: 'Física III · Curso de Verano 2027', meta: 'Comisión Verano · quedan 4 lugares', cierra: 'Cierra el 18/12' },
    ],
    inscripcionesTotal: 4,
  },

  /* Novedades: van a la campana, no a Hoy */
  novedades: [
    { tipo: 'respuesta', icono: 'chat', titulo: 'Respondieron tu consulta', texto: 'Mariana Ledesma: «No, llega hasta derivadas y sus aplicaciones.»', materia: 'Análisis Matemático I · Consultas', hace: 'hace 40 min', cuando: 'Hoy', destino: 'm-espacio.html?tab=consultas' },
    { tipo: 'aviso', icono: 'megaphone', titulo: 'La consulta del jueves pasa al aula 8', texto: 'Esta semana la clase de consulta es en el aula 8 del edificio de grado.', materia: 'Programación I · Avisos', hace: 'hoy 09:15', cuando: 'Hoy', destino: '#' },
    { tipo: 'aviso', icono: 'megaphone', titulo: 'Cambio de aula para el segundo parcial', texto: 'El segundo parcial del lunes 16 se toma en el aula 20. Traigan DNI.', materia: 'Análisis Matemático I · Avisos', hace: 'vie 6/11', cuando: 'Esta semana', destino: 'm-espacio.html?tab=avisos' },
    { tipo: 'material', icono: 'file', titulo: 'resumen-derivadas.pdf', texto: 'Resumen de derivadas para las dos comisiones.', materia: 'Análisis Matemático I · Material', origen: 'discord', hace: 'jue 5/11', cuando: 'Esta semana', destino: 'm-espacio.html?tab=material' },
  ],

  /* Espacio de la materia: Análisis Matemático I, Facultad de Ingeniería */
  espacio: {
    materia: 'Análisis Matemático I',
    comision: 'A',
    docente: 'Mariana Ledesma',
    canalExterno: 'Discord · servidor «Análisis I FI»',
    pestanas: [
      { id: 'avisos', nombre: 'Avisos', noLeidos: 1 },
      { id: 'consultas', nombre: 'Consultas', noLeidos: 1 },
      { id: 'material', nombre: 'Material', noLeidos: 1 },
      { id: 'directos', nombre: 'Directos', noLeidos: 0 },
      { id: 'consultas-generales', nombre: '#consultas-generales', noLeidos: 0 },
    ],
    /* Material agrupado según cómo lo organiza la docente */
    material: {
      unidad: [
        { nombre: 'Unidad 2: Derivadas', abierta: true, items: [
          { nombre: 'resumen-derivadas.pdf', ext: 'PDF', meta: '52 KB · jue 5/11', origen: 'discord', nuevo: true },
          { nombre: 'Guía de ejercicios 2', ext: 'PDF', meta: '29/9', origen: 'moodle' },
        ] },
        { nombre: 'Unidad 1: Límites', items: [
          { nombre: 'Guía de ejercicios 1', ext: 'PDF', meta: '11/8', origen: 'moodle' },
          { nombre: 'Apunte de límites', ext: 'PDF', meta: '11/8', origen: 'hackai' },
        ] },
        { nombre: 'Evaluaciones', items: [
          { nombre: 'Criterios de corrección', ext: 'LINK', meta: '2/9', origen: 'hackai' },
          { nombre: 'Temas del segundo parcial', ext: 'PDF', meta: '31 KB · lun 9/11', origen: 'discord' },
        ] },
      ],
      semana: [
        { nombre: 'Semana del 2 de noviembre', abierta: true, items: [
          { nombre: 'Temas del segundo parcial', ext: 'PDF', meta: '31 KB · lun 9/11', origen: 'discord' },
          { nombre: 'resumen-derivadas.pdf', ext: 'PDF', meta: '52 KB · jue 5/11', origen: 'discord', nuevo: true },
        ] },
        { nombre: 'Semana del 28 de septiembre', items: [
          { nombre: 'Guía de ejercicios 2', ext: 'PDF', meta: '29/9', origen: 'moodle' },
        ] },
        { nombre: 'Semana del 31 de agosto', items: [
          { nombre: 'Criterios de corrección', ext: 'LINK', meta: '2/9', origen: 'hackai' },
        ] },
        { nombre: 'Semana del 10 de agosto', items: [
          { nombre: 'Guía de ejercicios 1', ext: 'PDF', meta: '11/8', origen: 'moodle' },
          { nombre: 'Apunte de límites', ext: 'PDF', meta: '11/8', origen: 'hackai' },
        ] },
      ],
    },
  },

  /* Panel de contexto del espacio, solo en compu */
  contexto: {
    fechas: [
      { dow: 'vie', num: 13, mes: 'nov', titulo: 'Guía 3 resuelta', meta: 'Entrega · 23:59', origen: 'moodle' },
      { dow: 'lun', num: 16, mes: 'nov', titulo: 'Segundo parcial', meta: '08:00 · Aula 20', origen: 'siu' },
      { dow: 'mié', num: 25, mes: 'nov', titulo: 'Recuperatorio', meta: '08:00', origen: 'siu' },
    ],
    material: [
      { nombre: 'Temas del segundo parcial', ext: 'PDF', meta: 'lun 9/11', origen: 'discord' },
      { nombre: 'resumen-derivadas.pdf', ext: 'PDF', meta: 'jue 5/11', origen: 'discord' },
    ],
    docentes: [
      { nombre: 'Mariana Ledesma', iniciales: 'ML', rol: 'Titular · Comisión A', horario: 'Consulta: jueves 18:00' },
      { nombre: 'Julieta Romero', iniciales: 'JR', rol: 'Ayudante · Comisión A', horario: 'Consulta: martes 12:30' },
    ],
  },

  consultas: [
    {
      autor: 'Tomás Aguirre', iniciales: 'TA', hace: 'hoy 10:52',
      texto: '¿Entran integrales en el segundo parcial?',
      resuelta: true,
      respuesta: { autor: 'Mariana Ledesma', iniciales: 'ML', docente: true, hace: 'hoy 11:20', texto: 'No, llega hasta derivadas y sus aplicaciones.' },
    },
    { autor: 'Lucía Benítez', iniciales: 'LB', hace: 'hoy 11:41', texto: '¿El recuperatorio del 25 es del primer parcial, del segundo o de los dos?', resuelta: false },
    { autor: 'fran.99', externo: true, iniciales: 'F', hace: 'hoy 11:58', texto: 'Para la guía 3, ¿el ejercicio 14 se resuelve con L’Hôpital o sin?', resuelta: false },
  ],

  avisos: [
    { autor: 'Mariana Ledesma', iniciales: 'ML', docente: true, hace: 'lun 9/11 18:05', texto: 'Recuerden que el segundo parcial es el lunes 16. Adjunto los temas.', adjunto: 'temas-parcial-2.pdf · 31 KB', nuevo: true },
    { autor: 'Mariana Ledesma', iniciales: 'ML', docente: true, hace: 'vie 6/11 17:12', titulo: 'Cambio de aula para el segundo parcial', texto: 'El segundo parcial del lunes 16 se toma en el aula 20. Traigan DNI.' },
    { autor: 'Avisos de la cátedra', iniciales: 'AC', hace: 'mar 27/10 09:30', texto: 'Ya están las notas del primer parcial en el SIU.' },
  ],

  directos: {
    alumno: [
      { nombre: 'Mariana Ledesma', iniciales: 'ML', docente: true, rol: 'Docente · Comisión A', ultimo: 'Vos: Gracias, profe.', hace: 'lun' },
    ],
    docente: [
      { nombre: 'Tomás Aguirre', iniciales: 'TA', rol: 'Alumno · Comisión A', ultimo: 'Gracias, profe.', hace: 'lun', noLeido: true },
      { nombre: 'Joaquín Escobar', iniciales: 'JE', rol: 'Alumno · Comisión A', ultimo: 'Vos: Pasá por consulta el jueves.', hace: '3/11' },
    ],
  },
}
