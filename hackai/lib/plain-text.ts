/* Texto para comparar a mano: sin tildes, sin mayúsculas y sin espacios de más.
   «Análisis  Matemático» y «analisis matematico» dan lo mismo. */
export const plainText = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
