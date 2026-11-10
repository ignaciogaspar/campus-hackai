import './classroom.css'

export function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('')
}

/** Foto o iniciales en círculo cian. */
export function Avatar({ name, photoUrl, size = 'normal' }: { name: string; photoUrl?: string | null; size?: 'normal' | 'chico' }) {
  return (
    <span className={`cl-avatar${size === 'chico' ? ' cl-avatar--chico' : ''}`} aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {photoUrl ? <img src={photoUrl} alt="" /> : initials(name)}
    </span>
  )
}
