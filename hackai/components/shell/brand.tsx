/* La marca en el encabezado: el escudo de texto «UA», Universidad Austral y,
   debajo, la facultad o el nombre del sistema. Es una marca de texto hasta que
   esté el archivo del logo. */
export function Brand({ sub }: { sub: string }) {
  return (
    <span className='inline-flex items-center gap-2 leading-[1.1]'>
      <span aria-hidden='true' className='grid size-[30px] flex-none place-items-center rounded-lg bg-white text-xs font-extrabold text-navy'>
        UA
      </span>
      <span>
        <span className='block text-[0.8125rem] font-extrabold'>Universidad Austral</span>
        <span className='block text-[11px] text-header-sub'>{sub}</span>
      </span>
    </span>
  )
}
