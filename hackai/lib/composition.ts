/* Armado del sistema: el único lugar que conoce a todos los adaptadores.
   Elige el adaptador de cada puerto por una variable de entorno; sin
   configurar, usa el de memoria con el set de datos sintéticos.

   | Puerto         | Variable                  | Valores            |
   | -------------- | ------------------------- | ------------------ |
   | Identidad      | `HACKAI_IDENTITY`         | memoria            |
   | SIU            | `HACKAI_SIU`              | memoria, simulado  |
   | Aula virtual   | `HACKAI_CLASSROOM`        | memoria, simulado  |
   | Canal externo  | `HACKAI_EXTERNAL_CHANNEL` | memoria, discord   |
   | Archivos       | `HACKAI_FILES`            | memoria, supabase  |
   | Reloj          | `HACKAI_CLOCK`            | memoria, sistema   |
   | Almacén        | `HACKAI_STORE`            | memoria, supabase  |

   El reloj `memoria` está fijo en el «hoy» del set sintético (martes 10/11);
   la demo va con `sistema`, para que Hoy muestre la fecha del día.

   `simulado` es el SIU simulado sobre las tablas siu_* de Supabase, o el Moodle
   simulado sobre las moodle_*: necesita NEXT_PUBLIC_SUPABASE_URL y
   SUPABASE_SERVICE_ROLE_KEY, y las tablas cargadas (hackai/README.md). Los dos
   van envueltos en la caché de lecturas (lib/adapters/cache/): cada lectura es
   una consulta a la base y una pantalla hace muchas. También el almacén de
   Personas en Supabase. Los de memoria no la necesitan. `HACKAI_CACHE_SEGUNDOS`
   dice cuánto se guarda lo que no cambia con lo que hace el alumno (300 si no
   está); con 0 no se guarda nada, por ejemplo para editar el seed en vivo.

   El almacén no es un puerto: es el seam interno donde cada módulo guarda lo
   suyo. `supabase` usa las tablas propias de HackAI (supabase/migrations/) y
   necesita las mismas dos variables. Lo usan Personas, para los vínculos con
   cada sistema, Cursada, para las listas que toma el docente, y Espacios, para
   espacios, canales, mensajes, material y lo leído.

   Archivos con `supabase` guarda en el bucket privado de Supabase Storage
   (supabase/migrations/0003_files.sql), con las mismas dos variables.

   Con `discord`, el token del bot va en `DISCORD_BOT_TOKEN` (guía:
   docs/discord.md). «Conectar con Discord» necesita además `DISCORD_CLIENT_ID`
   y `DISCORD_CLIENT_SECRET`; sin ellos, el espacio solo se vincula pegando el
   enlace o el ID de cada canal. `DISCORD_REDIRECT_URI` fija la URL de vuelta
   si la del pedido no es la que está cargada en el Developer Portal.

   `HACKAI_CAIDAS=si` envuelve al SIU y al aula virtual con un interruptor que
   los hace responder como caídos, para mostrarlo en la demo desde `/caidas`
   (README, «Mostrar una caída en la demo»). Vacía o `no`, el interruptor no
   existe: es lo de producción.

   Cada ticket que suma un adaptador lo agrega a su lista acá. Un valor
   desconocido o una variable que falta corta el arranque: es un error de
   configuración, no algo que el núcleo pueda resolver. */
import { AsyncLocalStorage } from 'node:async_hooks'
import type { SupabaseClient } from '@supabase/supabase-js'
import { cache as reactCache } from 'react'
import { STATIC_TTL_MS, withClassroomCache, withPeopleStoreCache, withSiuCache } from '@/lib/adapters/cache'
import { createOutageSwitch, type OutageSwitch, withClassroomOutage, withSiuOutage } from '@/lib/adapters/caida'
import { createDiscordExternalChannel } from '@/lib/adapters/discord/external-channel'
import { createDiscordOAuth, type DiscordOAuth } from '@/lib/adapters/discord/oauth'
import { createMemoryClassroom } from '@/lib/adapters/memoria/classroom'
import { createFixedClock } from '@/lib/adapters/memoria/clock'
import { createMemoryExternalChannel } from '@/lib/adapters/memoria/external-channel'
import { createMemoryFiles } from '@/lib/adapters/memoria/files'
import { createMemoryIdentity } from '@/lib/adapters/memoria/identity'
import { createMemoryPeopleStore } from '@/lib/adapters/memoria/people-store'
import { createMemorySiu } from '@/lib/adapters/memoria/siu'
import { createMemorySpacesStore } from '@/lib/adapters/memoria/spaces-store'
import { createMemoryStudiesStore } from '@/lib/adapters/memoria/studies-store'
import { createSimulatedMoodle } from '@/lib/adapters/moodle-simulado'
import { createSystemClock } from '@/lib/adapters/sistema/clock'
import { createSimulatedSiu } from '@/lib/adapters/siu-simulado'
import { supabaseFromEnv } from '@/lib/adapters/supabase/client'
import { createSupabaseFiles } from '@/lib/adapters/supabase/files'
import { createSupabasePeopleStore } from '@/lib/adapters/supabase/people-store'
import { createSupabaseSpacesStore } from '@/lib/adapters/supabase/spaces-store'
import { createSupabaseStudiesStore } from '@/lib/adapters/supabase/studies-store'
import { type SyntheticData, syntheticData } from '@/lib/adapters/synthetic-data'
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
import { memoRead, type RequestScope } from '@/lib/request-memo'

export type Env = Record<string, string | undefined>

export {
  isOutageSystem,
  OUTAGE_SYSTEMS,
  type OutageState,
  type OutageSwitch,
  type OutageSystem
} from '@/lib/adapters/caida'

/** El PDF de una página del set sintético: lo sirve el Moodle simulado de la demo (app/simulado/moodle/). */
export { syntheticPdf } from '@/lib/adapters/synthetic-files'

const ADAPTERS = {
  identity: { variable: 'HACKAI_IDENTITY', values: ['memoria'] },
  siu: { variable: 'HACKAI_SIU', values: ['memoria', 'simulado'] },
  classroom: { variable: 'HACKAI_CLASSROOM', values: ['memoria', 'simulado'] },
  externalChannel: { variable: 'HACKAI_EXTERNAL_CHANNEL', values: ['memoria', 'discord'] },
  files: { variable: 'HACKAI_FILES', values: ['memoria', 'supabase'] },
  clock: { variable: 'HACKAI_CLOCK', values: ['memoria', 'sistema'] },
  store: { variable: 'HACKAI_STORE', values: ['memoria', 'supabase'] }
} as const

/** Lo que se elige por entorno: los seis puertos y el almacén de los módulos. */
type AdapterName = keyof typeof ADAPTERS

export type AdapterChoice = { [A in AdapterName]: (typeof ADAPTERS)[A]['values'][number] }

export type Ports = {
  identity: IdentityPort
  siu: SiuPort
  classroom: ClassroomPort
  externalChannel: ExternalChannelPort
  files: FilesPort
  clock: ClockPort
}

export type System = {
  /** Qué adaptador quedó en cada puerto y en el almacén. */
  adapters: AdapterChoice
  /** Los puertos armados. Las pantallas no los usan: son para tests y scripts. */
  ports: Ports
  /** La hora del reloj de la app, en ISO. Las pantallas la usan para decir «actualizado hace…» con el mismo reloj
      que marcó la hora de cada lectura. */
  now(): string
  /** El interruptor de caídas de la demo, o `null` si `HACKAI_CAIDAS` no lo pide. */
  outages: OutageSwitch | null
  /** «Conectar con Discord», o `null` si el canal externo no es Discord o falta la aplicación de Discord. */
  discordOAuth: DiscordOAuth | null
  /** La URL de vuelta de Discord fijada por `DISCORD_REDIRECT_URI`, o `null` para usar la del pedido. */
  discordRedirectUri: string | null
  people: People
  studies: Studies
  spaces: Spaces
  today: Today
}

function choose<A extends AdapterName>(env: Env, name: A): AdapterChoice[A] {
  const { variable, values } = ADAPTERS[name]
  const value = env[variable]?.trim() || 'memoria'
  if (!(values as readonly string[]).includes(value)) {
    throw new Error(`${variable} no corresponde a un adaptador conocido. Valores posibles: ${values.join(', ')}`)
  }
  return value as AdapterChoice[A]
}

/** Una variable que el adaptador elegido necesita. El error nombra la
    variable, nunca su valor. */
function required(env: Env, variable: string, neededBy: string): string {
  const value = env[variable]?.trim()
  if (!value) throw new Error(`${neededBy} necesita ${variable} en el entorno`)
  return value
}

/** Cuánto guarda la caché de lecturas lo fijo, en milisegundos, según `HACKAI_CACHE_SEGUNDOS`. */
function cacheTtlFrom(env: Env): number {
  const value = env.HACKAI_CACHE_SEGUNDOS?.trim()
  if (!value) return STATIC_TTL_MS
  if (!/^\d{1,5}$/.test(value))
    throw new Error('HACKAI_CACHE_SEGUNDOS tiene que ser una cantidad de segundos, como 300 o 0')
  return Number(value) * 1000
}

/** El interruptor de caídas, solo si `HACKAI_CAIDAS=si`. */
function outagesFrom(env: Env): OutageSwitch | null {
  const value = env.HACKAI_CAIDAS?.trim() || 'no'
  if (value !== 'si' && value !== 'no') throw new Error('HACKAI_CAIDAS tiene que ser si o no')
  return value === 'si' ? createOutageSwitch() : null
}

/** Arma todos los módulos con los adaptadores que piden las variables de
    entorno. Cada llamada tiene su propia copia de los datos en memoria. */
export function compose(
  env: Env = process.env,
  data: SyntheticData = syntheticData,
  requestScope?: RequestScope
): System {
  const adapters: AdapterChoice = {
    identity: choose(env, 'identity'),
    siu: choose(env, 'siu'),
    classroom: choose(env, 'classroom'),
    externalChannel: choose(env, 'externalChannel'),
    files: choose(env, 'files'),
    clock: choose(env, 'clock'),
    store: choose(env, 'store')
  }

  const clock = adapters.clock === 'sistema' ? createSystemClock() : createFixedClock(data.now)

  /** Un solo cliente de Supabase para todos los adaptadores que lo usan. */
  let client: SupabaseClient | undefined
  const supabase = () => (client ??= supabaseFromEnv(env))

  const outages = outagesFrom(env)
  const cache = { staticTtlMs: cacheTtlFrom(env), requestScope }
  const siu =
    adapters.siu === 'simulado'
      ? withSiuCache(
          createSimulatedSiu({
            client: supabase(),
            clock,
            selfServiceBaseUrl: data.siu.selfServiceBaseUrl,
            personTtlMs: cache.staticTtlMs
          }),
          cache
        )
      : createMemorySiu(data, clock)
  const classroom =
    adapters.classroom === 'simulado'
      ? withClassroomCache(createSimulatedMoodle({ client: supabase(), baseUrl: data.moodle.baseUrl }), cache)
      : createMemoryClassroom(data)

  const ports: Ports = {
    identity: createMemoryIdentity(data),
    siu: outages ? withSiuOutage(siu, outages) : siu,
    classroom: outages ? withClassroomOutage(classroom, outages) : classroom,
    externalChannel:
      adapters.externalChannel === 'discord'
        ? createDiscordExternalChannel({ token: required(env, 'DISCORD_BOT_TOKEN', 'HACKAI_EXTERNAL_CHANNEL=discord') })
        : createMemoryExternalChannel(data, clock),
    files: adapters.files === 'supabase' ? createSupabaseFiles({ client: supabase() }) : createMemoryFiles(),
    clock
  }

  const people = memoPeople(
    createPeople({
      identity: ports.identity,
      siu: ports.siu,
      store:
        adapters.store === 'supabase'
          ? withPeopleStoreCache(createSupabasePeopleStore({ client: supabase() }), cache)
          : createMemoryPeopleStore(data)
    }),
    requestScope
  )
  const studies = memoStudies(
    createStudies({
      people,
      siu: ports.siu,
      classroom: ports.classroom,
      clock,
      store:
        adapters.store === 'supabase' ? createSupabaseStudiesStore({ client: supabase() }) : createMemoryStudiesStore()
    }),
    requestScope
  )
  const spaces = memoSpaces(
    createSpaces({
      people,
      studies,
      externalChannel: ports.externalChannel,
      classroom: ports.classroom,
      files: ports.files,
      clock,
      store:
        adapters.store === 'supabase' ? createSupabaseSpacesStore({ client: supabase() }) : createMemorySpacesStore(),
      // El tiempo real del proceso, aunque el reloj sea el fijo de la demo.
      timer: () => performance.now()
    }),
    requestScope
  )
  const today = createToday({ studies, spaces, clock })

  const now = () => clock.now().toISOString()
  return {
    adapters,
    ports,
    now,
    outages,
    discordOAuth: discordOAuthFrom(env, adapters),
    discordRedirectUri: env.DISCORD_REDIRECT_URI?.trim() || null,
    people,
    studies,
    spaces,
    today
  }
}

/** «Conectar con Discord», solo con el canal externo de Discord y su aplicación configurada. */
function discordOAuthFrom(env: Env, adapters: AdapterChoice): DiscordOAuth | null {
  const clientId = env.DISCORD_CLIENT_ID?.trim()
  const clientSecret = env.DISCORD_CLIENT_SECRET?.trim()
  if (adapters.externalChannel !== 'discord' || !clientId || !clientSecret) return null
  return createDiscordOAuth({ clientId, clientSecret })
}

function memoPeople(people: People, scope: RequestScope | undefined): People {
  return { ...people, get: memoRead(scope, 'people.get', people.get) }
}

function memoStudies(studies: Studies, scope: RequestScope | undefined): Studies {
  return {
    ...studies,
    subjectsOf: memoRead(scope, 'studies.subjectsOf', studies.subjectsOf),
    newGrades: memoRead(scope, 'studies.newGrades', studies.newGrades),
    career: memoRead(scope, 'studies.career', studies.career),
    upcoming: memoRead(scope, 'studies.upcoming', studies.upcoming),
    openEnrollments: memoRead(scope, 'studies.openEnrollments', studies.openEnrollments),
    sectionsOf: memoRead(scope, 'studies.sectionsOf', studies.sectionsOf),
    enroll: clearAfter(studies.enroll, () => scope?.()?.clear()),
    drop: clearAfter(studies.drop, () => scope?.()?.clear()),
    takeAttendance: clearAfter(studies.takeAttendance, () => scope?.()?.clear())
  }
}

function clearAfter<A extends unknown[], R>(write: (...args: A) => Promise<R>, clear: () => void) {
  return async (...args: A) => {
    try {
      return await write(...args)
    } finally {
      clear()
    }
  }
}

function memoSpaces(spaces: Spaces, scope: RequestScope | undefined): Spaces {
  // Abrir importa novedades, leer un canal marca lo leído y publicar también lo actualiza.
  const clear = () => {
    const entries = scope?.()
    if (!entries) return
    for (const key of entries.keys()) if (key.startsWith('spaces.unreadFor:')) entries.delete(key)
  }
  return {
    ...spaces,
    unreadFor: memoRead(scope, 'spaces.unreadFor', spaces.unreadFor),
    open: clearAfter(spaces.open, clear),
    channel: clearAfter(spaces.channel, clear),
    version: clearAfter(spaces.version, clear),
    post: clearAfter(spaces.post, clear),
    addMaterial: clearAfter(spaces.addMaterial, clear),
    createChannel: clearAfter(spaces.createChannel, clear),
    openDirect: clearAfter(spaces.openDirect, clear),
    link: clearAfter(spaces.link, clear),
    createExternalChannels: clearAfter(spaces.createExternalChannels, clear),
    syncAll: clearAfter(spaces.syncAll, clear)
  }
}

/** Next empaqueta páginas, acciones y rutas por separado. Se comparte el estado
    de los adaptadores entre capas, pero cada render obtiene su alcance de React. */
type RenderScope = NonNullable<ReturnType<RequestScope>>
const holder = globalThis as typeof globalThis & {
  __hackaiSystem?: System
  __hackaiRenderScope?: AsyncLocalStorage<RenderScope>
}
const scopeOfRender = reactCache(() => new Map<string, Promise<unknown>>())

function inRender<T extends object>(target: T, storage: AsyncLocalStorage<RenderScope>, scope: RenderScope): T {
  return Object.fromEntries(
    Object.entries(target).map(([name, method]) => [
      name,
      (...args: unknown[]) => storage.run(scope, () => method(...args))
    ])
  ) as T
}

/** Los adaptadores en memoria guardan su estado mientras viva el proceso. */
export function system(): System {
  holder.__hackaiRenderScope ??= new AsyncLocalStorage<RenderScope>()
  const storage = holder.__hackaiRenderScope
  holder.__hackaiSystem ??= compose(process.env, syntheticData, () => storage.getStore())
  const base = holder.__hackaiSystem
  const scope = scopeOfRender()
  // Fuera del render React ejecuta la función en cada llamada.
  if (scope !== scopeOfRender()) return base
  return {
    ...base,
    people: inRender(base.people, storage, scope),
    studies: inRender(base.studies, storage, scope),
    spaces: inRender(base.spaces, storage, scope),
    today: inRender(base.today, storage, scope)
  }
}
