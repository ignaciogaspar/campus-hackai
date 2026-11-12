/* Qué archivos se abren en la vista previa del espacio (file-preview.tsx). Va
   aparte del componente, que es de cliente, porque lo llaman también las
   filas del material y los adjuntos, que se arman en el servidor. */

export type PreviewKind = 'pdf' | 'imagen'

/** Si el archivo se puede previsualizar acá: un PDF o una imagen servidos desde nuestro origen. */
export function previewKind(url: string, name: string, contentType: string): PreviewKind | null {
  if (!url.startsWith('/') || url.startsWith('//')) return null
  const type = contentType.split(';')[0].trim().toLowerCase()
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (type === 'application/pdf' || ext === 'pdf') return 'pdf'
  if (/^image\/(png|jpe?g|gif|webp)$/.test(type) || /^(png|jpe?g|gif|webp)$/.test(ext)) return 'imagen'
  return null
}
