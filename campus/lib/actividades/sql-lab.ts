/* ============================================================
   Laboratorio de SQL (J4). Puro: genera la base de ventas de una
   distribuidora inventada (misma semilla para todos) y define los
   8 ejercicios con su consulta de referencia. La verificación corre
   en el navegador (sql.js): se compara el resultado del alumno con
   el de la referencia.
   ============================================================ */
import { rng } from './types'

export const SQL_LAB_SEED = 20251124

export interface SqlExercise {
  id: string
  title: string
  prompt: string
  hint: string
  solution: string
  /** El orden de las filas importa. */
  ordered: boolean
}

export const SQL_EXERCISES: SqlExercise[] = [
  {
    id: 'e1',
    title: 'Contar',
    prompt: '¿Cuántas ventas (filas) hay en total en la tabla ventas?',
    hint: 'SELECT COUNT(*) FROM …',
    solution: 'SELECT COUNT(*) FROM ventas',
    ordered: false,
  },
  {
    id: 'e2',
    title: 'Filtrar y ordenar',
    prompt: 'Listá nombre y precio_lista de los productos de la categoría «Bebidas», del más caro al más barato.',
    hint: 'WHERE categoria = \'Bebidas\' y ORDER BY … DESC',
    solution: "SELECT nombre, precio_lista FROM productos WHERE categoria = 'Bebidas' ORDER BY precio_lista DESC",
    ordered: true,
  },
  {
    id: 'e3',
    title: 'Agrupar',
    prompt: '¿Cuántos clientes hay en cada segmento? Dos columnas: segmento y cantidad.',
    hint: 'GROUP BY segmento',
    solution: 'SELECT segmento, COUNT(*) FROM clientes GROUP BY segmento',
    ordered: false,
  },
  {
    id: 'e4',
    title: 'Facturación por mes',
    prompt: 'Facturación por mes de 2025, ordenada por mes. La facturación de una venta es cantidad × precio_unitario × (1 − descuento). Dos columnas: el mes como \'2025-01\' y la facturación redondeada a 2 decimales.',
    hint: "substr(fecha, 1, 7) da el mes; ROUND(SUM(…), 2)",
    solution: 'SELECT substr(fecha, 1, 7) AS mes, ROUND(SUM(cantidad * precio_unitario * (1 - descuento)), 2) AS facturacion FROM ventas GROUP BY mes ORDER BY mes',
    ordered: true,
  },
  {
    id: 'e5',
    title: 'Los cinco que más compran',
    prompt: 'Los 5 clientes que más facturaron en el año: nombre del cliente y facturación redondeada a 2 decimales, de mayor a menor.',
    hint: 'JOIN clientes ON clientes.id = ventas.cliente_id … ORDER BY … DESC LIMIT 5',
    solution: 'SELECT c.nombre, ROUND(SUM(v.cantidad * v.precio_unitario * (1 - v.descuento)), 2) AS facturacion FROM ventas v JOIN clientes c ON c.id = v.cliente_id GROUP BY c.id ORDER BY facturacion DESC LIMIT 5',
    ordered: true,
  },
  {
    id: 'e6',
    title: 'Por vendedor',
    prompt: 'Facturación por vendedor: nombre del vendedor, su zona y facturación redondeada a 2 decimales, de mayor a menor.',
    hint: 'Igual que el anterior pero con la tabla vendedores.',
    solution: 'SELECT ve.nombre, ve.zona, ROUND(SUM(v.cantidad * v.precio_unitario * (1 - v.descuento)), 2) AS facturacion FROM ventas v JOIN vendedores ve ON ve.id = v.vendedor_id GROUP BY ve.id ORDER BY facturacion DESC',
    ordered: true,
  },
  {
    id: 'e7',
    title: 'Margen por categoría',
    prompt: 'Margen bruto por categoría de producto: lo facturado menos el costo (cantidad × costo). Dos columnas: categoría y margen redondeado a 2 decimales, de mayor a menor.',
    hint: 'JOIN productos; SUM(cantidad * (precio_unitario * (1 - descuento) - costo))',
    solution: 'SELECT p.categoria, ROUND(SUM(v.cantidad * (v.precio_unitario * (1 - v.descuento) - p.costo)), 2) AS margen FROM ventas v JOIN productos p ON p.id = v.producto_id GROUP BY p.categoria ORDER BY margen DESC',
    ordered: true,
  },
  {
    id: 'e8',
    title: 'Los que dejaron de comprar',
    prompt: 'Clientes que compraron en el primer semestre pero no compraron nada desde el 1 de julio de 2025. Una columna: nombre, ordenado alfabéticamente.',
    hint: "NOT IN (SELECT cliente_id FROM ventas WHERE fecha >= '2025-07-01')",
    solution: "SELECT nombre FROM clientes WHERE id IN (SELECT cliente_id FROM ventas WHERE fecha < '2025-07-01') AND id NOT IN (SELECT cliente_id FROM ventas WHERE fecha >= '2025-07-01') ORDER BY nombre",
    ordered: true,
  },
]

export const SQL_SCHEMA_DOC = `ventas(id, fecha 'AAAA-MM-DD', cliente_id, vendedor_id, producto_id, cantidad, precio_unitario, descuento 0–0,10)
clientes(id, nombre, provincia, segmento, fecha_alta)
productos(id, nombre, categoria, precio_lista, costo)
vendedores(id, nombre, zona)`

const ZONAS = ['AMBA Norte', 'AMBA Sur', 'Centro', 'Cuyo', 'Litoral', 'NOA']
const VENDEDORES = ['Lucía Ferreyra', 'Martín Ocampo', 'Sofía Benítez', 'Diego Arrieta', 'Carla Quiroga', 'Javier Sosa']
const PROVINCIAS = ['Buenos Aires', 'CABA', 'Córdoba', 'Santa Fe', 'Mendoza', 'Tucumán', 'Entre Ríos', 'Salta']
const SEGMENTOS = ['Mayorista', 'Supermercado', 'Almacén', 'Gastronomía']
const PREFIJOS = ['Almacén', 'Autoservicio', 'Distribuidora', 'Supermercado', 'Bar', 'Restó', 'Despensa', 'Mayorista']
const NOMBRES = ['Don Tito', 'La Esquina', 'El Sol', 'San Cayetano', 'Los Andes', 'Del Parque', 'La Estación', 'Mi Barrio', 'El Trébol', 'La Colonia', 'Santa Rita', 'Las Heras', 'El Puerto', 'Doña Rosa', 'Del Centro']
const PRODUCTOS: Array<[string, string, number]> = [
  ['Agua mineral 2 L', 'Bebidas', 1200], ['Gaseosa cola 2,25 L', 'Bebidas', 2900], ['Jugo de naranja 1 L', 'Bebidas', 1800],
  ['Cerveza lata 473 ml', 'Bebidas', 1500], ['Soda sifón 2 L', 'Bebidas', 900], ['Vino tinto 750 ml', 'Bebidas', 4800],
  ['Yerba mate 1 kg', 'Almacén', 4300], ['Arroz largo fino 1 kg', 'Almacén', 1700], ['Fideos secos 500 g', 'Almacén', 1100],
  ['Aceite de girasol 1,5 L', 'Almacén', 3600], ['Harina 000 1 kg', 'Almacén', 950], ['Azúcar 1 kg', 'Almacén', 1300],
  ['Lavandina 2 L', 'Limpieza', 1400], ['Detergente 750 ml', 'Limpieza', 1900], ['Jabón en polvo 3 kg', 'Limpieza', 7800],
  ['Papel higiénico x4', 'Limpieza', 2600], ['Desodorante de ambiente', 'Limpieza', 2200], ['Esponja x3', 'Limpieza', 800],
  ['Leche entera 1 L', 'Lácteos', 1350], ['Yogur bebible 1 L', 'Lácteos', 2100], ['Queso cremoso 1 kg', 'Lácteos', 8900],
  ['Manteca 200 g', 'Lácteos', 2400], ['Dulce de leche 400 g', 'Lácteos', 2700], ['Crema de leche 200 ml', 'Lácteos', 1600],
]

function q(s: string): string {
  return `'${s.replace(/'/g, "''")}'`
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** SQL completo (CREATE + INSERT) de la base del laboratorio. Determinístico. */
export function buildSalesDatabaseSql(seed = SQL_LAB_SEED): string {
  const rand = rng(seed)
  const pick = <T,>(list: T[]) => list[Math.floor(rand() * list.length)]
  const out: string[] = [
    'CREATE TABLE vendedores (id INTEGER PRIMARY KEY, nombre TEXT NOT NULL, zona TEXT NOT NULL);',
    'CREATE TABLE clientes (id INTEGER PRIMARY KEY, nombre TEXT NOT NULL, provincia TEXT NOT NULL, segmento TEXT NOT NULL, fecha_alta TEXT NOT NULL);',
    'CREATE TABLE productos (id INTEGER PRIMARY KEY, nombre TEXT NOT NULL, categoria TEXT NOT NULL, precio_lista REAL NOT NULL, costo REAL NOT NULL);',
    'CREATE TABLE ventas (id INTEGER PRIMARY KEY, fecha TEXT NOT NULL, cliente_id INTEGER NOT NULL REFERENCES clientes(id), vendedor_id INTEGER NOT NULL REFERENCES vendedores(id), producto_id INTEGER NOT NULL REFERENCES productos(id), cantidad INTEGER NOT NULL, precio_unitario REAL NOT NULL, descuento REAL NOT NULL);',
    'BEGIN;',
  ]
  VENDEDORES.forEach((n, i) => out.push(`INSERT INTO vendedores VALUES (${i + 1}, ${q(n)}, ${q(ZONAS[i])});`))

  const usados = new Set<string>()
  const clientes: Array<{ id: number; segmento: string; churn: boolean; vendedor: number }> = []
  for (let id = 1; id <= 60; id++) {
    let nombre = ''
    do { nombre = `${pick(PREFIJOS)} ${pick(NOMBRES)}` } while (usados.has(nombre))
    usados.add(nombre)
    const segmento = pick(SEGMENTOS)
    const alta = `20${pick(['19', '20', '21', '22', '23', '24'])}-${pad(1 + Math.floor(rand() * 12))}-${pad(1 + Math.floor(rand() * 28))}`
    clientes.push({ id, segmento, churn: id % 10 === 7, vendedor: 1 + Math.floor(rand() * VENDEDORES.length) })
    out.push(`INSERT INTO clientes VALUES (${id}, ${q(nombre)}, ${q(pick(PROVINCIAS))}, ${q(segmento)}, ${q(alta)});`)
  }

  PRODUCTOS.forEach(([nombre, cat, precio], i) => {
    const margen = 0.18 + rand() * 0.22
    out.push(`INSERT INTO productos VALUES (${i + 1}, ${q(nombre)}, ${q(cat)}, ${precio}, ${Math.round(precio * (1 - margen))});`)
  })

  const peso: Record<string, number> = { Mayorista: 3, Supermercado: 2, Almacén: 1, Gastronomía: 1.5 }
  for (let id = 1; id <= 1800; id++) {
    const c = pick(clientes)
    const maxMonth = c.churn ? 6 : 12
    const month = 1 + Math.floor(rand() * maxMonth)
    const fecha = `2025-${pad(month)}-${pad(1 + Math.floor(rand() * 28))}`
    const prod = 1 + Math.floor(rand() * PRODUCTOS.length)
    const lista = PRODUCTOS[prod - 1][2]
    const cantidad = Math.max(1, Math.round((1 + rand() * 24) * peso[c.segmento]))
    const precio = Math.round(lista * (0.92 + rand() * 0.12) * 100) / 100
    const descuento = cantidad > 40 ? 0.1 : cantidad > 20 ? 0.05 : 0
    // El vendedor es el de la cuenta casi siempre; a veces atiende otro.
    const vendedor = rand() < 0.85 ? c.vendedor : 1 + Math.floor(rand() * VENDEDORES.length)
    out.push(`INSERT INTO ventas VALUES (${id}, ${q(fecha)}, ${c.id}, ${vendedor}, ${prod}, ${cantidad}, ${precio}, ${descuento});`)
  }
  out.push('COMMIT;')
  return out.join('\n')
}

export type SqlValue = string | number | null | Uint8Array
export interface SqlResult { columns: string[]; values: SqlValue[][] }

function norm(v: SqlValue): string {
  if (v === null) return '∅'
  if (typeof v === 'number') return (Math.round(v * 100) / 100).toFixed(2)
  if (v instanceof Uint8Array) return `blob:${v.length}`
  const n = Number(v)
  return v.trim() !== '' && Number.isFinite(n) ? (Math.round(n * 100) / 100).toFixed(2) : v.trim()
}

/** Compara el resultado del alumno con el de referencia (sin mirar nombres de columnas). */
export function compareResults(got: SqlResult | null, expected: SqlResult, ordered: boolean): { ok: boolean; reason?: string } {
  if (!got) return { ok: false, reason: 'La consulta no devolvió filas.' }
  if (got.columns.length !== expected.columns.length) return { ok: false, reason: `Devolviste ${got.columns.length} columnas y se esperaban ${expected.columns.length}.` }
  if (got.values.length !== expected.values.length) return { ok: false, reason: `Devolviste ${got.values.length} filas y se esperaban ${expected.values.length}.` }
  const a = got.values.map((r) => r.map(norm).join('\u0001'))
  const b = expected.values.map((r) => r.map(norm).join('\u0001'))
  if (ordered) {
    const i = a.findIndex((row, k) => row !== b[k])
    if (i === -1) return { ok: true }
    const sameSet = [...a].sort().join('\n') === [...b].sort().join('\n')
    return { ok: false, reason: sameSet ? 'Están las filas correctas pero en otro orden.' : `La fila ${i + 1} no coincide.` }
  }
  const sa = [...a].sort().join('\n')
  const sb = [...b].sort().join('\n')
  return sa === sb ? { ok: true } : { ok: false, reason: 'Los valores no coinciden con los esperados.' }
}
