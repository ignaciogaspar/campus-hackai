import Link from 'next/link'
import { requirePerson } from '@/lib/auth'
import { listCohort, type PublicProfile } from '@/lib/classroom/profiles'
import { routes } from '@/lib/routes'
import { Avatar } from '@/components/classroom/Avatar'
import { LinkedinIcon, MailIcon, WhatsappIcon } from '@/components/classroom/ContactIcons'
import '@/components/classroom/classroom.css'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Cohorte' }

function Perfil({ p, yo }: { p: PublicProfile; yo: boolean }) {
  return (
    <article className="card cl-perfil">
      <div className="cl-perfil-head">
        <Avatar name={p.full_name} photoUrl={p.photo_url} size="chico" />
        <div>
          <h3>{p.full_name}{yo ? <span className="muted chico"> · vos</span> : null}</h3>
          <p>{[p.position, p.company].filter(Boolean).join(' · ') || 'Sin datos todavía'}</p>
        </div>
      </div>
      <div className="fila">
        {p.industry ? <span className="badge">{p.industry}</span> : null}
        {p.is_fictional ? <span className="badge badge-ficticio">Perfil ficticio</span> : null}
      </div>
      {p.bio ? <p className="cl-perfil-bio">{p.bio}</p> : null}
      {p.interests.length ? <div className="cl-chips">{p.interests.map((i) => <span key={i} className="cl-chip">{i}</span>)}</div> : null}
      {p.linkedin || p.whatsapp || p.contact_email ? (
        <div className="cl-contacto">
          {p.linkedin ? <a className="btn btn-sm" href={p.linkedin} target="_blank" rel="noreferrer noopener"><LinkedinIcon /> LinkedIn</a> : null}
          {p.whatsapp ? <a className="btn btn-sm" href={`https://wa.me/${p.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer noopener"><WhatsappIcon /> WhatsApp</a> : null}
          {p.contact_email ? <a className="btn btn-sm" href={`mailto:${p.contact_email}`} title={p.contact_email}><MailIcon /> Email</a> : null}
        </div>
      ) : yo ? <Link className="chico" href={routes.perfil}>Agregá tu LinkedIn, WhatsApp o email →</Link> : null}
    </article>
  )
}

export default async function Cohorte() {
  const { person } = await requirePerson('alumno')
  const { profesores, alumnos, industries } = await listCohort(person.course_id)

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="kicker">AI-Centric Management</div>
          <h1>La cohorte</h1>
          <p className="muted chico">{alumnos.length} ejecutivos de {industries.length} industrias. La cohorte demo es ficticia y está marcada como tal.</p>
        </div>
        <Link className="btn" href={routes.perfil}>Editar mi perfil</Link>
      </div>


      <section className="seccion" aria-labelledby="alumnos-h">
        <h2 id="alumnos-h">Alumnos</h2>
        {alumnos.length === 0 ? <div className="vacio">Todavía no hay alumnos.</div> : (
          <div className="cl-perfiles">{alumnos.map((p) => <Perfil key={p.id} p={p} yo={p.id === person.id} />)}</div>
        )}
      </section>

      {profesores.length ? (
        <section className="seccion" aria-labelledby="profes-h">
          <h2 id="profes-h">Profesores</h2>
          <div className="cl-perfiles">{profesores.map((p) => <Perfil key={p.id} p={p} yo={false} />)}</div>
        </section>
      ) : null}
    </div>
  )
}
