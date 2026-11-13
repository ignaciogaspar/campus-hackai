/* Los estilos de los campos de los formularios del docente en Seguimiento:
   etiqueta, caja, ayuda y botón principal. Están acá para que todas las
   pantallas los compartan en vez de redeclararlos. */
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export const LABEL = 'flex flex-col gap-1 text-[0.8125rem] font-semibold'
export const BOX =
  'flex min-h-11 items-center rounded-[10px] border border-border bg-card has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring'
export const INPUT = 'min-h-11 w-full bg-transparent px-3 text-[0.9375rem] font-normal outline-none'
export const HELP = 'font-normal text-muted-foreground'
export const PRIMARY = cn(buttonVariants(), 'min-h-11 rounded-[10px] px-4 text-[0.9375rem] font-bold')
export const SECONDARY = cn(buttonVariants({ variant: 'outline' }), 'min-h-11 rounded-[10px] px-4 text-[0.9375rem]')
/** El casillero de la nota: la misma caja para escribirla y para mostrarla, con cifras tabulares. */
export const GRADE_BOX =
  'inline-grid h-11 w-18 place-items-center rounded-[10px] border border-border bg-card text-center text-base font-semibold tabular-nums text-ink'
export const GHOST = cn(buttonVariants({ variant: 'ghost' }), 'min-h-11 rounded-[10px] px-4 text-[0.9375rem]')
