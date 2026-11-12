/* Una vuelta de Discord que no se aceptó: no empezó en HackAI, venció, se repitió o es de otra persona
   (app/discord/vuelta/route.ts). No se sabe de qué materia era, así que lleva a Mis materias para volver a
   tocar «Conectar con Discord» desde el espacio. */
import { ShieldAlert } from 'lucide-react'
import Link from 'next/link'
import { PageHeader } from '@/components/shell/page-header'
import { buttonVariants } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/states'

export const metadata = { title: 'No se conectó con Discord · Campus HackAI' }

export default function DiscordRejected() {
  return (
    <>
      <PageHeader title='No se conectó con Discord' signedOut />
      <main className='flex w-full flex-col items-center gap-4 px-4 pt-6 pb-8 lg:px-6'>
        <EmptyState icon={ShieldAlert} title='Esta autorización no vale'>
          La vuelta de Discord venció, ya se usó o no empezó en HackAI. Abrí la materia y tocá de nuevo «Conectar con
          Discord»: tenés 10 minutos para autorizar.
        </EmptyState>
        <Link href='/materias' className={buttonVariants()}>
          Ir a Mis materias
        </Link>
      </main>
    </>
  )
}
