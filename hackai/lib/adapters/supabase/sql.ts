/* Piezas para escribir como SQL los seeds que salen del set sintético:
   literales y un insert que pisa la fila si ya existe. Las usan
   lib/adapters/siu-simulado/seed.ts, lib/adapters/moodle-simulado/seed.ts y
   lib/adapters/supabase/people-seed.ts. */

/** Un valor ya escrito como literal de SQL. */
export type Sql = string

export function text(value: string | null): Sql {
  return value === null ? 'null' : `'${value.replace(/'/g, "''")}'`
}

export function num(value: number | null): Sql {
  return value === null ? 'null' : String(value)
}

export function bool(value: boolean): Sql {
  return value ? 'true' : 'false'
}

export function json(value: unknown): Sql {
  return `${text(JSON.stringify(value))}::jsonb`
}

export function textArray(values: string[]): Sql {
  return values.length ? `array[${values.map(text).join(', ')}]::text[]` : `'{}'::text[]`
}

function insertInto(table: string, rows: Record<string, Sql>[]): { columns: string[]; head: Sql } {
  const columns = Object.keys(rows[0])
  const values = rows.map((row) => `  (${columns.map((c) => row[c]).join(', ')})`).join(',\n')
  return { columns, head: `insert into ${table} (${columns.join(', ')}) values\n${values}` }
}

export function upsert(table: string, key: string[], rows: Record<string, Sql>[]): Sql {
  if (!rows.length) return `-- ${table}: sin filas\n`
  const { columns, head } = insertInto(table, rows)
  const updates = columns
    .filter((c) => !key.includes(c))
    .map((c) => `${c} = excluded.${c}`)
    .join(', ')
  return `${head}\non conflict (${key.join(', ')}) do update set ${updates};\n`
}

/** Un insert que deja como está la fila que ya existe, choque con la clave
    que choque. */
export function insertMissing(table: string, rows: Record<string, Sql>[]): Sql {
  if (!rows.length) return `-- ${table}: sin filas\n`
  return `${insertInto(table, rows).head}\non conflict do nothing;\n`
}
