import Link from 'next/link'
import { requirePerson } from '@/lib/auth'
import { listCohort } from '@/lib/classroom/profiles'
import { routes } from '@/lib/routes'
import { Avatar } from '@/components/classroom/Avatar'
import { ProfileForm } from '@/components/classroom/ProfileForm'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Mi perfil' }

export default async function Perfil() {
  const { person } = await requirePerson('alumno')
  const { industries } = await listCohort(person.course_id)
  return (
    <div className="page" style={{ maxWidth: 820 }}>
      <div className="page-head">
        <div className="cl-perfil-head">
          <Avatar name={person.full_name} photoUrl={person.photo_url} />
          <div>
            <div className="kicker">Mi perfil</div>
            <h1>{person.full_name}</h1>
            <p className="muted chico" style={{ margin: 0 }}>Lo ve toda la cohorte y los profesores. Tu email de ingreso no se muestra; los datos de contacto que cargues, sí.</p>
          </div>
        </div>
        <Link className="btn" href={routes.cohorte}>Ver la cohorte</Link>
      </div>
      <div className="card">
        <ProfileForm
          industries={industries}
          initial={{
            company: person.company ?? '',
            position: person.position ?? '',
            industry: person.industry ?? '',
            bio: person.bio ?? '',
            linkedin: person.linkedin ?? '',
            contact_email: person.contact_email ?? '',
            whatsapp: person.whatsapp ?? '',
            interests: person.interests.join(', '),
          }}
        />
      </div>
    </div>
  )
}
