---
name: ui-collage
description: Explorar pantallas de HackAI como mocks HTML clickeables, pensados primero para el celular, en una galería index.html con marcos de dispositivo que embeben pantallas independientes. Usar cuando se pidan «variantes de la pantalla X», «collage», «galería de pantallas», «prototipo clickeable» o «mocks de la feature Y», antes de codear una pantalla nueva o un estado nuevo.
---

# Galería de mocks de HackAI

Una galería `index.html` que muestra pantallas una al lado de la otra, cada una dentro de un marco de dispositivo. Cada pantalla es su propio archivo HTML: se abre sola («abrir»), se navega con clics y se captura.

- **Galería del recorte completo:** `docs/design/mocks/`.
- **Variantes de una pantalla puntual:** una galería nueva en `docs/design/variantes/<pantalla>/`, con la misma estructura y reutilizando `tokens.css`, `ui.css`, `app.js` y `data.js` de `mocks/`.

Lo que el equipo elige pasa a dos lugares: los valores visuales, al sistema visual de `hackai/` (ticket #8), y cada pantalla, como referencia del ticket que la construye.

## 1. Insumos, antes de dibujar

- **Qué mockear:** las capacidades de `docs/product/alcance.md` («Qué resuelve cada sistema», «El espacio de la materia» y «Recorte de la demo») y la spec #5. Si el pedido viene por tickets, leer cada uno con `gh issue view N -R ignaciogaspar/campus-hackai`: los criterios de aceptación deciden qué muestra cada pantalla. Si `gh` falla por red, reintentar; no inventar el contenido del ticket.
- **Qué ya existe:** mirar `hackai/app/` y `hackai/components/`. Mockear solo lo nuevo y marcar lo construido con la etiqueta «existe».
- **Lenguaje visual:** `docs/design/mocks/tokens.css` y `docs/design/direccion-de-diseno.md` son la única fuente de colores, tipografía, radios, espaciado y movimiento, con los colores de la Austral. Nunca inventar un valor: si falta un token, agregarlo a `tokens.css` y anotarlo en el doc de dirección. Si esos archivos todavía no existen, crearlos primero partiendo de los tokens de `hackai/app/globals.css`.
- **Vocabulario:** `GLOSSARY.md`, con los nombres exactos: Espacio de la materia, Canal, Canal externo, Mensaje directo, Comisión, Materia, Mesa de examen, Historia académica, Actuación provisoria, Constancia.
- **Dispositivos:** phone 390 por defecto, porque HackAI se piensa primero para el celular. Desktop 1440 solo para validar que el layout no se rompe en pantalla grande.
- **Modo:** claro por defecto. Si la dirección de diseño define un modo oscuro, una o dos pantallas en oscuro (`data-theme="dark"` en `<html>`) para validar los tokens.
- **Copy y datos:** español rioplatense con voseo, sin inglés filtrado. Todo sintético (regla de `AGENTS.md`): alumnos y docentes inventados, materias y comisiones creíbles de las facultades de la Austral, fechas variadas y números no redondos. Mensajes del sistema calmos y específicos, sin signos de exclamación.

## 2. Estructura de archivos

```
docs/design/mocks/
  index.html     galería: header + nav + una <section> por pantalla o flujo
  tokens.css     tokens (:root claro, [data-theme="dark"] si existe), fuentes vía @import
  ui.css         componentes en CSS plano (card, btn, chip, tabs, list, note, empty, skeleton…)
  app.js         compartido: íconos inline, shell (encabezado y navegación inferior Hoy ·
                 Materias · Académico), tabs/toggles/data-href, avisa su alto a la galería
                 (postMessage)
  data.js        todos los datos de ejemplo (window.HK = {...}); el copy se edita solo acá
  m-*.html       pantallas phone (390 × 844)
  d-*.html       pantallas desktop (1440 × 994)
  img/           imágenes locales (descargadas, nunca hotlinkeadas)
  shoot.sh       capturas con Chrome headless → shots/vN/*.png (shots/ no se commitea)
```

Cada pantalla es un documento completo (`<!doctype html>`, charset, viewport, `tokens.css`, `ui.css`, `data.js`, `app.js`). Declara el shell con atributos del body (`data-active`, `data-title`, `data-rol="alumno|docente"`, `class="d"` para desktop) y pone el contenido en `#page` (y las acciones del encabezado en `#act`). **Los estados viven en query params** (`?estado=error`, `?estado=desactualizado`, `?rol=docente`, `?dialogo=1`), así un archivo cubre varios frames.

## 3. La galería (`index.html`)

- **Header:** wordmark HackAI, título «Pantallas de la demo · propuesta de UI v1», una explicación corta, una pill «Datos de ejemplo, nada es real» y una nav de pills a cada sección.
- **Secciones** (una por pantalla o flujo del recorte): Ingreso, Hoy, Mis materias, Espacio de la materia, Inscripción en un paso, Académico y Docente.
- **Cada sección:**
  - un `h2` «N · Título» y chips con los tickets que la construyen (#N);
  - un párrafo que describe el comportamiento (las reglas, no los píxeles);
  - los estados extra como links inline;
  - una lista `data-frames`, con una línea por frame: `kind|src|caption|note` (`m` = phone, `d` = laptop).
- **El script convierte cada línea en:**
  - phone: `.phone` (bisel negro de 410 px, radio 52) › `iframe` 390 × 844;
  - laptop: `.desk` (bisel de 864 px con 3 puntos) › `.vp` 840 × 580 › `iframe` 1440 × 994 con `transform: scale(.5834)`;
  - `figcaption`: caption + link «abrir» + nota.
- **Query params de la galería:**
  - `?full=1`: los iframes crecen al alto de su contenido vía postMessage;
  - `?s=<sección>`: solo esa sección;
  - `?bare=1`: sin header ni footer;
  - `?measure=1`: escribe `H=<px>` en el title para shoot.sh.

Renderer mínimo:

```js
const parse = s => s.trim().split('\n').map(l => l.trim().split('|'));
document.querySelectorAll('[data-frames]').forEach(el => {
  el.innerHTML = parse(el.dataset.frames).map(([k, src, t, d]) => k === 'm'
    ? `<figure><div class="phone"><iframe src="${src}" title="${t}"></iframe></div><figcaption>${t} <a href="${src}" target="_blank">abrir</a><small>${d||''}</small></figcaption></figure>`
    : `<figure><div class="desk"><div class="vp"><iframe src="${src}" title="${t}"></iframe></div></div><figcaption>${t} <a href="${src}" target="_blank">abrir</a><small>${d||''}</small></figcaption></figure>`).join('');
});
```

## 4. Reglas de contenido

- **Frames:** 2 a 4 por sección. A lo largo de la galería tienen que aparecer los estados:
  - vacío, que explica por qué está vacío;
  - cargando: skeleton con la forma del layout, no spinner;
  - error;
  - desactualizado: «actualizado hace 20 min» cuando el SIU o Moodle no responden.
- **Origen a la vista:** todo mensaje y todo material lleva su etiqueta de origen (HackAI, Discord, Moodle, SIU). Lo que vino de Discord sin cuenta vinculada muestra el nombre de Discord y «desde Discord».
- **Reglas del espacio de la materia** (alcance y ADR 0005):
  - el alumno ve los canales de la materia y los de su comisión, nunca los de otra comisión;
  - en `#avisos` escriben solo los docentes;
  - las consultas muestran si están resueltas, y todos ven las respuestas;
  - los mensajes directos son solo entre alumno y docente: no hay botón para escribirle a otro alumno.
- **Inscripción en un paso:** aparecen el comprobante, «sin cupo», «fuera de período» y «requiere autogestión». Este último se muestra como un paso más, con el enlace al SIU, no como un error.
- **Los dos roles:** cada sección que cambia según el rol muestra el frame de alumno y el de docente.
- **Controles estándar** (modo Operate de impeccable): la navegación se lee como navegación, los inputs como inputs y las listas como listas. El mundo visual aporta tipografía, paleta, densidad y un movimiento firma; no reemplaza los controles.
- **Marcas:** lo nuevo va con «Nuevo» o un punto, y lo ya construido con «existe».
- **Íconos:** como SVG inline (paths de Phosphor en `app.js`), no sprite externo, porque `<use>` desde otro archivo falla en `file://`.

## 5. Capturas y QA

`shoot.sh vN` mide el alto de cada sección (`?s=X&bare=1&full=1&measure=1` con `--dump-dom`) y la captura a ese alto, más una `0-galeria.png` general. Usa Chrome en `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` con `--headless=new --hide-scrollbars --allow-file-access-from-files --virtual-time-budget=15000`.

**Mirar cada PNG** (herramienta Read) y corregir antes de terminar:
- overflow y textos cortados;
- iframes o imágenes rotas;
- copy en inglés o sin voseo;
- todo lo que no entre a 390 px.

Probar por `file://` y por `python3 -m http.server`. Si el plugin impeccable está instalado, correr `impeccable detect --json` sobre la carpeta y corregir lo mecánico.

## 6. Entrega

Reportar la carpeta, las pantallas por sección, el PNG general y cada supuesto tomado donde el alcance o los tickets eran ambiguos; eso es lo que el equipo revisa. Los mocks van al repo por PR (sin `shots/`). Para compartir con alguien sin acceso al repo, copiar la carpeta al scratchpad y publicar `index.html` como Artifact con el resto en `files`; arranca privado.

## Cómo correrla

Es larga: cerca de 30 minutos y más de 100 llamadas a herramientas. Por el ADR 0003 no se lanza como subagente con el Agent tool. Correla en una sesión propia, con un brief que incluya:
- las secciones y los frames;
- los documentos a leer (`docs/design/direccion-de-diseno.md`, `docs/design/mocks/tokens.css`, `GLOSSARY.md`, `docs/product/alcance.md` y los tickets);
- la carpeta de salida;
- la regla «no commitear ni publicar hasta que el equipo elija»;
- el formato de reporte de la sección 6.
