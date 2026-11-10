# campus/: de dónde sale y cómo se trata

`campus/` es una copia del repo de Nacho (Campus Austral). Está en este repo como referencia de su lógica: la leemos y reimplementamos en `hackai/` lo que nos sirva, sin copiar código (ADR 0004). Para HackAI, Campus Austral es un sistema de origen más.

## Origen

- **Qué es:** el zip `campus-aicm` que pasó Nacho, recibido el 10/11/2026.
- **Sin git:** el zip no trae historial. No sabemos de qué commit es ni si hay una versión más nueva.
- **Cómo entró:** un commit propio, `chore: snapshot de campus (zip de Nacho, sin historial de git)`.

## Reglas

1. **`campus/` no se edita.** Ni un arreglo chico: así el diff entre dos snapshots muestra solo lo que cambió Nacho.
2. **Se reemplaza entero.** Cuando Nacho pase una versión nueva, `scripts/sync-campus.sh` cambia la carpeta completa (skill `sync-campus`).
3. **En un commit aparte**, que solo toca `campus/`, con el mensaje `chore: actualizar snapshot de campus`.
4. **Después de cada reemplazo**, anotar acá la fecha y qué cambió en «Historial de snapshots», y revisar si se resolvió algo de «Qué falta y qué está roto».
5. **Un problema de campus se le avisa a Nacho**, no se arregla acá.

## Qué falta y qué está roto

Estado del snapshot del 10/11/2026. Detalle en la [nota del análisis](research/2026-11-10-repo-campus-nacho.md).

**Falta en el zip**

- `lib/content/server`. Lo importan `app/campus/conceptos/page.tsx`, `components/conceptos/ConceptoParts.tsx` y `lib/jornadas.ts`. Por eso `npm run typecheck` falla con 15 errores en esos 3 archivos.
- El contenido de las jornadas (`content/` trae solo los tipos), `public/decks` y `docs/shots`.
- `.env.example`.

**No corre**

- Los seeds: `scripts/seed/base.ts` importa del repo hermano `../mbt`, que no vino. Sin eso no hay curso, jornadas ni padrón de prueba.
- No se probó `next build`, la app, ni las migraciones: no hay base ni credenciales.

**Sí corre:** `tests/learning.test.ts`, `tests/assignments.test.ts` y `tests/learning-flow.ts`.

**Documentación desactualizada.** Si un doc de campus choca con el código, vale el código:

- `SPEC.md` dice que el curso va del 10/11 al 03/12; el README, del 12/11 al 10/12.
- `SPEC.md` pide migraciones `01NN`; la serie real va por 0230, repetido en dos archivos.
- `CONTRACTS.md` describe mal los scripts npm y la navegación.

**Para conectarlo a HackAI:** su README dice que está desplegado en `campus-austral.vercel.app`, y su servidor MCP tiene herramientas para el alumno, como `my_pending`. Su `middleware.ts` redirige todo `/campus` a la bienvenida hasta el 12/11 a las 18:30, salvo excepciones o la variable `CAMPUS_ABRE`.

**Para avisarle a Nacho (seguridad):**

- `GET /salir` cierra la sesión en todos los dispositivos.
- El servidor MCP no limita pedidos y acepta el token en la URL.
- El cupo diario del tutor se puede pasar con pedidos simultáneos.
- Algunos errores 500 devuelven el mensaje interno.

## Si Nacho da acceso a git: pasar a subtree

Con una URL de su repo, `campus/` deja de ser un snapshot manual y pasa a ser un `git subtree`. La carpeta sigue en el mismo lugar y las reglas no cambian; cambia cómo se actualiza.

1. Con el árbol limpio, borrar el snapshot en un commit propio:
   ```sh
   git rm -r -q campus
   git commit -m "chore: quitar snapshot de campus para pasar a subtree"
   ```
2. Traer su repo en la misma ruta:
   ```sh
   git subtree add --prefix=campus <url-del-repo-de-nacho> <rama> --squash
   ```
3. Para actualizar, en lugar de `scripts/sync-campus.sh`:
   ```sh
   git subtree pull --prefix=campus <url-del-repo-de-nacho> <rama> --squash
   ```
4. Actualizar `scripts/sync-campus.sh`, la skill `sync-campus` y la sección «Origen» de este archivo para que apunten al subtree.

## Historial de snapshots

| Fecha | Origen | Notas |
| --- | --- | --- |
| 2026-11-10 | Zip `campus-aicm` de Nacho | Primer snapshot. Incompleto: ver arriba |
