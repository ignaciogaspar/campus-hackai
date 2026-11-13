/* Las cuentas del desplegable (components/ui/select.tsx), sin pantalla: cómo
   viaja el valor vacío y cómo se agrupan las opciones. */

export type SelectOption = {
  value: string
  label: string
  disabled?: boolean
  /** Las opciones seguidas con el mismo grupo van juntas, debajo de su nombre. */
  group?: string
}

/** Radix no acepta una opción con valor vacío: la de «todas» viaja con este valor y afuera vuelve a ser ''. */
export const EMPTY_OPTION = '__todas__'

/** El valor de una opción, como lo guarda Radix. */
export const optionValue = (value: string) => (value === '' ? EMPTY_OPTION : value)

/** El valor elegido, como lo recibe Radix. Si ninguna opción es la vacía, '' es «nada elegido»: Radix lo recibe
    tal cual y muestra el placeholder, tanto en `value` como en `defaultValue`. */
export function toRadix(value: string | undefined, options: SelectOption[]): string | undefined {
  if (value !== '') return value
  return options.some((o) => o.value === '') ? EMPTY_OPTION : ''
}

/** El valor que devuelve Radix, como lo espera quien usa el desplegable. */
export const fromRadix = (value: string) => (value === EMPTY_OPTION ? '' : value)

/** Las opciones en bloques: las que no tienen grupo van sueltas; las seguidas de un mismo grupo, juntas. */
export function blocksOf(options: SelectOption[]): { group?: string; items: SelectOption[] }[] {
  const blocks: { group?: string; items: SelectOption[] }[] = []
  for (const option of options) {
    const last = blocks.at(-1)
    if (last && last.group === option.group) last.items.push(option)
    else blocks.push({ group: option.group, items: [option] })
  }
  return blocks
}
