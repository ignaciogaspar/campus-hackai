/* Cómo se escriben las fechas y las notas en Académico. Las fechas van en la
   hora de Buenos Aires, como las muestra el SIU. */

const TIME_ZONE = 'America/Argentina/Buenos_Aires'

/** «lun, 21 sep»: la fecha de un parcial. */
export function gradeDate(date: string): string {
  return new Date(date).toLocaleDateString('es-AR', {
    timeZone: TIME_ZONE,
    weekday: 'short',
    day: 'numeric',
    month: 'short'
  })
}

/** «dic 2025»: cuándo se aprobó una materia. */
export function approvalDate(date: string): string {
  return new Date(date).toLocaleDateString('es-AR', { timeZone: TIME_ZONE, month: 'short', year: 'numeric' })
}

/** «8,5»: el promedio con coma decimal y sin ceros de más. */
export function average(value: number): string {
  return value.toLocaleString('es-AR', { maximumFractionDigits: 2 })
}
