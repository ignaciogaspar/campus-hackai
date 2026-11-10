# Decks HTML (kind = 'html') en el campus

El deck de Empresas Familiares es un sitio estático en `public/decks/empresas-familiares/`
(`index.html`, `deck.css`, `nav.js`, `media/`, `tools/`). Se sirve en
`/decks/empresas-familiares/index.html`. Hay que poner `index.html` explícito porque
`/decks/<id>` lo atiende `app/decks/[id]`.

## Piezas

- `public/decks/empresas-familiares/campus-bridge.js` (lo incluye `index.html` después de `nav.js`) maneja el protocolo de postMessage. Acepta solo mensajes del mismo origen que vienen de `window.parent`. `nav.js` tiene tres agregados mínimos: expone `window.deckNav`, emite el evento `deck:slide`, escucha `hashchange`, respeta `html.campus-locked` y centra el escenario con posición absoluta en `fit()` (con el grid original, en un iframe angosto como el del celular la slide quedaba fuera de cuadro).
- `components/htmldeck/HtmlDeckStage.tsx` es el iframe controlado.
- `lib/htmldeck/types.ts` tiene los tipos del protocolo, `EMPRESAS_FAMILIARES` y `htmlDeckSrc()`.
- `lib/htmldeck/extract.ts` extrae el texto del HTML sin DOM. Lo usa la seed.
- `lib/htmldeck/ids.ts` define `htmlSlideId(deckId, n)`, el uuid v5 de cada slide.
- `scripts/seed/htmldeck.ts` crea:
  - el curso `empresas-familiares`;
  - el deck `kind='html'` con `html_url` y `html_slide_count = 90`;
  - 90 filas en `slides` (`kind='html'`, markdown `:::default` con el texto, `teacher_notes` sacadas de `aside.notes`, `origin {deck, position, html}`);
  - el `deck_slides` en el orden del HTML.

  Con `--remove` se deshace.
- `app/api/decks/empresas-familiares/redesign/route.ts` es el agente del local 3D (`tools/local3d.html`). Pide sesión del campus.

## Posiciones

La posición del campus va de 0 a 89. Es la misma que `deck_slides.position` y que
`live_sessions.current_position`, y corresponde a `#N+1` en el sitio. Por eso
`getDeck('empresas-familiares', audience)` funciona igual que con un deck nativo.
Sirve para marcas y notas por slide, analítica, biblioteca y para el contexto del
agente (títulos por posición, más el texto y las notas de la slide actual).

## Protocolo

| Dirección | Mensaje |
| --- | --- |
| padre → deck | `{type:'goto', n}`, `{type:'state'}`, `{type:'outline'}`, `{type:'lock', locked}`, `{type:'chrome', visible}` |
| deck → padre | `{source:'campus-htmldeck', type:'ready'\|'position', n, total, slide}`, `{source:'campus-htmldeck', type:'outline', total, slides:[{n, kicker, title, sub, text, notes, images}]}` |

## HtmlDeckStage

```tsx
import { HtmlDeckStage } from '@/components/htmldeck'

<HtmlDeckStage
  htmlUrl={deck.htmlUrl!}           // '/decks/empresas-familiares/index.html'
  position={position}               // 0-based, controlada
  onPosition={(n, total, from) => { /* from: 'deck' = navegaron adentro del iframe */ }}
  onReady={(total) => {}}
  onOutline={(slides) => {}}        // texto por slide; notas solo con withNotes
  withNotes                         // solo para el profesor
  locked={false}                    // true = el deck no navega por teclado/clic propio
  chrome={false}                    // botonera propia del deck (default oculta)
/>
```

- El iframe ocupa el 100% del contenedor y el deck se escala solo a 16:9 con bandas. Dale al contenedor un alto, por ejemplo `position:absolute; inset:0` en el proyector o `aspect-ratio:16/9` en el celular.
- El `src` se fija al montar: la posición inicial va en el hash y después se navega sin recargar.
- El ref (`HtmlDeckStageHandle`) expone `requestOutline()` y `focus()`.

## Cómo cablearlo (integrador)

### `/live/[id]` (proyector y consola)

Cuando `deck.kind === 'html'`, en lugar de `<SlideView>`/`<DeckPlayer>` renderizá:

```tsx
<div style={{ position: 'relative', width: '100%', height: '100%' }}>
  <HtmlDeckStage
    htmlUrl={deck.htmlUrl!}
    position={state.position}
    withNotes
    onPosition={(n, _total, from) => { if (from === 'deck') gotoSlide(n) }}
  />
  <Overlay … />   {/* la capa en vivo va ENCIMA del iframe, con position:absolute */}
</div>
```

- `gotoSlide(n)` es la misma action o endpoint que usa la consola para cambiar de slide: actualiza `live_sessions.current_position` y llama a `broadcastState`. Así, si el profesor usa las flechas con el foco dentro del iframe, la clase sigue.
- Las teclas del campus, como `M` para el micrófono, no llegan si el foco está en el iframe. Dejá `locked` en false para que las flechas del deck sigan andando, o bloquealo y manejá las flechas desde la consola: `locked` más tu propio handler, que llama a `gotoSlide`.
- El agente en vivo no necesita el outline: `getDeck(deckId, 'profesor')` ya trae `title`, `markdown` (con el texto) y `teacherNotes` por posición. `onOutline` queda como alternativa en el cliente.
- `deck.changed` no aplica: el HTML no cambia en vivo. `insert_slide` y `edit_slide` no tienen sentido en un deck HTML, así que el agente tendría que deshabilitarlas cuando `deck.kind === 'html'`. Los overlays (encuesta, QR, sorteo, timer, mensaje) funcionan igual porque van por encima.

### `/s/[code]` (alumno)

```tsx
<div style={{ width: '100%', aspectRatio: '16 / 9' }}>
  <HtmlDeckStage htmlUrl={deck.htmlUrl!} position={followMode ? state.position : myPos} locked={followMode}
    onPosition={(n, _t, from) => { if (from === 'deck') setMyPos(n) }} />
</div>
```

Las marcas y notas usan `slides[position].id` de `getDeck` igual que en un deck nativo.

### `/campus/decks/[id]`, `/decks/[id]` y `/profesor/decks/[id]`

Con `kind === 'html'` usá `HtmlDeckStage` no controlado: `position` en estado local y `onPosition` que lo actualiza. El editor de markdown no aplica: mostrá las slides en solo lectura y dejá editar solo las notas del docente.
