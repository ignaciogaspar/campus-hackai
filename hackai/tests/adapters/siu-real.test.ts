/* El SIU real: lee la Autogestión con la sesión de un alumno y responde por
   esa persona; las demás quedan en el SIU de la demo. Las páginas de acá son
   inventadas, con el marcado relevado del SIU de la Austral (comillas simples y
   dobles mezcladas, atributos con mayúscula, el contenido en pagelets JSON, los
   pedidos AJAX con su URL en el `info` de cada pagelet):
   docs/research/2026-11-12-datos-reales-siu-campus.md. */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createFixedClock } from '@/lib/adapters/memoria/clock'
import { createMemoryIdentity } from '@/lib/adapters/memoria/identity'
import { createMemoryPeopleStore } from '@/lib/adapters/memoria/people-store'
import { createMemorySiu } from '@/lib/adapters/memoria/siu'
import { createRealSiu, SESSION_COOKIE } from '@/lib/adapters/siu-real'
import { dropFormIn, enrollFormIn } from '@/lib/adapters/siu-real/actions'
import { pagelets } from '@/lib/adapters/siu-real/html'
import {
  parseAbsences,
  parseAssignments,
  parseCertificates,
  parseCourseSchedules,
  parseEnrollments,
  parseHistory,
  parseOfferedSections,
  parseOpenSubjects,
  parsePlan,
  parseSchedule,
  parseVerifiedHours,
  progressOf,
  splitSectionHeading,
  weekdaysBetween
} from '@/lib/adapters/siu-real/parse'
import { realPersonId, withRealPeople, withRealPerson, withRealSubject } from '@/lib/adapters/siu-real/person'
import { createRealSiuRegistry, siuIdOf } from '@/lib/adapters/siu-real/registry'
import { syntheticData } from '@/lib/adapters/synthetic-data'
import { compose, REAL_PERSON } from '@/lib/composition'
import { openSiuSession, personKey, sealSiuSession, siuSessionFromInput, siuSessionOf } from '@/lib/siu-session'

const BASE = 'https://siu.example.edu.ar/portal'
const TOMAS_SIU = syntheticData.people.find((p) => p.id === 'p-taguirre')!.siuId
const TERM = 'Grado - 2do Cuatrimestre 2026'

/** Una página del 3W: la barra con el nombre y un pagelet por id, con su `info`. */
function page(content: Record<string, string>, info: Record<string, Record<string, string>> = {}): string {
  const scripts = Object.entries(content)
    .map(
      ([id, html]) =>
        `<script type='text/javascript'>kernel.renderer.on_arrival(${JSON.stringify({ op: 'x', info: { id, estado: 'inicial', ...info[id] }, content: html })});</script>`
    )
    .join('')
  return `<html><script>var kernel_config = { op_actual: 'x' };</script><li class="dropdown"><a class="dropdown-toggle" href="#">Lucía Fernández</a></li>${scripts}</html>`
}

const INSCRIPCIONES = `<table class="table comisiones"><tbody>
<tr class="titulo"><th>Fecha inscripción</th><th>Año</th><th>Período lectivo</th><th>Propuesta</th><th>Actividad</th><th>Comisión</th><th>Subcomisión</th><th>Turno</th><th>Cátedra</th><th>Ubicación</th><th>Estado</th><th>Comprobantes</th><th>Moodle</th></tr>
<tr><td>03/08/2026 10:15</td><td>2026</td><td>${TERM}</td><td>IINF</td><td>Bases de Datos (BD2)</td><td>Bases de Datos INF</td><td class="center">No tiene</td><td>Sin definir</td><td>Sin definir</td><td>Sede Pilar</td><td>Aceptada</td><td><a class="btn no-ajax" href="${BASE}/inscripciones/comprobante/x">Generar</a></td><td><a href="${BASE}/inscripciones/curso_moodle/cursada/abc">Ir</a></td></tr>
<tr><td>03/08/2026 10:20</td><td>2026</td><td>${TERM}</td><td>IINF</td><td>Redes (RED1)</td><td>Redes INF</td><td class="center">No tiene</td><td>Sin definir</td><td>Sin definir</td><td>Sede Pilar</td><td>Baja</td><td></td><td></td></tr>
</tbody></table>`

/** Un renglón de la historia, como lo arma el SIU. */
const catedra = (attr: string, value: string, label: string, text: string, id: number, origen: string) =>
  `<div class="catedra" ${attr}="${value}" ><div class='catedra_nombre'><span class="${value}"><strong>${label} </strong> - ${text} - <a href="#" id="${id}" data-origen="${origen}">Detalle</a></span></div><div class='toggle_info_catedra' id="mat_${id}"><div id="info_det_${id}"></div></div></div>`

const HISTORIA = `<div id="listado">
<div class='catedras' materia="2524"><h3 class="titulo-corte">Bases de Datos (BD2)</h3>${catedra('EnCurso', 'Aprobado', 'En curso', 'Inicio de dictado 03/08/2026', 0, 'EnCurso')}</div>
<div class='catedras' materia="1033"><h3 class="titulo-corte">Programación I (PR1)</h3>${catedra('Regularidad', 'Aprobado', 'Regularidad', '7.50 (Siete con 50/100) Aprobado 20/07/2025', 1, 'Regularidad')}${catedra('Examen', 'Aprobado', 'Examen', '8 (Ocho) Aprobado 05/08/2025', 2, 'Examen')}</div>
<div class='catedras' materia="5501"><h3 class="titulo-corte">Inteligencia Artificial (OPT1)</h3>${catedra('Promocion', 'Promocionado', 'Promoción', '9 (Nueve) Promocionado 01/12/2025', 3, 'Promocion')}</div>
<div class='catedras' materia="6601"><h3 class="titulo-corte">Seminario de Liderazgo (SEM9)</h3>${catedra('Examen', 'Aprobado', 'Examen', '9 (Nueve) Aprobado 10/03/2025', 4, 'Examen')}</div>
<div class='catedras' materia="4410"><h3 class="titulo-corte">Torneo de Fútbol (VUDEP01)</h3>${catedra('Examen', 'Aprobado', 'Examen', 'Aprobado (Aprobado) Aprobado 10/05/2025', 5, 'Examen')}</div>
</div>`

const DETALLE_EN_CURSO = `<table class="table"><thead><tr><th>Fecha</th><th>Descripción</th><th>Tipo</th><th>Nota</th><th>Resultado</th><th>Corregido por</th></tr></thead>
<tbody><tr><td>10/09/2026</td><td>Primer Parcial</td><td>Parcial</td><td>7.00 (Siete)</td><td>Aprobado</td><td></td></tr><tr><td>25/11/2026</td><td>Segundo Parcial</td><td>Parcial</td><td>6.00 (Seis)</td><td>Aprobado</td><td></td></tr></tbody></table>`

const VIDA_UNIVERSITARIA = `<h2 class="total-creditos-titulo">Total de créditos aprobados: 1.50</h2><table class="table table-striped table-bordered"><thead><tr><th>Actividad</th><th>Comisión</th><th>Nota</th><th>Fecha</th><th>Créditos</th></tr></thead>
<tbody><tr><td class="text-left">Torneo de Fútbol</td><td class="text-left">Torneo de Fútbol 2025</td><td class="text-center">Aprobado</td><td class="text-center">10/05/2025</td><td class="text-center">1.50</td></tr></tbody></table>`

const CRONOGRAMA = `<div class="titulo_operacion"><h2 class="clearfix"><span class="pull-left">Cronograma de evaluaciones</span></h2></div><h1>Ingeniería en Informática</h1>
<h2>Bases de Datos (BD2) - Comisión: Bases de Datos INF</h2><table class="table"><thead><tr><th>Fecha</th><th>Evaluación</th><th>Tipo</th><th>Hora Inicio</th><th>Hora Fin</th><th>Observaciones</th></tr></thead>
<tbody><tr><td>25/11/2026</td><td>Segundo Parcial</td><td>Parcial</td><td>18:00</td><td>20:00</td><td></td></tr><tr><td>02/12/2026</td><td>Recuperatorio</td><td>Parcial</td><td>18:00</td><td>20:00</td><td></td></tr></tbody></table>`

const ACTUACION = `<table class="table"><thead><tr><th>Propuesta</th><th>Actividad</th><th>Fecha</th><th>Nota</th><th>Resultado</th><th>Nro. Acta</th><th>Año Académico</th><th>Período Lectivo</th><th>Comisión</th></tr></thead>
<tbody><tr><td>IINF</td><td>Bases de Datos</td><td>28/10/2026</td><td>6.50</td><td>Aprobado</td><td></td><td>2026</td><td>${TERM}</td><td>Bases de Datos INF</td></tr></tbody></table>`

const materia = (name: string, nota: string, origen: string, credits = '') =>
  `<tr class="materia"><td>${name}</td><td>Materia</td><td></td><td></td><td>${nota}</td><td>${origen}</td><td>${credits}</td><td></td><td></td></tr><tr class="correlatividades"></tr>`
const modulo = (name: string, inner: string) =>
  `<div class="modulos accordion"><div class="accordion-group"><div class="accordion-heading"><a class="modulos accordion-toggle"><b>Módulo:</b> ${name} </a></div>${inner}</div></div>`

const PLAN = `<table class="table encabezado"><tbody><tr><td><b>Propuesta:</b> (IINF) Ingeniería en Informática</td><td><b>Plan:</b> (IINF/2019) IINF Plan 2019</td><td><b>Versión:</b> V 1.0</td></tr></tbody></table>
${modulo('1er. Año', `<table><tbody>${materia('Programación I (PR1)', '8 (Aprobado)', 'Examen')}</tbody></table>`)}
${modulo('3er. Año', `<table><tbody>${materia('Bases de Datos (BD2)', '', 'En Curso')}</tbody></table>`)}
${modulo('Materias Optativas', `<div class="materia_generica accordion" id="accordion9" data-elemento="9001" data-cargado="false"><div class="accordion-heading"><a class="materia_generica accordion-toggle"><b>Materia Genérica:</b> Materias Optativas (GAGIINFOPT) </a></div><h3><b>Cumplimiento:</b> Obtener 192 horas de actividades aprobadas</h3><button type="button" class="btn btn_verificar_cumplimiento_js" data-regla="116" data-materia="9001" data-parametros="p" data-elemento-comp="1" data-completo="false" >Verificar</button><div class="js-optativas"><!-- aca escribe el ajax --></div></div>`)}
${modulo('Otros Requisitos', `<table><tbody>${materia('Práctica Profesional Supervisada (PPS1)', '', '', '33.00')}${materia('Programa de Vida Universitaria (GFIEXTVU)', '', '', '10.00')}</tbody></table>`)}`

const AVANCE = `<table class="table"><thead><tr><th>Certificado</th><th>Orientación</th><th>Ori. Elegida</th><th>% de Avance</th><th>Aprobadas</th><th>Promedio con aplazos</th><th>Promedio sin aplazos</th></tr></thead>
<tbody><tr><td>Ingeniero en Informática</td><td></td><td>No</td><td>41.5 %</td><td>2</td><td>8.00</td><td>8.00</td></tr></tbody></table>`

const OPTATIVAS = `<table><tbody>${materia('Inteligencia Artificial (OPT1)', '9 (Promocionado)', 'Promoción', '10.00')}${materia('Robótica (OPT2)', '', '', '5.00')}</tbody></table>`

const FILTRO = `<form id='formulario_filtro'><select name="formulario_filtro[ra]" id="formulario_filtro-ra"><option value="">-- Todas --</option><option value="ra-fcb">Facultad de Ciencias Biomédicas</option><option value="ra-fi">Facultad de Ingeniería</option></select></form>`

const HORARIOS = `<div class="accordion" id="accordion3"><div class="accordion-group"><div class="accordion-heading"><a class="accordion-toggle materia" data-toggle="collapse" data-target="#m1"> Bases de Datos ( BD2 ) </a></div><div id="m1" class="accordion-body collapse in"><div class="accordion-inner">
<table class="table"><thead><tr><th>Comisión</th><th>Turno</th><th>Día de la semana</th><th>Hora inicio-fin</th><th>Tipo clase</th><th>Aula</th><th>Cupo</th></tr></thead>
<tbody><tr><td>Bases de Datos INF</td><td></td><td>Miercoles</td><td>18:00 - 20:00</td><td>Teórico-Práctica</td><td>Aula 5 - Edificio B</td><td>40</td></tr><tr><td>Bases de Datos INF</td><td></td><td>Viernes</td><td>14:00 - 16:00</td><td>Laboratorio</td><td>Lab 2 - Edificio B</td><td>40</td></tr><tr><td>Bases de Datos IND</td><td></td><td>Lunes</td><td>08:00 - 10:00</td><td>Teórico-Práctica</td><td>Aula 1 - Edificio A</td><td>30</td></tr></tbody></table></div></div></div></div>`

const LISTA_MATERIAS = `<div id='js-listado-materias'><ul class="nav nav-list"><li class='insc '><a title='Bases de Datos - (BD2)' alt="" href='${BASE}/cursada/elegir_materia/bd2'><span class='js-filter-content'>Bases de Datos</span></a></li><li class=' '><a title='Ayudantía 6 - (VUBEAYU6)' alt="" href='${BASE}/cursada/elegir_materia/ayu6'><span class='js-filter-content'>Ayudantía 6</span></a></li></ul></div>`

const COMISIONES_AYUDANTIA = `<div id='info_materia' class="pagelet"><h3>Ayudantía 6 (VUBEAYU6)</h3><ul id='comisiones' class="unstyled">
<li class='comision no-inscripto js-ubicacion-2 js-horario-' data-periodo="102" data-orderer-index="1"><h4><i class="icon-arrow-right"></i> Comisión: Ayudantía 6 - FI - Grado Anual - 2026</h4><div class='comision_info '>
<div class="row-fluid"><div class='span3'>Instancias:</div><div class="span9">Regularidad</div></div>
<div class="row-fluid"><div class='span3'>Modalidades:</div><div class="span9">Presencial</div></div>
<ul class="unstyled lista-comisiones"><li><div class="row-fluid"><div class='span3'>Cupo:</div><div class="span9"> 30 | Inscriptos: 12</div></div></li>
<li class='docente'><div class="row-fluid"><div class='span3'>Docentes:</div><div class="span9">Ana Gómez (JTP)</div></div></li></ul></div>
<form class='form_inscribir form-horizontal' action='${BASE}/cursada/inscribir' method='POST'><input type="hidden" alt="" value="m-ayu6" name="materia" /><input type="hidden" alt="" value="c-ayu6-fi" name="comision" /><input type="hidden" name="__csrf" value="csrf-fresco" class="btn btn-primary" /><div class="acciones"><input type="submit" value="Inscribirse" class="btn" /></div></form></li></ul></div>`

const COMISIONES_BASES_DE_DATOS = `<div id='info_materia' class="pagelet"><h3>Bases de Datos (BD2)</h3><ul id='comisiones' class="unstyled">
<li class='comision inscripto js-ubicacion-2 js-horario-' data-periodo="104"><div class='inscripcion'><p>Período: ${TERM}</p>
<div class='acciones'><form class='form_baja' action='${BASE}/cursada/baja' method='POST'><input type="hidden" name="__csrf" value="csrf-baja" class="btn btn-primary" /><input type="hidden" name="materia" value="m-bd2" /><input type="hidden" name="inscripcion" value="i-bd2" /><button class="btn">Dar de baja</button></form></div></div></li></ul></div>`

const DETALLE_CURSADA = `<table class="table"><thead><tr><th>Fecha</th><th>Descripción</th><th>Tipo</th><th>Nota</th><th>Resultado</th><th>Corregido por</th></tr></thead>
<tbody><tr><td>15/05/2025</td><td>Parcial 1</td><td>Parcial</td><td>6.00 (Seis)</td><td>Aprobado</td><td></td></tr></tbody></table>`

const SOLICITUDES = `<h2>Listado de solicitudes</h2><a href="${BASE}/solicitudes/nueva_solicitud">Nueva solicitud</a><table class="table"><thead><tr><th>Constancia</th><th>Fecha solicitud</th><th>Presentar a</th><th>Solicitado en</th><th>Copias</th><th>Estado</th><th>Fecha vencimiento</th><th></th></tr></thead>
<tbody><tr><td>Certificado de Plan de Estudios</td><td>04/05/2023</td><td>Quien corresponda</td><td>Gestión</td><td>1</td><td>Impreso</td><td></td><td></td></tr>
<tr><td>Constancia de Alumno Regular</td><td>24/09/2026</td><td>Empresa</td><td>Autogestión</td><td>1</td><td>Online</td><td>23/11/2026</td><td><a href="${BASE}/solicitudes/descargar/abc" title="Descargar certificado">Descargar</a></td></tr></tbody></table>`

const NUEVA_SOLICITUD = `<h2>Solicitar constancias</h2><form id="form" action="${BASE}/solicitudes/nueva_solicitud" method="post">
<select name="constancia" id="constancia"><option value="0">-- Seleccione --</option><option value="1" data-formulario="34000240">Constancia de Alumno Regular</option><option value="102" data-formulario="34000236">Constancia Examen Final</option></select>
<select name="copias" id="copias"></select><input type="text" name="presentar" id="presentar" /><textarea name="observaciones"></textarea></form>`

const INASISTENCIAS = `<div id="listado"><div class="actividad"><h3 class="titulo-corte">(BD2) Bases de Datos - Comisión: Bases de Datos INF</h3><table class="table table-bordered table-condensed comisiones"><tr class="titulo"><th width="10%">Fecha</th><th width="11%">Tipo de clase</th><th>Tema dictado</th><th width="15%">Cant. inasistencias</th><th width="10%">Justificada</th></tr>
<tr><td>02/09/2026</td><td>Teórico-Práctica</td><td></td><td>1.00</td><td>No</td></tr><tr><td>16/09/2026</td><td>Teórico-Práctica</td><td></td><td>0.50</td><td>Si</td></tr></table></div></div>`

/** El calendario de Inscripción a Materias: las asignaciones del alumno, junto a datos personales que no se usan. */
const ASIGNACIONES = [
  {
    MATERIA: 'BD2',
    NOMBRE: 'Bases de Datos INF',
    DIA_SEMANA: '4',
    FECHA_ASIGN_DESDE: '2026-08-03',
    FECHA_ASIGN_HASTA: '2026-11-13'
  },
  {
    MATERIA: 'BD2',
    NOMBRE: 'Bases de Datos INF',
    DIA_SEMANA: '6',
    FECHA_ASIGN_DESDE: '2026-08-03',
    FECHA_ASIGN_HASTA: '2026-11-13'
  },
  { MATERIA: 'RED1', NOMBRE: 'Redes INF', DIA_SEMANA: null, FECHA_ASIGN_DESDE: null, FECHA_ASIGN_HASTA: null }
]
const PERSONA = { apellido: 'Fernández', nombres: 'Lucía', nro_documento: '30111222' }

const json = (value: unknown) => JSON.stringify(value)

/** Lo que responde el SIU de prueba en cada ruta. Las de sesión se cortan si la sesión venció. */
const ROUTES: Record<string, { session: boolean; body: string; contentType?: string }> = {
  inscripciones: { session: true, body: page({ examenes: '<h4>Exámenes</h4>', cursadas: INSCRIPCIONES }) },
  historia_academica: {
    session: true,
    body: page(
      { menu_filtros: '', info_historia: HISTORIA },
      {
        info_historia: {
          url_detalle_encurso: `${BASE}/historia_academica/detalle_encurso`,
          url_detalle_cursada: `${BASE}/historia_academica/detalle_cursada`,
          url_detalle_promocion: `${BASE}/historia_academica/detalle_promocion`,
          url_pdf: `${BASE}/historia_academica/pdf`
        }
      }
    )
  },
  'historia_academica/detalle_cursada': { session: true, body: json({ cod: 1, cont: DETALLE_CURSADA }) },
  'historia_academica/detalle_promocion': { session: true, body: json({ cod: 1, cont: '' }) },
  cursada: {
    session: true,
    body: page(
      { info_materia: '<h3>Comenzar inscripción</h3>', lista_materias: LISTA_MATERIAS, notificaciones: '' },
      { notificaciones: { persona: json(PERSONA), asignaciones: json(ASIGNACIONES) } }
    )
  },
  reporte_inasistencias: { session: true, body: page({ inasistencias: INASISTENCIAS }) },
  'cursada/elegir_materia/ayu6': { session: true, body: json({ cod: 1, cont: COMISIONES_AYUDANTIA }) },
  'cursada/elegir_materia/bd2': { session: true, body: json({ cod: 1, cont: COMISIONES_BASES_DE_DATOS }) },
  'cursada/inscribir': {
    session: true,
    body: json({ cod: 1, mensaje_inscripcion: 'Te inscribiste. Número de transacción: 5521' })
  },
  'cursada/baja': { session: true, body: json({ cod: 1, mensaje_inscripcion: 'Te diste de baja. Comprobante 5522' }) },
  'historia_academica/detalle_encurso': { session: true, body: json({ cod: 1, cont: DETALLE_EN_CURSO }) },
  actuacion_provisoria: { session: true, body: page({ cursa: ACTUACION, promo: '', exa: '' }) },
  cronograma_evaluaciones: { session: true, body: page({ listado: CRONOGRAMA }) },
  plan_estudio: {
    session: true,
    body: page(
      { info_plan: PLAN },
      {
        info_plan: {
          url_optativas: `${BASE}/plan_estudio/optativas`,
          url_verificar_cumplimientos: `${BASE}/plan_estudio/verificar`
        }
      }
    )
  },
  'plan_estudio/optativas': { session: true, body: json({ cod: 1, cont: OPTATIVAS }) },
  'plan_estudio/verificar': {
    session: true,
    body: json({ cod: 1, mensaje_usuario: 'Debe obtener 192 horas de actividades aprobadas del grupo. Lleva 64 horas' })
  },
  reporte_vu: { session: true, body: page({ info_vu: VIDA_UNIVERSITARIA }) },
  porcentaje_avance_carrera: { session: true, body: page({ reporte: AVANCE }) },
  solicitudes: { session: true, body: page({ pagelet: SOLICITUDES }) },
  'solicitudes/nueva_solicitud': {
    session: true,
    body: page({ pagelet: NUEVA_SOLICITUD }, { pagelet: { url_cant_copias: `${BASE}/solicitudes/cant_copias` } })
  },
  'solicitudes/cant_copias': { session: true, body: json({ cod: 1, copias: 3 }) },
  'historia_academica/pdf': { session: true, body: '%PDF-1.4 historia', contentType: 'application/pdf' },
  horarios_cursadas: {
    session: false,
    body: page(
      { filtro: FILTRO },
      {
        filtro: {
          url_buscar_carreras: `${BASE}/horarios_cursadas/carreras`,
          url_buscar_periodo: `${BASE}/horarios_cursadas/periodos`,
          url_buscar_horarios: `${BASE}/horarios_cursadas/horarios`
        }
      }
    )
  },
  'horarios_cursadas/carreras': {
    session: false,
    body: json({ cod: 1, carrera: [{ nombre_abreviado: 'IINF', nombre: 'Ingeniería en Informática', _ID_: 'c-iinf' }] })
  },
  'horarios_cursadas/periodos': {
    session: false,
    body: json([
      { periodo_lectivo: '104', periodo_lectivo_nombre: TERM, fecha_inicio: '2026-06-22', fecha_fin: '2026-12-30' },
      {
        periodo_lectivo: '102',
        periodo_lectivo_nombre: 'Grado Anual - 2026',
        fecha_inicio: '2025-12-15',
        fecha_fin: '2026-12-31'
      }
    ])
  },
  'horarios_cursadas/horarios': {
    session: false,
    body: json({ cod: 1, cont: page({ filtro: '', reporte: HORARIOS }) })
  }
}

const LOGIN = `<script>var kernel_config = { op_actual: 'acceso' };</script><a href="${BASE}/acceso?auth=saml">Ingresar</a>`

function build(options: { expired?: boolean; ttlMs?: number; writes?: boolean } = {}) {
  const clock = createFixedClock(syntheticData.now)
  const requests: { url: string; cookie: string | null; body: string }[] = []
  const fakeFetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input)
    requests.push({ url, cookie: new Headers(init?.headers).get('cookie'), body: String(init?.body ?? '') })
    const path = url
      .slice(BASE.length + 1)
      .split('?')[0]
      .replace(/\/$/, '')
    const route = ROUTES[path]
    // Si una ruta de sesión responde sin sesión, el SIU muestra la pantalla de acceso.
    let body = !route ? '' : route.session && options.expired ? LOGIN : route.body
    // Guardar una solicitud es un POST a la misma pantalla que la muestra.
    if (path === 'solicitudes/nueva_solicitud' && init?.method === 'POST')
      body = json({ cod: 1, ok: true, mensaje: 'Solicitud registrada.' })
    // Solo la Facultad de Ingeniería ofrece la propuesta del alumno.
    if (path === 'horarios_cursadas/carreras' && !url.includes('ra=ra-fi')) body = json({ cod: 1, carrera: [] })
    // El SIU de la Austral responde en ISO-8859-1.
    return new Response(Buffer.from(body, 'latin1'), {
      status: 200,
      headers: route?.contentType
        ? { 'content-type': route.contentType, 'content-disposition': 'attachment; filename="historia.pdf"' }
        : {}
    })
  }) as typeof fetch
  const warnings: string[] = []
  const siu = createRealSiu({
    baseUrl: BASE,
    session: 'cookie-de-prueba',
    personId: 'real-alumno',
    fallback: createMemorySiu(syntheticData, clock),
    clock,
    fetch: fakeFetch,
    ttlMs: options.ttlMs,
    writes: options.writes,
    warn: (m) => warnings.push(m)
  })
  return { siu, requests, warnings }
}

const SECTION = `real-bd2-bases-de-datos-inf-${'grado-2do-cuatrimestre-2026'}`

test('saca el HTML de cada pagelet de una página', () => {
  const found = pagelets(page({ uno: '<p>a</p>', dos: '<p>b</p>' }))
  assert.deepEqual(
    [...found.entries()],
    [
      ['uno', '<p>a</p>'],
      ['dos', '<p>b</p>']
    ]
  )
})

test('lee Mis inscripciones: materia y código, comisión, período, estado y el enlace a Moodle', () => {
  const rows = parseEnrollments(INSCRIPCIONES)
  assert.equal(rows.length, 2)
  assert.deepEqual(rows[0], {
    date: '2026-08-03T13:15:00.000Z',
    term: TERM,
    subjectName: 'Bases de Datos',
    subjectCode: 'BD2',
    section: 'Bases de Datos INF',
    location: 'Sede Pilar',
    status: 'Aceptada',
    moodleUrl: `${BASE}/inscripciones/curso_moodle/cursada/abc`
  })
  assert.equal(rows[1].moodleUrl, null)
})

test('lee la historia con las comillas y mayúsculas del SIU, con nota, resultado, fecha y su detalle', () => {
  const rows = parseHistory(HISTORIA)
  assert.deepEqual(
    rows.map((r) => [r.subjectCode, r.kind, r.result, r.grade, r.date?.slice(0, 10), r.detailId]),
    [
      ['BD2', 'encurso', 'Aprobado', null, '2026-08-03', '0'],
      ['PR1', 'regularidad', 'Aprobado', 7.5, '2025-07-20', '1'],
      ['PR1', 'examen', 'Aprobado', 8, '2025-08-05', '2'],
      ['OPT1', 'promocion', 'Promocionado', 9, '2025-12-01', '3'],
      ['SEM9', 'examen', 'Aprobado', 9, '2025-03-10', '4'],
      ['VUDEP01', 'examen', 'Aprobado', null, '2025-05-10', '5']
    ]
  )
})

test('lee el plan por módulos, la regla de horas de optativas y su botón «Verificar»', () => {
  const plan = parsePlan(PLAN)
  assert.equal(plan.programCode, 'IINF')
  assert.equal(plan.programName, 'Ingeniería en Informática')
  assert.equal(plan.planName, '(IINF/2019) IINF Plan 2019')
  assert.equal(plan.electiveHours, 192)
  assert.equal(plan.electivesElement, '9001')
  assert.deepEqual(plan.electivesCheck, { materia: '9001', regla: '116', parametros: 'p' })
  assert.deepEqual(
    plan.rows.map((r) => [r.code, r.module]),
    [
      ['PR1', '1er. Año'],
      ['BD2', '3er. Año'],
      ['PPS1', 'Otros Requisitos'],
      ['GFIEXTVU', 'Otros Requisitos']
    ]
  )
})

test('lee las horas que lleva el alumno del mensaje de la verificación', () => {
  assert.equal(parseVerifiedHours('Debe obtener 384 horas de actividades aprobadas. Lleva 112 horas'), 112)
  assert.equal(parseVerifiedHours('Debe obtener 384 horas de actividades aprobadas.'), null)
})

test('lee el cronograma por comisión', () => {
  const [group] = parseSchedule(CRONOGRAMA)
  assert.equal(group.subjectCode, 'BD2')
  assert.equal(group.section, 'Bases de Datos INF')
  assert.deepEqual(
    group.items.map((i) => [i.name, i.kind, i.date?.slice(0, 10)]),
    [
      ['Segundo Parcial', 'Parcial', '2026-11-25'],
      ['Recuperatorio', 'Parcial', '2026-12-02']
    ]
  )
})

test('lee Horarios de Cursadas: comisión, día, horas, aula y cupo de cada materia', () => {
  const [group] = parseCourseSchedules(HORARIOS)
  assert.equal(group.subjectCode, 'BD2')
  assert.deepEqual(group.rows[0], {
    section: 'Bases de Datos INF',
    day: 'Miercoles',
    start: '18:00',
    end: '20:00',
    classType: 'Teórico-Práctica',
    room: 'Aula 5 - Edificio B',
    capacity: 40
  })
})

test('lee la lista de Inscripción a Materias y las comisiones ofrecidas de cada una', () => {
  assert.deepEqual(parseOpenSubjects(LISTA_MATERIAS), [
    { name: 'Bases de Datos', code: 'BD2', url: `${BASE}/cursada/elegir_materia/bd2`, enrolled: true },
    { name: 'Ayudantía 6', code: 'VUBEAYU6', url: `${BASE}/cursada/elegir_materia/ayu6`, enrolled: false }
  ])
  assert.deepEqual(parseOfferedSections(COMISIONES_AYUDANTIA), [
    {
      heading: 'Ayudantía 6 - FI - Grado Anual - 2026',
      instances: 'Regularidad',
      modality: 'Presencial',
      capacity: 30,
      enrolled: 12,
      teachers: 'Ana Gómez (JTP)'
    }
  ])
})

test('separa la comisión del período con los períodos del SIU, aunque el nombre tenga « - »', () => {
  assert.deepEqual(splitSectionHeading('Ayudantía 6 - FI - Grado Anual - 2026', ['Grado Anual - 2026', TERM]), {
    name: 'Ayudantía 6 - FI',
    period: 'Grado Anual - 2026'
  })
})

test('ofrece las comisiones abiertas del SIU real, con cupo e inscriptos, y manda a inscribirse a su pantalla', async () => {
  const { siu } = build()
  const person = await siu.person('real-alumno')
  assert.ok(person.ok)
  const terms = await siu.terms()
  assert.ok(terms.ok)
  const annual = terms.value.find((t) => t.name === 'Grado Anual - 2026')
  assert.ok(annual)
  assert.equal(annual.enrollmentOpen, true, 'su inscripción está abierta: el SIU la ofrece hoy')
  assert.equal(annual.enrollmentStart, null, 'el SIU no informa cuándo abrió')
  assert.equal(annual.enrollmentEnd, null, 'ni cuándo cierra')
  const offer = await siu.sections({ schoolId: person.value.school.id, termId: annual.id })
  assert.ok(offer.ok)
  assert.deepEqual(
    offer.value.map((s) => [s.subjectId, s.name, s.capacity, s.enrolled, s.notes]),
    [['real-vubeayu6', 'Ayudantía 6 - FI', 30, 12, 'Docentes: Ana Gómez (JTP)']]
  )
  assert.equal(
    siu.selfServiceUrl({ kind: 'comision', sectionId: offer.value[0].id }),
    `${BASE}/cursada/elegir_materia/ayu6`
  )
})

test('responde por la persona real con lo que muestra su SIU, mandando la cookie de sesión', async () => {
  const { siu, requests } = build()
  const person = await siu.person('real-alumno')
  assert.ok(person.ok)
  assert.equal(`${person.value.names} ${person.value.surname}`, 'Lucía Fernández')
  assert.deepEqual(person.value.programs, [
    {
      id: 'real-iinf',
      name: 'Ingeniería en Informática',
      status: 'activa',
      progressPercent: 41.5,
      certificates: [{ name: 'Ingeniero en Informática', orientation: null, chosen: false, percent: 41.5, approved: 2 }]
    }
  ])
  const toSession = requests.filter((r) => !r.url.includes('/horarios_cursadas'))
  assert.ok(toSession.every((r) => r.cookie === `${SESSION_COOKIE}=cookie-de-prueba`))
  assert.ok(
    requests.filter((r) => r.url.includes('/horarios_cursadas')).every((r) => r.cookie === null),
    'lo público va sin la cookie'
  )

  const current = await siu.courseEnrollments('real-alumno')
  assert.ok(current.ok)
  assert.deepEqual(
    current.value.map((e) => e.sectionId),
    [SECTION],
    'la baja no es vigente'
  )
  const all = await siu.courseEnrollments('real-alumno', { historic: true })
  assert.ok(all.ok)
  assert.deepEqual(
    all.value.map((e) => e.status),
    ['aceptada', 'baja']
  )

  const provisional = await siu.provisionalResults('real-alumno')
  assert.ok(provisional.ok)
  assert.deepEqual(
    provisional.value.map((r) => [r.sectionId, r.grade]),
    [[SECTION, 6.5]]
  )
})

test('la facultad y las fechas de los períodos salen de lo que publica el SIU', async () => {
  const { siu } = build()
  const person = await siu.person('real-alumno')
  assert.ok(person.ok)
  assert.deepEqual(person.value.school, { id: 'real-facultad-de-ingenieria', name: 'Facultad de Ingeniería' })
  const terms = await siu.terms()
  assert.ok(terms.ok)
  const term = terms.value.find((t) => t.name === TERM)
  assert.equal(term?.start, '2026-06-22T03:00:00.000Z')
  assert.equal(term?.end, '2026-12-31T02:59:00.000Z')
})

test('cada comisión tiene sus días, horas, aulas y cupo de Horarios de Cursadas', async () => {
  const { siu } = build()
  const section = await siu.section(SECTION)
  assert.ok(section.ok)
  assert.deepEqual(section.value.schedule, [
    { day: 'miercoles', start: '18:00', end: '20:00' },
    { day: 'viernes', start: '14:00', end: '16:00' }
  ])
  assert.equal(section.value.location, 'Aula 5 - Edificio B / Lab 2 - Edificio B · Sede Pilar')
  assert.equal(section.value.capacity, 40)
})

test('las notas de parciales de las materias en curso salen del detalle de la historia', async () => {
  const { siu, requests } = build()
  const history = await siu.history('real-alumno')
  assert.ok(history.ok)
  const grades = history.value.filter((h) => h.type === 'evaluacion' && h.subjectId === 'real-bd2')
  assert.deepEqual(
    grades.map((g) => [g.subjectId, g.sectionId, g.grade, g.result]),
    [
      ['real-bd2', SECTION, 7, 'aprobado'],
      ['real-bd2', SECTION, 6, 'aprobado']
    ]
  )
  assert.ok(requests.some((r) => r.url.endsWith('/detalle_encurso') && r.body === 'id=0'))

  const schedule = await siu.assessments(SECTION)
  assert.ok(schedule.ok)
  const names = new Map(schedule.value.map((a) => [a.id, a.name]))
  assert.deepEqual(
    grades.map((g) => names.get(g.assessmentId ?? '')),
    ['Primer Parcial', 'Segundo Parcial'],
    'la nota va con su evaluación: la del cronograma, o una nueva si no está'
  )
  assert.deepEqual(
    schedule.value.map((a) => [a.name, a.kind]),
    [
      ['Segundo Parcial', 'parcial'],
      ['Recuperatorio', 'recuperatorio'],
      ['Primer Parcial', 'parcial']
    ]
  )
})

test('las notas de parciales de las materias cerradas salen del detalle de su regularidad', async () => {
  const { siu, requests } = build()
  const history = await siu.history('real-alumno')
  assert.ok(history.ok)
  const closed = history.value.filter((h) => h.type === 'evaluacion' && h.subjectId === 'real-pr1')
  assert.deepEqual(
    closed.map((g) => [g.grade, g.result, g.date.slice(0, 10)]),
    [[6, 'aprobado', '2025-05-15']]
  )
  assert.ok(requests.some((r) => r.url.endsWith('/detalle_cursada') && r.body === 'id=1'))
  const schedule = await siu.assessments(closed[0].sectionId ?? '')
  assert.ok(schedule.ok)
  assert.deepEqual(
    schedule.value.map((a) => a.name),
    ['Parcial 1']
  )
})

test('traduce la historia al vocabulario del puerto y deja afuera lo que está en curso', async () => {
  const { siu } = build()
  const history = await siu.history('real-alumno')
  assert.ok(history.ok)
  assert.deepEqual(
    history.value.filter((h) => h.type !== 'evaluacion').map((h) => [h.subjectId, h.type, h.result, h.grade]),
    [
      ['real-pr1', 'cursada', 'regular', 7.5],
      ['real-pr1', 'examen', 'aprobado', 8],
      ['real-opt1', 'promocion', 'promocionado', 9],
      ['real-sem9', 'examen', 'aprobado', 9],
      ['real-vudep01', 'examen', 'aprobado', null]
    ]
  )
})

test('le pone a cada actividad de vida universitaria los créditos del reporte', async () => {
  const { siu } = build()
  const activity = await siu.subject('real-vudep01')
  assert.ok(activity.ok)
  assert.equal(activity.value.credits, 1.5)
  const subject = await siu.subject('real-bd2')
  assert.ok(subject.ok)
  assert.equal(subject.value.credits, null)
})

test('las horas de cada optativa salen de las que el SIU dice que lleva el alumno', async () => {
  const { siu } = build()
  // Lleva 64 horas con una optativa aprobada de 10 créditos: 6.4 horas por crédito.
  const approved = await siu.subject('real-opt1')
  const other = await siu.subject('real-opt2')
  assert.ok(approved.ok && other.ok)
  assert.equal(approved.value.credits, 64)
  assert.equal(other.value.credits, 32)
})

test('arma el plan con lo cursado: optativas de su lista, vida universitaria de su reporte, y nada más', async () => {
  const { siu } = build()
  const plan = await siu.studyPlan('real-iinf')
  assert.ok(plan.ok)
  assert.equal(plan.value.electiveHoursRequired, 192)
  assert.equal(plan.value.electivesRequired, 0, 'el SIU pide horas, no una cantidad de optativas')
  assert.deepEqual(
    plan.value.subjects.map((s) => [s.subjectId, s.kind, s.year]),
    [
      ['real-pr1', 'obligatoria', 1],
      ['real-bd2', 'obligatoria', 3],
      ['real-pps1', 'obligatoria', null],
      ['real-gfiextvu', 'obligatoria', null],
      ['real-opt1', 'optativa', null],
      ['real-vudep01', 'vida-universitaria', null]
    ],
    'el seminario queda fuera del plan'
  )
})

test('el avance y los créditos de vida universitaria que pide el plan salen del SIU', async () => {
  const { siu } = build()
  const person = await siu.person('real-alumno')
  assert.ok(person.ok)
  assert.equal(person.value.programs[0].progressPercent, 41.5)
  const plan = await siu.studyPlan('real-iinf')
  assert.ok(plan.ok)
  assert.equal(plan.value.universityLifeCreditsRequired, 10)
})

test('el avance por certificado: una fila por título y orientación, y manda la orientación elegida', () => {
  const fila = (cert: string, ori: string, elegida: string, avance: string, aprobadas: string) =>
    `<tr><td>${cert}</td><td>${ori}</td><td>${elegida}</td><td>${avance}</td><td>${aprobadas}</td><td>7.50</td><td>7.80</td></tr>`
  const html = `<table class="table"><thead><tr><th>Certificado</th><th>Orientación</th><th>Ori. Elegida</th><th>% de Avance</th><th>Aprobadas</th><th>Promedio con aplazos</th><th>Promedio sin aplazos</th></tr></thead><tbody>${fila('Ingeniero en Informática', '', 'No', '40.25 %', '20')}${fila('Ingeniero en Informática', 'Ciencia de Datos', 'Sí', '52,5 %', '22')}${fila('Ingeniero en Informática', 'Sistemas Embebidos', 'No', '38 %', '19')}</tbody></table>`
  const certificates = parseCertificates(html)
  assert.deepEqual(
    certificates.map((c) => [c.orientation, c.chosen, c.percent, c.approved]),
    [
      [null, false, 40.25, 20],
      ['Ciencia de Datos', true, 52.5, 22],
      ['Sistemas Embebidos', false, 38, 19]
    ]
  )
  assert.equal(progressOf(certificates), 52.5, 'el de la orientación elegida')
  assert.equal(
    progressOf(certificates.map((c) => ({ ...c, chosen: false }))),
    40.25,
    'sin elegida, el de la primera fila'
  )
  assert.equal(progressOf([]), null)
})

test('Trámites: las solicitudes del SIU, qué constancias deja pedir y a dónde manda', async () => {
  const { siu } = build()
  const requests = await siu.certificateRequests?.('real-alumno')
  assert.ok(requests?.ok)
  assert.deepEqual(
    requests.value.map((r) => [r.type, r.status, r.copies, r.expiresAt?.slice(0, 10) ?? null, r.url]),
    [
      ['Certificado de Plan de Estudios', 'Impreso', 1, null, `${BASE}/solicitudes`],
      ['Constancia de Alumno Regular', 'Online', 1, '2026-11-23', `${BASE}/solicitudes/descargar/abc`]
    ]
  )
  assert.deepEqual(await siu.meetsCertificateConditions('real-alumno', 'alumno-regular'), { ok: true, value: true })
  assert.equal(
    siu.selfServiceUrl({ kind: 'constancia', type: 'alumno-regular' }, 'real-alumno'),
    `${BASE}/solicitudes/nueva_solicitud`
  )
  assert.notEqual(
    siu.selfServiceUrl({ kind: 'constancia', type: 'alumno-regular' }, TOMAS_SIU),
    `${BASE}/solicitudes/nueva_solicitud`,
    'la constancia de una persona de la demo sigue en la Autogestión simulada'
  )
})

test('Trámites: pide la constancia de alumno regular como «Guardar», sin pasarse de las copias que deja el SIU', async () => {
  const { siu, requests } = build({ writes: true })
  const request = { type: 'alumno-regular', copies: 1, presentTo: 'Empresa', notes: '' } as const
  assert.deepEqual(await siu.requestCertificate?.('real-alumno', request), {
    ok: true,
    value: { accepted: true, message: 'Solicitud registrada.' }
  })
  const post = requests.find((r) => r.url.endsWith('/solicitudes/nueva_solicitud') && r.body)
  assert.equal(
    post?.body,
    'constancia=1&copias=1&presentar=Empresa&observaciones=&formulario=34000240&formulario_campo=&formulario_valor='
  )
  const tooMany = await siu.requestCertificate?.('real-alumno', { ...request, copies: 5 })
  assert.deepEqual(tooMany, { ok: true, value: { accepted: false, message: 'El SIU deja pedir hasta 3 copias.' } })
  assert.deepEqual(await siu.requestCertificate?.('real-alumno', { ...request, type: 'examen-final' }), {
    ok: false,
    error: 'no-soportado'
  })
})

test('Trámites: sin escrituras no pide nada, y la historia se descarga como el PDF del SIU', async () => {
  const { siu } = build()
  const request = { type: 'alumno-regular', copies: 1, presentTo: 'Empresa', notes: '' } as const
  assert.deepEqual(await siu.requestCertificate?.('real-alumno', request), { ok: false, error: 'no-soportado' })
  const pdf = await siu.officialDocument?.('real-alumno', 'historia')
  assert.ok(pdf?.ok)
  assert.equal(pdf.value.contentType, 'application/pdf')
  assert.equal(pdf.value.filename, 'historia.pdf')
})

test('lee el SIU una sola vez por minuto, aunque se pidan muchas cosas', async () => {
  const { siu, requests } = build()
  await Promise.all([siu.person('real-alumno'), siu.history('real-alumno'), siu.courseEnrollments('real-alumno')])
  const afterFirst = requests.length
  await siu.studyPlan('real-iinf')
  await siu.section(SECTION)
  assert.equal(requests.length, afterFirst)
})

test('la huella cambia cuando el SIU muestra algo nuevo, y no cambia si no', async () => {
  const { siu } = build({ ttlMs: 0 })
  const before = await siu.version()
  const same = await siu.version()
  assert.ok(before.ok && same.ok)
  assert.equal(same.value, before.value)

  const original = ROUTES.actuacion_provisoria.body
  ROUTES.actuacion_provisoria.body = original.replace('6.50', '9.00')
  try {
    const after = await siu.version()
    assert.ok(after.ok)
    assert.notEqual(after.value, before.value, 'una nota nueva cambia la huella')
  } finally {
    ROUTES.actuacion_provisoria.body = original
  }
})

test('si el SIU deja de responder, sigue lo último leído un rato', async () => {
  const { siu, warnings } = build({ ttlMs: 0 })
  assert.ok((await siu.history('real-alumno')).ok)
  const original = ROUTES.inscripciones.body
  ROUTES.inscripciones.body = LOGIN
  try {
    const history = await siu.history('real-alumno')
    assert.ok(history.ok, 'lo último leído, no una pantalla vacía')
    assert.equal(warnings.length, 1, 'y avisa que la sesión venció')
  } finally {
    ROUTES.inscripciones.body = original
  }
})

test('las demás personas y los ids que no son reales siguen en el SIU de la demo', async () => {
  const { siu, requests } = build()
  const tomas = await siu.person(TOMAS_SIU)
  assert.ok(tomas.ok)
  assert.equal(tomas.value.surname, 'Aguirre')
  assert.ok((await siu.section('sec-pr1-fi-v')).ok)
  assert.equal(requests.length, 0, 'lo del simulado no lee el SIU')
  assert.equal((await siu.subject('real-no-existe')).ok, false)
})

test('toma el formulario de la comisión con su __csrf, y el de la baja', () => {
  assert.deepEqual(enrollFormIn(COMISIONES_AYUDANTIA, 'Ayudantía 6 - FI', 'Grado Anual - 2026'), {
    action: `${BASE}/cursada/inscribir`,
    fields: [
      ['materia', 'm-ayu6'],
      ['comision', 'c-ayu6-fi'],
      ['__csrf', 'csrf-fresco']
    ]
  })
  assert.equal(enrollFormIn(COMISIONES_AYUDANTIA, 'Otra comisión', 'Grado Anual - 2026'), null)
  assert.deepEqual(dropFormIn(COMISIONES_BASES_DE_DATOS), {
    action: `${BASE}/cursada/baja`,
    fields: [
      ['__csrf', 'csrf-baja'],
      ['materia', 'm-bd2'],
      ['inscripcion', 'i-bd2']
    ]
  })
})

test('con escrituras, inscribe en el SIU real como el botón «Inscribirse» y da el comprobante', async () => {
  const { siu, requests } = build({ writes: true })
  const person = await siu.person('real-alumno')
  assert.ok(person.ok)
  const offer = await siu.sections({ schoolId: person.value.school.id })
  assert.ok(offer.ok)
  const section = offer.value.find((s) => s.subjectId === 'real-vubeayu6')
  assert.ok(section)
  const target = { kind: 'comision', sectionId: section.id } as const
  const receipt = await siu.enroll('real-alumno', target)
  assert.ok(receipt.ok)
  assert.equal(receipt.value.transactionNumber, '5521')
  const post = requests.find((r) => r.url.endsWith('/cursada/inscribir'))
  assert.equal(post?.body, 'materia=m-ayu6&comision=c-ayu6-fi&__csrf=csrf-fresco')
  assert.equal(post?.cookie, `${SESSION_COOKIE}=cookie-de-prueba`)
})

test('con escrituras, da de baja con el formulario de la comisión inscripta', async () => {
  const { siu, requests } = build({ writes: true })
  const receipt = await siu.drop('real-alumno', { kind: 'comision', sectionId: SECTION })
  assert.ok(receipt.ok)
  assert.equal(receipt.value.transactionNumber, '5522')
  assert.equal(
    requests.find((r) => r.url.endsWith('/cursada/baja'))?.body,
    '__csrf=csrf-baja&materia=m-bd2&inscripcion=i-bd2'
  )
})

test('si el SIU rechaza la inscripción, dice por qué', async () => {
  const { siu } = build({ writes: true })
  const original = ROUTES['cursada/inscribir'].body
  ROUTES['cursada/inscribir'].body = json({ cod: -1, cont: 'La comisión no tiene cupo disponible.' })
  try {
    const person = await siu.person('real-alumno')
    assert.ok(person.ok)
    const offer = await siu.sections({ schoolId: person.value.school.id })
    assert.ok(offer.ok)
    const section = offer.value.find((x) => x.subjectId === 'real-vubeayu6')
    assert.ok(section)
    const result = await siu.enroll('real-alumno', { kind: 'comision', sectionId: section.id })
    assert.deepEqual(result, { ok: false, error: 'sin-cupo' })
  } finally {
    ROUTES['cursada/inscribir'].body = original
  }
})

test('una nota que aparece después de la primera lectura queda marcada como nueva', async () => {
  const { siu } = build({ ttlMs: 0 })
  const before = await siu.provisionalResults('real-alumno')
  assert.ok(before.ok)
  assert.equal(before.value[0].loadedAt, null, 'lo que ya estaba no tiene fecha de carga')
  const original = ROUTES.actuacion_provisoria.body
  ROUTES.actuacion_provisoria.body = original.replace('6.50', '9.00')
  try {
    const after = await siu.provisionalResults('real-alumno')
    assert.ok(after.ok)
    assert.equal(after.value[0].grade, 9)
    assert.equal(after.value[0].loadedAt, new Date(syntheticData.now).toISOString())
  } finally {
    ROUTES.actuacion_provisoria.body = original
  }
})

test('sin escrituras no inscribe ni da de baja a la persona real: manda a la Autogestión', async () => {
  const { siu } = build()
  const target = { kind: 'comision', sectionId: SECTION } as const
  assert.deepEqual(await siu.enroll('real-alumno', target), { ok: false, error: 'no-soportado' })
  assert.deepEqual(await siu.drop('real-alumno', target), { ok: false, error: 'no-soportado' })
  assert.equal(siu.selfServiceUrl(target), `${BASE}/cursada`)
  assert.equal(siu.capabilities.canEnroll, true, 'las personas sintéticas se siguen inscribiendo')
})

test('con la sesión vencida, lo de la persona real es una falla externa y avisa sin mostrar la cookie', async () => {
  const { siu, warnings } = build({ expired: true })
  assert.deepEqual(await siu.history('real-alumno'), { ok: false, error: 'falla-externa' })
  assert.equal(warnings.length, 1)
  assert.ok(!warnings[0].includes('cookie-de-prueba'))
  assert.ok((await siu.history(TOMAS_SIU)).ok)
})

test('la persona real aparece primera en el ingreso y se vincula por su id del SIU', async () => {
  const identity = withRealSubject(createMemoryIdentity(syntheticData), REAL_PERSON)
  const subjects = await identity.demoSubjects()
  assert.ok(subjects.ok)
  assert.equal(subjects.value[0].subject, 'real-alumno')
  assert.deepEqual(await identity.verify({ kind: 'demo', subject: 'real-alumno' }), {
    ok: true,
    value: REAL_PERSON.subject
  })

  const store = withRealPerson(createMemoryPeopleStore(syntheticData), REAL_PERSON)
  assert.deepEqual(await store.ownerOf('siu', 'real-alumno'), { ok: true, value: 'p-real' })
  assert.deepEqual(await store.ownerOf('identity', 'real-alumno'), { ok: true, value: 'p-real' })
  assert.deepEqual(await store.setAccount('p-real', 'discord', 'd-1'), { ok: true, value: null })
  assert.deepEqual(await store.accountsOf('p-real'), {
    ok: true,
    value: { siu: 'real-alumno', identity: 'real-alumno', discord: 'd-1' }
  })
})

test('HACKAI_SIU_REAL pide SIU_SESION y solo acepta si o no', () => {
  assert.throws(() => compose({ HACKAI_SIU_REAL: 'si' }), /SIU_SESION/)
  assert.throws(() => compose({ HACKAI_SIU_REAL: 'tal-vez' }), /HACKAI_SIU_REAL/)
  assert.doesNotThrow(() => compose({ HACKAI_SIU_REAL: 'si', SIU_SESION: 'x' }))
  assert.throws(
    () => compose({ HACKAI_SIU_REAL: 'si', SIU_SESION: 'x', HACKAI_SIU_ESCRITURAS: 'quizas' }),
    /HACKAI_SIU_ESCRITURAS/
  )
  assert.throws(
    () => compose({ HACKAI_SIU_REAL: 'si', SIU_SESION: 'x', HACKAI_SIU_REAL_SEGUNDOS: 'rápido' }),
    /HACKAI_SIU_REAL_SEGUNDOS/
  )
  assert.equal(compose({}).siuLive?.canConnect, true, 'por defecto se entra con la cuenta del SIU desde el ingreso')
  assert.equal(compose({ HACKAI_SIU_REAL_PUBLICO: 'no' }).siuLive, null, 'sin cuentas reales no hay nada al día')
  assert.equal(compose({}).siuLive?.writes, true, 'por defecto, las acciones van al SIU de verdad')
  assert.equal(compose({ HACKAI_SIU_ESCRITURAS: 'no' }).siuLive?.writes, false)
  assert.equal(compose({ HACKAI_SIU_REAL: 'si', SIU_SESION: 'x' }).siuLive?.isReal(REAL_PERSON.personId), true)
})

test('varias cuentas reales a la vez: cada una con sus ids, y una persona sin su sesión no existe', async () => {
  const clock = createFixedClock(syntheticData.now)
  const fakeFetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const path = String(input)
      .slice(BASE.length + 1)
      .split('?')[0]
      .replace(/\/$/, '')
    const route = ROUTES[path]
    if (path === 'solicitudes/nueva_solicitud' && init?.method === 'POST') return new Response('{}')
    return new Response(Buffer.from(route?.body ?? '', 'latin1'), { status: 200 })
  }) as typeof fetch
  const registry = createRealSiuRegistry({
    baseUrl: BASE,
    fallback: createMemorySiu(syntheticData, clock),
    clock,
    fetch: fakeFetch,
    warn: () => {}
  })
  registry.register('aaaaaaaaaaaa', 'sesion-a')
  registry.register('bbbbbbbbbbbb', 'sesion-b')
  const a = await registry.courseEnrollments(siuIdOf('aaaaaaaaaaaa'))
  const b = await registry.courseEnrollments(siuIdOf('bbbbbbbbbbbb'))
  assert.ok(a.ok && b.ok)
  assert.ok(a.value[0].sectionId.startsWith('real-aaaaaaaaaaaa-'))
  assert.ok(b.value[0].sectionId.startsWith('real-bbbbbbbbbbbb-'))
  assert.notEqual(a.value[0].sectionId, b.value[0].sectionId, 'la misma comisión, un id por cuenta')
  assert.ok((await registry.section(a.value[0].sectionId)).ok)
  const forA = await registry.terms(siuIdOf('aaaaaaaaaaaa'))
  assert.ok(forA.ok)
  assert.ok(forA.value.some((t) => t.id.startsWith('real-aaaaaaaaaaaa-')))
  assert.ok(!forA.value.some((t) => t.id.startsWith('real-bbbbbbbbbbbb-')), 'una cuenta no ve los períodos de otra')
  const forDemo = await registry.terms(TOMAS_SIU)
  assert.ok(forDemo.ok && !forDemo.value.some((t) => t.id.startsWith('real-')), 'ni las personas de la demo')
  assert.deepEqual(await registry.person(siuIdOf('cccccccccccc')), { ok: false, error: 'no-encontrado' })
  assert.ok((await registry.person(TOMAS_SIU)).ok, 'las personas de la demo siguen')
})

test('Personas reconoce a cada cuenta real por su clave', async () => {
  const store = withRealPeople(createMemoryPeopleStore(syntheticData))
  assert.deepEqual(await store.accountsOf(realPersonId('aaaaaaaaaaaa')), {
    ok: true,
    value: { siu: 'real-aaaaaaaaaaaa', identity: 'siu-aaaaaaaaaaaa' }
  })
  assert.deepEqual(await store.ownerOf('siu', 'real-aaaaaaaaaaaa'), { ok: true, value: 'p-siu-aaaaaaaaaaaa' })
  assert.ok((await store.accountsOf('p-taguirre')).ok)
})

test('la sesión del SIU viaja cifrada y la persona se reconoce sin guardar su documento', () => {
  process.env.SESSION_SECRET ??= 'clave-de-prueba'
  const sealed = sealSiuSession({ key: 'aaaaaaaaaaaa', session: 'sesion-secreta' })
  assert.ok(!sealed.includes('sesion-secreta'))
  assert.deepEqual(openSiuSession(sealed), { key: 'aaaaaaaaaaaa', session: 'sesion-secreta' })
  assert.equal(openSiuSession(`${sealed.slice(0, -2)}xx`), null, 'una cookie tocada no abre')
  assert.equal(openSiuSession(undefined), null)
  assert.match(personKey('30111222'), /^[a-f0-9]{12}$/)
  assert.equal(personKey('30111222'), personKey('30111222'))
  assert.notEqual(personKey('30111222'), personKey('30111223'))
})

test('lee Reportes > Inasistencias: comisión, fecha, cantidad (con decimales) y si está justificada', () => {
  assert.deepEqual(parseAbsences(INASISTENCIAS), [
    {
      subjectCode: 'BD2',
      subjectName: 'Bases de Datos',
      section: 'Bases de Datos INF',
      rows: [
        { date: '2026-09-02T03:00:00.000Z', classType: 'Teórico-Práctica', amount: 1, justified: false },
        { date: '2026-09-16T03:00:00.000Z', classType: 'Teórico-Práctica', amount: 0.5, justified: true }
      ]
    }
  ])
})

test('lee las asignaciones del alumno y deja afuera las que no tienen día o fechas', () => {
  assert.deepEqual(parseAssignments(json(ASIGNACIONES)), [
    { subjectCode: 'BD2', section: 'Bases de Datos INF', weekday: 4, from: '2026-08-03', to: '2026-11-13' },
    { subjectCode: 'BD2', section: 'Bases de Datos INF', weekday: 6, from: '2026-08-03', to: '2026-11-13' }
  ])
  assert.deepEqual(parseAssignments('no es json'), [])
})

test('cuenta cuántas veces cae un día de la semana entre dos fechas', () => {
  // Del lunes 3/8 al viernes 13/11 de 2026: 15 miércoles (4) y 15 viernes (6).
  assert.equal(weekdaysBetween('2026-08-03', '2026-11-13', 4), 15)
  assert.equal(weekdaysBetween('2026-08-03', '2026-11-13', 6), 15)
  assert.equal(weekdaysBetween('2026-08-03', '2026-08-03', 2), 1)
  assert.equal(weekdaysBetween('2026-08-04', '2026-08-03', 2), 0)
})

test('las faltas de la persona real salen del SIU, y las clases de la comisión, de sus asignaciones', async () => {
  const { siu } = build()
  const report = await siu.absences('real-alumno')
  assert.ok(report.ok)
  assert.deepEqual(
    report.value.absences.map((a) => [a.sectionId, a.date.slice(0, 10), a.amount, a.justified]),
    [
      [SECTION, '2026-09-02', 1, false],
      [SECTION, '2026-09-16', 0.5, true]
    ]
  )
  assert.deepEqual(report.value.limits, [], 'el SIU no da el máximo')
  const section = await siu.section(SECTION)
  assert.ok(section.ok)
  assert.equal(section.value.classCount, 30, 'miércoles y viernes, 15 de cada uno')
})

test('la sesión de HackAI de una cuenta real solo vale con la sesión del SIU de esa persona', () => {
  process.env.SESSION_SECRET ??= 'clave-de-prueba'
  const mine = sealSiuSession({ key: 'aaaaaaaaaaaa', session: 'sesion-a' })
  const other = sealSiuSession({ key: 'bbbbbbbbbbbb', session: 'sesion-b' })
  assert.equal(siuSessionOf('p-taguirre', undefined), 'demo', 'las personas de la demo no necesitan nada más')
  assert.deepEqual(siuSessionOf('p-siu-aaaaaaaaaaaa', mine), { key: 'aaaaaaaaaaaa', session: 'sesion-a' })
  assert.equal(siuSessionOf('p-siu-aaaaaaaaaaaa', undefined), null, 'sin la cookie del SIU, no hay sesión')
  assert.equal(siuSessionOf('p-siu-aaaaaaaaaaaa', other), null, 'con la de otra persona, tampoco')
})

test('la sesión pegada en el ingreso se acepta sola o con el nombre de la cookie, y nada más', () => {
  assert.equal(siuSessionFromInput('  abc123def456ghi  '), 'abc123def456ghi')
  assert.equal(siuSessionFromInput('siu_sess__portal_ua_UA=abc123def456ghi; Path=/portal'), 'abc123def456ghi')
  assert.equal(siuSessionFromInput('<script>'), null)
  assert.equal(siuSessionFromInput(''), null)
  assert.equal(siuSessionFromInput(null), null)
})

// La acción de /entrar-con-siu (app/actions/siu-connect.ts) y la descarga del PDF oficial
// (app/(app)/tramites/[documento]/route.ts) leen cookies y encabezados del pedido de Next.js, que no corre en
// node:test. Lo que deciden está probado acá: la sesión pegada (siuSessionFromInput), el reconocimiento de la
// persona (personKey, signIn del registro), la sesión de cada pedido (siuSessionOf) y el PDF (officialDocument).
