/* El ícono de cada tipo de canal, para el riel de canales y la hoja «Más». */
import { AtSign, FileText, Hash, type LucideIcon, Megaphone, MessagesSquare } from 'lucide-react'
import type { ChannelKind } from '@/lib/core/spaces'

const ICONS: Record<ChannelKind, LucideIcon> = {
  avisos: Megaphone,
  consultas: MessagesSquare,
  material: FileText,
  libre: Hash,
  directo: AtSign
}

export function ChannelIcon({ kind, className }: { kind: ChannelKind; className?: string }) {
  const Icon = ICONS[kind]
  return <Icon aria-hidden='true' className={className} strokeWidth={1.8} />
}
