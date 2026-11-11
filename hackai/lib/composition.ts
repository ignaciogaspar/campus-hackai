/* Armado del sistema: el único lugar que conoce a todos los adaptadores.
   Elige el adaptador de cada puerto por una variable de entorno; sin
   configurar, usa el de memoria con el set de datos sintéticos.

   | Puerto         | Variable                  | Valores            |
   | -------------- | ------------------------- | ------------------ |
   | Identidad      | `HACKAI_IDENTITY`         | memoria            |
   | SIU            | `HACKAI_SIU`              | memoria, simulado  |
   | Aula virtual   | `HACKAI_CLASSROOM`        | memoria, simulado  |
   | Canal externo  | `HACKAI_EXTERNAL_CHANNEL` | memoria, discord   |
   | Archivos       | `HACKAI_FILES`            | memoria            |
   | Reloj          | `HACKAI_CLOCK`            | memoria, sistema   |

   `simulado` es el SIU simulado sobre las tablas siu_* de Supabase, o el Moodle
   simulado sobre las moodle_*: necesita NEXT_PUBLIC_SUPABASE_URL y
   SUPABASE_SERVICE_ROLE_KEY, y las tablas cargadas (hackai/README.md).

   Con `discord`, el token del bot va en `DISCORD_BOT_TOKEN` (guía:
   docs/discord.md).

   Cada ticket que suma un adaptador (supabase…) lo agrega a su lista acá. Un
   valor desconocido o una variable que falta corta el arranque: es un error
   de configuración, no algo que el núcleo pueda resolver. */
import { createDiscordExternalChannel } from '@/lib/adapters/discord/external-channel'
import { createMemoryClassroom } from '@/lib/adapters/memoria/classroom'
import { createFixedClock } from '@/lib/adapters/memoria/clock'
import { createMemoryExternalChannel } from '@/lib/adapters/memoria/external-channel'
import { createMemoryFiles } from '@/lib/adapters/memoria/files'
import { createMemoryIdentity } from '@/lib/adapters/memoria/identity'
import { createMemoryPeopleStore } from '@/lib/adapters/memoria/people-store'
import { createMemorySiu } from '@/lib/adapters/memoria/siu'
import { createSimulatedMoodle } from '@/lib/adapters/moodle-simulado'
import { createSimulatedSiu } from '@/lib/adapters/siu-simulado'
import { createSystemClock } from '@/lib/adapters/sistema/clock'
import { supabaseFromEnv } from '@/lib/adapters/supabase/client'
import { syntheticData, type SyntheticData } from '@/lib/adapters/synthetic-data'
import { createPeople, type People } from '@/lib/core/people'
import { createSpaces, type Spaces } from '@/lib/core/spaces'
import { createStudies, type Studies } from '@/lib/core/studies'
import { createToday, type Today } from '@/lib/core/today'
import type { ClassroomPort } from '@/lib/ports/classroom'
import type { ClockPort } from '@/lib/ports/clock'
import type { ExternalChannelPort } from '@/lib/ports/external-channel'
import type { FilesPort } from '@/lib/ports/files'
import type { IdentityPort } from '@/lib/ports/identity'
import type { SiuPort } from '@/lib/ports/siu'

export type Env = Record<string, string | undefined>

const ADAPTERS = {
  identity: { variable: 'HACKAI_IDENTITY', values: ['memoria'] },
  siu: { variable: 'HACKAI_SIU', values: ['memoria', 'simulado'] },
  classroom: { variable: 'HACKAI_CLASSROOM', values: ['memoria', 'simulado'] },
  externalChannel: { variable: 'HACKAI_EXTERNAL_CHANNEL', values: ['memoria', 'discord'] },
  files: { variable: 'HACKAI_FILES', values: ['memoria'] },
  clock: { variable: 'HACKAI_CLOCK', values: ['memoria', 'sistema'] },
} as const

type PortName = keyof typeof ADAPTERS

export type AdapterChoice = { [P in PortName]: (typeof ADAPTERS)[P]['values'][number] }

export type Ports = {
  identity: IdentityPort
  siu: SiuPort
  classroom: ClassroomPort
  externalChannel: ExternalChannelPort
  files: FilesPort
  clock: ClockPort
}

export type System = {
  /** Qué adaptador quedó en cada puerto. */
  adapters: AdapterChoice
  /** Los puertos armados. Las pantallas no los usan: son para tests y scripts. */
  ports: Ports
  people: People
  studies: Studies
  spaces: Spaces
  today: Today
}

function choose<P extends PortName>(env: Env, port: P): AdapterChoice[P] {
  const { variable, values } = ADAPTERS[port]
  const value = env[variable]?.trim() || 'memoria'
  if (!(values as readonly string[]).includes(value)) {
    throw new Error(`${variable} no corresponde a un adaptador conocido. Valores posibles: ${values.join(', ')}`)
  }
  return value as AdapterChoice[P]
}

/** Una variable que el adaptador elegido necesita. El error nombra la
    variable, nunca su valor. */
function required(env: Env, variable: string, neededBy: string): string {
  const value = env[variable]?.trim()
  if (!value) throw new Error(`${neededBy} necesita ${variable} en el entorno`)
  return value
}

/** Arma todos los módulos con los adaptadores que piden las variables de
    entorno. Cada llamada tiene su propia copia de los datos en memoria. */
export function compose(env: Env = process.env, data: SyntheticData = syntheticData): System {
  const adapters: AdapterChoice = {
    identity: choose(env, 'identity'),
    siu: choose(env, 'siu'),
    classroom: choose(env, 'classroom'),
    externalChannel: choose(env, 'externalChannel'),
    files: choose(env, 'files'),
    clock: choose(env, 'clock'),
  }

  const clock = adapters.clock === 'sistema' ? createSystemClock() : createFixedClock(data.now)
  const ports: Ports = {
    identity: createMemoryIdentity(data),
    siu: adapters.siu === 'simulado'
      ? createSimulatedSiu({ client: supabaseFromEnv(env), clock, selfServiceBaseUrl: data.siu.selfServiceBaseUrl })
      : createMemorySiu(data, clock),
    classroom: adapters.classroom === 'simulado'
      ? createSimulatedMoodle({ client: supabaseFromEnv(env), baseUrl: data.moodle.baseUrl })
      : createMemoryClassroom(data),
    externalChannel: adapters.externalChannel === 'discord'
      ? createDiscordExternalChannel({ token: required(env, 'DISCORD_BOT_TOKEN', 'HACKAI_EXTERNAL_CHANNEL=discord') })
      : createMemoryExternalChannel(data, clock),
    files: createMemoryFiles(),
    clock,
  }

  const people = createPeople({ identity: ports.identity, siu: ports.siu, store: createMemoryPeopleStore(data) })
  const studies = createStudies({ people, siu: ports.siu, classroom: ports.classroom, clock })
  const spaces = createSpaces({
    people,
    studies,
    externalChannel: ports.externalChannel,
    classroom: ports.classroom,
    files: ports.files,
    clock,
  })
  const today = createToday({ studies, spaces })

  return { adapters, ports, people, studies, spaces, today }
}

/** Guardado en `globalThis` porque Next.js empaqueta las páginas y las server
    actions en capas distintas, cada una con su copia de este módulo: con una
    variable de módulo, lo que una acción inscribe en memoria no lo vería la
    página. */
const holder = globalThis as typeof globalThis & { __hackaiSystem?: System }

/** El sistema de la app, armado una vez por proceso con `process.env`. Los
    adaptadores en memoria guardan su estado mientras viva el proceso. */
export function system(): System {
  holder.__hackaiSystem ??= compose(process.env)
  return holder.__hackaiSystem
}
