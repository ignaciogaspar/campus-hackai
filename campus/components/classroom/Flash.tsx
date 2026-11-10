/** Avisos que vuelven en ?aviso= / ?error= después de una action. */
const AVISOS: Record<string, string> = {
  proyectado: 'Listo: se está mostrando en la clase en vivo.',
  resultado: 'Guardamos el resultado del sorteo.',
  ronda: 'Empezó una ronda nueva: todos vuelven a ser sorteables.',
  registrado: 'Participación registrada.',
  borrado: 'Registro borrado.',
}
const ERRORES: Record<string, string> = {
  'sin-vivo': 'No hay ninguna clase en vivo. Iniciá la clase desde el tablero y volvé a probar.',
  'sin-candidatos': 'Nadie cumple ese filtro.',
  'ronda-agotada': 'Ya salieron todos los que cumplen el filtro en esta ronda. Reiniciá la ronda o cambiá el filtro.',
  registro: 'Elegí un alumno y un tipo de participación.',
  resultado: 'Resultado inválido.',
}

export function Flash({ aviso, error }: { aviso?: string; error?: string }) {
  if (error && ERRORES[error]) return <div className="alerta alerta-aviso" role="alert">{ERRORES[error]}</div>
  if (aviso && AVISOS[aviso]) return <div className="alerta alerta-ok" role="status">{AVISOS[aviso]}</div>
  return null
}
