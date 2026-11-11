/* Consultas de Análisis Matemático I, Comisión A, para las tres variantes.
   Todo inventado. Se suma a window.HK de ../../mocks/data.js. */
window.CONSULTAS = {
  canales: [
    { id: 'avisos', nombre: 'avisos', titulo: 'Avisos', icono: 'megaphone', alcance: 'Comisión A', noLeidos: 1 },
    { id: 'consultas', nombre: 'consultas', titulo: 'Consultas', icono: 'chat', alcance: 'Comisión A', noLeidos: 2 },
    { id: 'material', nombre: 'material', titulo: 'Material', icono: 'file', alcance: 'Toda la materia', noLeidos: 1 },
    { id: 'generales', nombre: 'consultas-generales', titulo: 'Generales', icono: 'hash', alcance: 'Toda la materia', noLeidos: 0 },
    { id: 'parciales', nombre: 'parciales-viejos', titulo: 'Parciales viejos', icono: 'hash', alcance: 'Toda la materia', noLeidos: 0 },
  ],
  lista: [
    { autor: 'Lucía Benítez', iniciales: 'LB', hace: 'hoy 11:41', texto: '¿El recuperatorio del 25 es del primer parcial, del segundo o de los dos?', resuelta: false, respuestas: 0, nueva: true },
    { autor: 'fran.99', externo: true, iniciales: 'F', hace: 'hoy 11:58', texto: 'Para la guía 3, ¿el ejercicio 14 se resuelve con L’Hôpital o sin?', resuelta: false, respuestas: 1, nueva: true,
      ultima: { autor: 'Joaquín Escobar', texto: 'Yo lo hice sin, factorizando arriba.' } },
    { autor: 'Tomás Aguirre', iniciales: 'TA', hace: 'hoy 10:52', texto: '¿Entran integrales en el segundo parcial?', resuelta: true, respuestas: 1,
      ultima: { autor: 'Mariana Ledesma', docente: true, texto: 'No, llega hasta derivadas y sus aplicaciones.' } },
    { autor: 'Joaquín Escobar', iniciales: 'JE', hace: 'lun 9/11', texto: '¿Se puede usar calculadora científica en el parcial?', resuelta: true, respuestas: 2,
      ultima: { autor: 'Julieta Romero', docente: true, texto: 'Sí, cualquiera que no sea programable.' } },
    { autor: 'Lucía Benítez', iniciales: 'LB', hace: 'jue 5/11', texto: 'En el ejercicio 7 de la guía 2, ¿el límite da 3/4 o -3/4?', resuelta: true, respuestas: 3,
      ultima: { autor: 'Mariana Ledesma', docente: true, texto: 'Da -3/4: ojo con el signo al sacar factor común.' } },
  ],
}
