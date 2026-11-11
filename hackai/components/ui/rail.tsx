/* Riel: un carril gris donde la opción elegida sobresale en relieve, como una
   pieza blanca apoyada. Lo usan las pestañas de canales del espacio, los
   filtros y los selectores segmentados (docs/design/direccion-de-diseno.md).

   Son clases, no un componente, para que las compartan enlaces, botones de
   formularios y disparadores de Radix sin cargar JavaScript de más. La opción
   elegida se marca con el atributo que corresponda a cada control:
   aria-current="page" (enlaces), aria-pressed (botones), aria-selected o
   data-state="active" (Radix). */
import { cva } from 'class-variance-authority'

const SELECTED =
  'aria-[current=page]:bg-card aria-[current=page]:text-blue aria-[current=page]:shadow-raised aria-pressed:bg-card aria-pressed:text-blue aria-pressed:shadow-raised aria-selected:bg-card aria-selected:text-blue aria-selected:shadow-raised data-[state=active]:bg-card data-[state=active]:text-blue data-[state=active]:shadow-raised'

export const railTrack = cva('bg-ice shadow-[inset_0_1px_3px_rgb(11_17_80/0.08)]', {
  variants: {
    size: {
      /** Opciones con ícono arriba del nombre, como las pestañas de canales. */
      md: 'grid auto-cols-fr grid-flow-col gap-1 rounded-[22px] p-1.5',
      /** Opciones de una línea, como un filtro o un selector. */
      sm: 'flex gap-1 rounded-full p-1',
      /** Una columna con el ícono al costado: la lista de canales en compu. */
      column: 'flex flex-col gap-1 rounded-[22px] p-1.5'
    }
  },
  defaultVariants: { size: 'md' }
})

export const railItem = cva(
  `relative flex min-w-0 cursor-pointer items-center font-semibold text-muted-foreground transition-[background-color,color,box-shadow] duration-150 hover:text-foreground focus-ring-inset disabled:cursor-progress disabled:opacity-60 motion-reduce:transition-none [&_svg]:flex-none ${SELECTED}`,
  {
    variants: {
      size: {
        md: 'min-h-14 flex-col justify-center gap-1 rounded-[16px] px-1 text-xs [&_svg]:size-5',
        sm: 'min-h-10 flex-1 justify-center gap-1.5 rounded-full px-3 text-[0.8125rem] whitespace-nowrap',
        column: 'min-h-11 flex-row justify-start gap-2.5 rounded-[16px] px-3 text-sm [&_svg]:size-5'
      }
    },
    defaultVariants: { size: 'md' }
  }
)
