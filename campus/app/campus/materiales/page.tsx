import { redirect } from 'next/navigation'
import { routes } from '@/lib/routes'

// Conceptos y materiales viven en la misma página.
export default function MaterialesPage() {
  redirect(routes.conceptos)
}
