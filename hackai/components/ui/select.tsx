'use client'

/* Los desplegables de la app. Antes eran <select> nativos y cada navegador los
   dibujaba a su manera: la flecha pegada al borde, el texto corrido, el menú
   gris del sistema. Ahora el botón y el menú son nuestros (Radix Select, que
   ya viene en `radix-ui`): el botón con la flecha a 0,75 rem del borde y el
   menú como una tarjeta blanca que baja del botón, con la opción elegida en
   azul y una tilde. Se maneja con el teclado como un select y, con `name`,
   manda su valor en el formulario como cualquier campo.
   El tamaño, el radio y el texto del botón los pone quien lo usa en `className`. */
import { Check, ChevronDown } from 'lucide-react'
import { Select as Radix } from 'radix-ui'
import { blocksOf, fromRadix, optionValue, type SelectOption, toRadix } from '@/components/ui/select-options'
import { cn } from '@/lib/utils'

export type { SelectOption }

function Item({ option }: { option: SelectOption }) {
  return (
    <Radix.Item
      value={optionValue(option.value)}
      disabled={option.disabled}
      className='relative flex min-h-11 cursor-pointer items-center py-2.5 pr-11 pl-5 text-[0.9375rem] text-ink outline-none transition-colors duration-100 select-none data-[disabled]:cursor-default data-[disabled]:text-gray-light data-[highlighted]:bg-ice data-[state=checked]:bg-accent data-[state=checked]:font-semibold data-[state=checked]:text-blue'
    >
      {/* La elegida: fondo tintado de lado a lado y una barrita a la izquierda, como un índice. */}
      <Radix.ItemIndicator className='absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-blue' />
      <Radix.ItemText>{option.label}</Radix.ItemText>
      <Radix.ItemIndicator className='absolute right-4 grid place-items-center'>
        <Check aria-hidden='true' className='size-4' strokeWidth={2.2} />
      </Radix.ItemIndicator>
    </Radix.Item>
  )
}

export function Select({
  options,
  value,
  defaultValue,
  onValueChange,
  name,
  required,
  disabled,
  placeholder,
  className,
  'aria-label': ariaLabel,
  'aria-describedby': describedBy
}: {
  options: SelectOption[]
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  /** Con `name`, el valor viaja en el formulario. */
  name?: string
  required?: boolean
  disabled?: boolean
  /** Lo que dice el botón mientras no hay nada elegido. */
  placeholder?: string
  /** Para el botón: alto, radio, padding y texto. */
  className?: string
  'aria-label'?: string
  'aria-describedby'?: string
}) {
  // Radix escribe el texto de la opción elegida recién cuando se montan las opciones: en el HTML del servidor el
  // botón llegaba vacío hasta hidratar. Con `value` se sabe cuál es, así que el texto va desde el principio.
  const chosen = value === undefined ? undefined : options.find((o) => optionValue(o.value) === toRadix(value, options))
  return (
    <Radix.Root
      value={toRadix(value, options)}
      // Sin una opción vacía, un valor vacío es «nada elegido»: se ve el placeholder, como con `value`.
      defaultValue={toRadix(defaultValue, options) || undefined}
      onValueChange={(next) => onValueChange?.(fromRadix(next))}
      name={name}
      required={required}
      disabled={disabled}
    >
      <Radix.Trigger
        aria-label={ariaLabel}
        aria-describedby={describedBy}
        className={cn(
          'group/select flex h-10 w-full min-w-0 cursor-pointer items-center justify-between gap-2 rounded-xl border border-border bg-card pr-3 pl-3.5 text-left text-[0.875rem] text-ink transition-colors hover:border-ink/20 focus-ring disabled:cursor-not-allowed disabled:opacity-50 data-[placeholder]:text-muted-foreground data-[state=open]:border-blue/40',
          className
        )}
      >
        <span className='min-w-0 flex-1 truncate'>
          <Radix.Value placeholder={placeholder}>{chosen?.label}</Radix.Value>
        </span>
        <Radix.Icon asChild>
          <ChevronDown
            aria-hidden='true'
            className='size-4 flex-none text-muted-foreground transition-transform duration-200 group-data-[state=open]/select:rotate-180 motion-reduce:transition-none'
            strokeWidth={2}
          />
        </Radix.Icon>
      </Radix.Trigger>
      <Radix.Portal>
        <Radix.Content
          position='popper'
          sideOffset={6}
          collisionPadding={12}
          className='z-40 max-h-[min(22rem,var(--radix-select-content-available-height))] min-w-(--radix-select-trigger-width) overflow-hidden rounded-2xl bg-card shadow-[0_0_0_1px_rgb(11_17_80/0.05),0_12px_32px_-8px_rgb(11_17_80/0.18),0_4px_10px_-4px_rgb(11_17_80/0.08)] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-1 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 motion-reduce:animate-none'
        >
          <Radix.Viewport className='py-2'>
            {blocksOf(options).map((block, i) =>
              block.group === undefined ? (
                block.items.map((option) => <Item key={option.value} option={option} />)
              ) : (
                <Radix.Group key={`${block.group}-${block.items[0].value}`}>
                  {i > 0 && <Radix.Separator className='mx-5 my-1.5 h-px bg-border' />}
                  <Radix.Label className='px-5 pt-2 pb-1 text-[0.75rem] font-semibold text-muted-foreground'>
                    {block.group}
                  </Radix.Label>
                  {block.items.map((option) => (
                    <Item key={option.value} option={option} />
                  ))}
                </Radix.Group>
              )
            )}
          </Radix.Viewport>
        </Radix.Content>
      </Radix.Portal>
    </Radix.Root>
  )
}
