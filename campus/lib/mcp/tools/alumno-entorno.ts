import 'server-only'
import { COURSE_ID } from '@/lib/db'
import { organizationGaps } from '@/lib/organizacion/types'
import { ENTREGABLES } from '@/lib/organizacion/entregables'
import { getOrganization, recordEnvironmentCheck } from '@/lib/organizacion/store'
import { obj, str, ToolError, type ToolDef } from '../types'

/* Herramientas MCP del alumno para el bloque Awareness:
   - hola_campus: verificación automática del entorno (marca B1 como entregado con evidencia).
   - mi_organizacion: la organización real del alumno, para que Claude Code construya sobre ella.
   Solo leen y escriben datos propios. */

const ORG_URL = '/campus/organizacion'

const holaCampus: ToolDef = {
  name: 'hola_campus',
  title: 'Decile hola al campus',
  description:
    'Verifica que el entorno del alumno funciona (Claude Code conectado al campus con su token) y lo registra como evidencia del entregable B1. ' +
    'Usala cuando el alumno diga "decile hola al campus" o algo parecido. Antes de llamarla, si el alumno está de acuerdo, juntá estos datos corriendo comandos en su terminal ' +
    '(si un comando falla, dejá ese campo vacío; nunca mandes tokens ni contraseñas): ' +
    'clientVersion con `claude --version`; os con `sw_vers -productVersion` en macOS, `ver` en Windows o `uname -sr` en Linux; ' +
    'githubUser con `gh api user -q .login` (o `git config user.name` si no tiene gh); vercelUser con `vercel whoami`; supabase con `supabase --version` o el ref de un proyecto propio. ' +
    'Después contale al alumno qué quedó verificado, qué falta y el próximo paso.',
  inputSchema: obj({
    client: { type: 'string', description: "Cliente MCP, p. ej. 'claude-code'." },
    clientVersion: { type: 'string', description: 'Salida de `claude --version`.' },
    os: { type: 'string', description: 'Sistema operativo y versión.' },
    githubUser: { type: 'string', description: 'Usuario de GitHub.' },
    vercelUser: { type: 'string', description: 'Usuario de Vercel (`vercel whoami`).' },
    supabase: { type: 'string', description: 'Versión del CLI de Supabase o ref de un proyecto propio.' },
    message: { type: 'string', description: 'Un saludo o comentario del alumno (opcional).' },
  }),
  async run(args, ctx) {
    if (ctx.caller.role !== 'alumno') throw new ToolError('hola_campus es para alumnos.')
    const res = await recordEnvironmentCheck({
      personId: ctx.caller.person.id,
      tokenId: ctx.caller.tokenId,
      client: str(args, 'client', { max: 80 }) ?? 'claude-code',
      clientVersion: str(args, 'clientVersion', { max: 200 }),
      os: str(args, 'os', { max: 200 }),
      githubUser: str(args, 'githubUser', { max: 100 }),
      vercelUser: str(args, 'vercelUser', { max: 100 }),
      supabase: str(args, 'supabase', { max: 200 }),
      details: { message: str(args, 'message', { max: 500 }) ?? null },
    })
    const org = await getOrganization(ctx.caller.person.id)
    const gaps = organizationGaps(org)
    const nombre = ctx.caller.person.full_name.split(' ')[0]
    const next: string[] = []
    if (res.missing.length) next.push(`Completá lo que falta del stack (${res.missing.join(', ')}) y volvé a decirle hola al campus.`)
    if (gaps.length) next.push(`Completá Mi organización: falta ${gaps.join(', ').toLowerCase()}.`)
    next.push('Desplegá una primera página en Vercel desde un repo de GitHub y pegá la URL en la entrega B1.')
    next.push('En la entrega B1, escribí qué proceso de tu organización vas a atacar en el bloque Build y por qué.')
    return {
      saludo: `¡Hola, ${nombre}! El campus te recibió desde ${[res.check.client, res.check.client_version].filter(Boolean).join(' ')}.`,
      verificadoEl: res.check.created_at,
      stack: { claudeCode: true, github: res.check.github_user, vercel: res.check.vercel_user, supabase: res.check.supabase, sistema: res.check.os },
      faltaVerificar: res.missing,
      entregaB1: res.b1.submitted
        ? { estado: 'entregada con la evidencia de esta verificación', url: ctx.origin + `/campus/entregas/${res.b1.assignmentId}` }
        : { estado: 'no se marcó', motivo: res.b1.reason },
      organizacion: org ? { nombre: org.name, falta: gaps } : { nombre: null, falta: gaps, url: ctx.origin + ORG_URL },
      proximosPasos: next,
    }
  },
}

const miOrganizacion: ToolDef = {
  name: 'mi_organizacion',
  title: 'Mi organización',
  description:
    'La organización real sobre la que el alumno trabaja en el programa: industria, tamaño, su rol, procesos candidatos (con dolor, volumen y responsable), datos que tienen, sistemas que usan y links (repo, app). ' +
    'También lista los 6 entregables oficiales por bloque. Usala para construir y razonar sobre SU caso, no sobre uno genérico.',
  inputSchema: obj({}),
  readOnly: true,
  async run(_args, ctx) {
    const org = await getOrganization(ctx.caller.person.id, COURSE_ID)
    return {
      organizacion: org
        ? {
            nombre: org.name, tipo: org.kind, industria: org.industry, tamano: org.size, miRol: org.my_role, descripcion: org.description,
            procesos: org.processes, datos: org.data_assets, sistemas: org.systems, links: org.links, actualizada: org.updated_at,
          }
        : null,
      falta: organizationGaps(org),
      editar: ctx.origin + ORG_URL,
      entregables: ENTREGABLES.map((e) => ({ id: e.id, bloque: `${e.block} · ${e.blockName}`, titulo: e.title, vence: e.dueAt, url: ctx.origin + `/campus/entregas/${e.id}` })),
    }
  },
}

export const ALUMNO_ENTORNO_TOOLS: ToolDef[] = [holaCampus, miOrganizacion]
