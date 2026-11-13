/* Leer un formulario en una acción del servidor: lo que no es texto (un archivo
   o un campo que no vino) se lee como vacío. */

/** El valor de texto de un campo del formulario, o `''`. */
export function formText(formData: FormData, name: string): string {
  const value = formData.get(name)
  return typeof value === 'string' ? value : ''
}
