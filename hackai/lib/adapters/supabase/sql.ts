/* Literales de SQL para los seeds que se generan desde el set sintético
   (siu_seed.sql, people_seed.sql). Cada función devuelve el valor ya escrito
   como SQL, con las comillas escapadas. */

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

export function upsert(table: string, key: string[], rows: Record<string, Sql>[]): Sql {
  if (!rows.length) return `-- ${table}: sin filas\n`
  const columns = Object.keys(rows[0])
  const values = rows.map((row) => `  (${columns.map((c) => row[c]).join(', ')})`).join(',\n')
  const updates = columns.filter((c) => !key.includes(c)).map((c) => `${c} = excluded.${c}`).join(', ')
  return `insert into ${table} (${columns.join(', ')}) values\n${values}\non conflict (${key.join(', ')}) do update set ${updates};\n`
}
