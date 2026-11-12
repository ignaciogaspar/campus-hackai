/* La identidad visual de cada materia: un ícono según su disciplina y la
   ilustración del encabezado de su espacio (public/headers/). Sale del nombre,
   que llega a todas las pantallas, así una materia nueva del SIU tiene ícono
   sin cargar nada. Es solo presentación: no decide nada de la materia. */
import {
  Atom,
  Axis3d,
  BookOpen,
  BriefcaseBusiness,
  Calculator,
  ChartColumn,
  ChartNoAxesCombined,
  CodeXml,
  DraftingCompass,
  FlaskConical,
  type LucideIcon,
  Megaphone,
  PersonStanding,
  Scale,
  Sigma
} from 'lucide-react'
import { cn } from '@/lib/utils'

/** Las ilustraciones de encabezado por disciplina, en public/headers/. */
export type SubjectArt = 'calculo' | 'geometria' | 'codigo' | 'ciencia' | 'negocios' | 'humanidades' | 'general'

type Theme = { icon: LucideIcon; art: SubjectArt }

/* El orden importa: gana la primera que coincide. «Álgebra y Geometría
   Analítica» va antes que «Análisis», e «Ingeniería de Software» antes que
   «Ingeniería». */
const THEMES: [RegExp, Theme][] = [
  [/algebra|geometr|vectorial|matric/, { icon: Axis3d, art: 'geometria' }],
  [/analisis matematico|calculo|matematic/, { icon: Sigma, art: 'calculo' }],
  [/estadistic|probabilidad/, { icon: ChartColumn, art: 'calculo' }],
  [/programacion|algoritm|software|datos|sistemas|computac|informatic/, { icon: CodeXml, art: 'codigo' }],
  [/fisica/, { icon: Atom, art: 'ciencia' }],
  [/quimica|biolog/, { icon: FlaskConical, art: 'ciencia' }],
  [/ingenieria/, { icon: DraftingCompass, art: 'ciencia' }],
  [/contab|costos|finanz/, { icon: Calculator, art: 'negocios' }],
  [/econom/, { icon: ChartNoAxesCombined, art: 'negocios' }],
  [/administracion|gestion|empresa|negocio/, { icon: BriefcaseBusiness, art: 'negocios' }],
  [/marketing|comunicacion|publicidad/, { icon: Megaphone, art: 'negocios' }],
  [/derecho|legal|juridic/, { icon: Scale, art: 'humanidades' }],
  [/antropolog|filosof|etica|sociolog|histori|teolog|humanidades/, { icon: PersonStanding, art: 'humanidades' }]
]

const FALLBACK: Theme = { icon: BookOpen, art: 'general' }

/** «Álgebra y Geometría Analítica» → «algebra y geometria analitica». */
const normalized = (name: string) =>
  name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

export function subjectTheme(name: string): Theme {
  const key = normalized(name)
  return THEMES.find(([pattern]) => pattern.test(key))?.[1] ?? FALLBACK
}

const SIZES = {
  /** Barra lateral y filas de lista. */
  sm: 'size-8 rounded-[9px] [&_svg]:size-4',
  /** Tarjetas y encabezados de grupo. */
  md: 'size-10 rounded-[12px] [&_svg]:size-5',
  /** Tarjetas de Mis materias y el encabezado del espacio. */
  lg: 'size-12 rounded-[14px] [&_svg]:size-6'
}

const TONES = {
  /** Azul lleno: la materia como pieza de navegación. */
  solid: 'bg-blue text-white',
  /** Azul suave: la materia como dato de una fila. */
  soft: 'bg-accent text-blue',
  /** Sobre el navy del encabezado o el azul de una tarjeta protagonista. */
  glass: 'bg-white/14 text-white ring-1 ring-white/20 ring-inset',
  /** Archivada o ya pasada. */
  muted: 'bg-muted text-muted-foreground',
  /** Solo el trazo, del color del texto: la barra lateral, como el resto de sus íconos. */
  bare: 'size-[1.125rem] rounded-none bg-transparent text-current [&_svg]:size-[1.125rem]'
}

export function SubjectIcon({
  name,
  size = 'md',
  tone = 'solid',
  className
}: {
  /** El nombre de la materia, del que sale el ícono. */
  name: string
  size?: keyof typeof SIZES
  tone?: keyof typeof TONES
  className?: string
}) {
  const Icon = subjectTheme(name).icon
  return (
    <span aria-hidden='true' className={cn('grid flex-none place-items-center', SIZES[size], TONES[tone], className)}>
      <Icon strokeWidth={1.9} />
    </span>
  )
}
