import type { McpCaller } from './tokens'

/* Tipos y helpers de las herramientas MCP (sin I/O). */

export type JsonSchema = Record<string, unknown>

export interface ToolContext {
  caller: McpCaller
  /** Origen público del campus (https://host), para armar links. */
  origin: string
}

export interface ToolDef {
  name: string
  title: string
  description: string
  inputSchema: JsonSchema
  /** true = solo lee (annotations.readOnlyHint). */
  readOnly?: boolean
  run: (args: Record<string, unknown>, ctx: ToolContext) => Promise<unknown>
}

/** Error de uso de la herramienta: vuelve al cliente como `isError: true` con este texto. */
export class ToolError extends Error {}

export function str(args: Record<string, unknown>, key: string, opts: { required: true; max?: number }): string
export function str(args: Record<string, unknown>, key: string, opts?: { required?: false; max?: number }): string | undefined
export function str(args: Record<string, unknown>, key: string, opts: { required?: boolean; max?: number } = {}): string | undefined {
  const v = args[key]
  if (v === undefined || v === null || v === '') {
    if (opts.required) throw new ToolError(`Falta el parámetro "${key}".`)
    return undefined
  }
  if (typeof v !== 'string') throw new ToolError(`"${key}" tiene que ser texto.`)
  if (opts.max && v.length > opts.max) throw new ToolError(`"${key}" supera los ${opts.max} caracteres.`)
  return v
}

export function int(args: Record<string, unknown>, key: string, opts: { required?: boolean; min?: number; max?: number } = {}): number | undefined {
  const v = args[key]
  if (v === undefined || v === null || v === '') {
    if (opts.required) throw new ToolError(`Falta el parámetro "${key}".`)
    return undefined
  }
  const n = typeof v === 'string' ? Number(v) : v
  if (typeof n !== 'number' || !Number.isInteger(n)) throw new ToolError(`"${key}" tiene que ser un entero.`)
  if (opts.min !== undefined && n < opts.min) throw new ToolError(`"${key}" tiene que ser ≥ ${opts.min}.`)
  if (opts.max !== undefined && n > opts.max) throw new ToolError(`"${key}" tiene que ser ≤ ${opts.max}.`)
  return n
}

export function bool(args: Record<string, unknown>, key: string): boolean | undefined {
  const v = args[key]
  if (v === undefined || v === null) return undefined
  if (typeof v === 'boolean') return v
  if (v === 'true') return true
  if (v === 'false') return false
  throw new ToolError(`"${key}" tiene que ser true o false.`)
}

export function strList(args: Record<string, unknown>, key: string): string[] | undefined {
  const v = args[key]
  if (v === undefined || v === null) return undefined
  if (!Array.isArray(v) || v.some((x) => typeof x !== 'string')) throw new ToolError(`"${key}" tiene que ser una lista de textos.`)
  return v as string[]
}

/** Esquema de objeto con `required`. */
export function obj(properties: Record<string, JsonSchema>, required: string[] = []): JsonSchema {
  return { type: 'object', properties, required, additionalProperties: false }
}
