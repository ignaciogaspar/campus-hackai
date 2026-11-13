/* Página de muestra del sistema visual (ticket #8): la estructura y los
   componentes base con datos de ejemplo. No pide sesión ni lee datos. */
import { CalendarDays, CircleCheck, Download, FileText, Megaphone, MessageSquare, RotateCw } from 'lucide-react'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { AppShell } from '@/components/shell/app-shell'
import { IosInstallSteps } from '@/components/shell/install-button'
import { PageHeader } from '@/components/shell/page-header'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { CollapsibleCard } from '@/components/ui/collapsible-card'
import { List, ListItem } from '@/components/ui/list'
import { OriginBadge } from '@/components/ui/origin-badge'
import { SegmentedList, SegmentedTrigger } from '@/components/ui/segmented'
import { Sheet, SheetTrigger } from '@/components/ui/sheet'
import { EmptyState, ErrorNotice, OfflineNotice, Skeleton, StaleNotice } from '@/components/ui/states'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { UnreadCount } from '@/components/ui/unread-count'

export const metadata: Metadata = { title: 'Muestra del sistema visual · Campus HackAI' }

const SCHOOL = 'Facultad de Ingeniería'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className='flex flex-col gap-3'>
      <h2 className='text-lg font-extrabold'>{title}</h2>
      {children}
    </section>
  )
}

function RowIcon({ children }: { children: ReactNode }) {
  return (
    <span className='grid size-9 flex-none place-items-center rounded-full bg-accent text-blue-light [&>svg]:size-5'>
      {children}
    </span>
  )
}

export default function MuestraPage() {
  return (
    <AppShell school={SCHOOL} shell={{ person: null }}>
      <PageHeader title='Muestra del sistema visual' subtitle='Datos de ejemplo' school={SCHOOL} art='hoy' />
      <main className='flex w-full flex-col gap-8 px-4 pt-5 pb-8 lg:px-6'>
        <Section title='Botones'>
          <div className='flex flex-wrap gap-2'>
            <Button>Inscribirme</Button>
            <Button variant='outline'>Ver hilo</Button>
            <Button variant='ghost'>Ahora no</Button>
            <Button disabled>Necesitás conexión</Button>
          </div>
        </Section>

        <Section title='Etiquetas de origen y contador'>
          <div className='flex flex-wrap items-center gap-2'>
            <OriginBadge origin='hackai' />
            <OriginBadge origin='discord' />
            <OriginBadge origin='moodle' />
            <OriginBadge origin='siu' />
            <UnreadCount count={3} />
            <UnreadCount count={120} />
          </div>
        </Section>

        <Section title='Tarjeta con lista'>
          <Card>
            <List>
              <ListItem
                start={
                  <RowIcon>
                    <MessageSquare aria-hidden='true' />
                  </RowIcon>
                }
                title='Respondieron tu consulta'
                description='Mariana Ledesma: «No, llega hasta derivadas y sus aplicaciones.»'
                meta={<>Análisis Matemático I · Consultas · hace 40 min</>}
                end={
                  <span className='mt-1.5 size-2 rounded-full bg-blue-light'>
                    <span className='sr-only'>Sin leer</span>
                  </span>
                }
              />
              <ListItem
                start={
                  <RowIcon>
                    <Megaphone aria-hidden='true' />
                  </RowIcon>
                }
                title='Cambio de aula para el segundo parcial'
                description='El segundo parcial del lunes 16 se toma en el aula 20. Traigan DNI.'
                meta={<>Análisis Matemático I · Avisos · vie 6/11</>}
              />
              <ListItem
                start={
                  <RowIcon>
                    <FileText aria-hidden='true' />
                  </RowIcon>
                }
                title='resumen-derivadas.pdf'
                meta={
                  <>
                    <OriginBadge origin='discord' /> 52 KB · jue 5/11
                  </>
                }
                end={
                  <Button size='sm' variant='outline'>
                    Abrir
                  </Button>
                }
              />
            </List>
          </Card>
        </Section>

        <Section title='Pestañas'>
          <Tabs defaultValue='avisos' className='flex flex-col gap-3'>
            <TabsList aria-label='Canales del espacio'>
              <TabsTrigger value='avisos'>
                Avisos <UnreadCount count={1} />
              </TabsTrigger>
              <TabsTrigger value='consultas'>
                Consultas <UnreadCount count={1} />
              </TabsTrigger>
              <TabsTrigger value='material'>Material</TabsTrigger>
              <TabsTrigger value='directos'>Directos</TabsTrigger>
            </TabsList>
            <TabsContent value='avisos' className='text-sm text-muted-foreground'>
              Los avisos de la comisión.
            </TabsContent>
            <TabsContent value='consultas' className='text-sm text-muted-foreground'>
              Las consultas y sus respuestas.
            </TabsContent>
            <TabsContent value='material' className='text-sm text-muted-foreground'>
              El material por secciones.
            </TabsContent>
            <TabsContent value='directos' className='text-sm text-muted-foreground'>
              Los mensajes con los docentes.
            </TabsContent>
          </Tabs>
        </Section>

        <Section title='Selector segmentado'>
          <Tabs defaultValue='cursando' className='flex flex-col gap-3'>
            <SegmentedList aria-label='Tus materias'>
              <SegmentedTrigger value='cursando'>
                Cursando <span className='text-[0.6875rem] text-muted-foreground'>7</span>
              </SegmentedTrigger>
              <SegmentedTrigger value='final'>
                Falta final <span className='text-[0.6875rem] text-muted-foreground'>2</span>
              </SegmentedTrigger>
              <SegmentedTrigger value='aprobadas'>
                Aprobadas <span className='text-[0.6875rem] text-muted-foreground'>10</span>
              </SegmentedTrigger>
            </SegmentedList>
            <TabsContent value='cursando' className='text-sm text-muted-foreground'>
              Las materias del cuatrimestre.
            </TabsContent>
            <TabsContent value='final' className='text-sm text-muted-foreground'>
              Las regularizadas que falta cerrar.
            </TabsContent>
            <TabsContent value='aprobadas' className='text-sm text-muted-foreground'>
              Las aprobadas, por año de la carrera.
            </TabsContent>
          </Tabs>
        </Section>

        <Section title='Secciones plegables'>
          <CollapsibleCard title='Unidad 2: Derivadas' count='2 archivos' defaultOpen>
            <List>
              <ListItem
                title='resumen-derivadas.pdf'
                meta={
                  <>
                    <OriginBadge origin='discord' /> 52 KB · jue 5/11
                  </>
                }
              />
              <ListItem
                title='Guía de ejercicios 2'
                meta={
                  <>
                    <OriginBadge origin='moodle' /> 29/9
                  </>
                }
              />
            </List>
          </CollapsibleCard>
          <CollapsibleCard title='Unidad 1: Límites' count='2 archivos'>
            <List>
              <ListItem
                title='Guía de ejercicios 1'
                meta={
                  <>
                    <OriginBadge origin='moodle' /> 11/8
                  </>
                }
              />
              <ListItem
                title='Apunte de límites'
                meta={
                  <>
                    <OriginBadge origin='hackai' /> 11/8
                  </>
                }
              />
            </List>
          </CollapsibleCard>
        </Section>

        <Section title='Hoja desde abajo'>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant='outline' className='self-start'>
                <Download aria-hidden='true' /> Instalar
              </Button>
            </SheetTrigger>
            <IosInstallSteps />
          </Sheet>
        </Section>

        <Section title='Estados'>
          <div className='grid items-start gap-4 lg:grid-cols-2'>
            <EmptyState icon={CalendarDays} title='No tenés parciales ni entregas hasta el 24/11'>
              Lo próximo es el final de Álgebra y Geometría Analítica, el miércoles 9/12.
            </EmptyState>
            <Card role='status' className='flex flex-col gap-3 p-4'>
              <span className='sr-only'>Cargando</span>
              <Skeleton className='h-4 w-2/3' />
              <Skeleton className='h-3 w-1/2' />
              <Skeleton className='h-3 w-3/4' />
            </Card>
            <StaleNotice>
              <p>
                <b>El SIU no responde.</b> Te mostramos lo que leímos hoy a las 11:40, hace 20 min. Puede haber cambios
                que todavía no vemos.
              </p>
            </StaleNotice>
            <ErrorNotice>
              <p>
                <b>No pudimos traer las entregas de Moodle.</b> El resto de la pantalla está al día.
              </p>
              <Button size='sm' variant='outline'>
                <RotateCw aria-hidden='true' /> Reintentar
              </Button>
            </ErrorNotice>
            <OfflineNotice>
              <p>
                <b>Sin conexión.</b> Te mostramos lo último que guardamos, de hoy a las 11:40. Para inscribirte,
                escribir o subir material necesitás internet.
              </p>
            </OfflineNotice>
            <EmptyState icon={CircleCheck} title='Estás al día'>
              No hay avisos, material ni respuestas nuevas en tus materias desde ayer a las 18:40.
            </EmptyState>
          </div>
        </Section>
      </main>
    </AppShell>
  )
}
