# campus/: de dónde sale y cómo se trata

`campus/` es una copia del repo de Nacho (Campus Austral). Está en este repo para leerlo como referencia y para probar que nuestras features se le pueden aplicar. Nuestro código vive en `hackai/`.

## Origen

- **Qué es:** el zip `campus-aicm` que pasó Nacho, recibido el 10/11/2026.
- **Sin git:** el zip no trae historial. No sabemos de qué commit es ni si hay una versión más nueva.
- **Cómo entró:** un commit propio, `chore: snapshot de campus (zip de Nacho, sin historial de git)`.

## Reglas

1. **`campus/` no se edita.** Ni un arreglo chico. Un cambio a mano hace que el diff contra el repo de Nacho deje de ser confiable, y eso es lo que le entregamos.
2. **Se reemplaza entero.** Cuando Nacho pase una versión nueva, `scripts/sync-campus.sh` cambia la carpeta completa (skill `sync-campus`).
3. **En un commit aparte**, que solo toca `campus/`, con el mensaje `chore: actualizar snapshot de campus`. Así el historial separa lo de Nacho de lo nuestro.
4. **Después de cada reemplazo**, anotar acá la fecha y qué cambió en «Historial de snapshots», y revisar si se resolvió algo de «Qué falta y qué está roto».
5. **Un problema de campus se le avisa a Nacho**, no se arregla acá. Si bloquea a `hackai/`, se resuelve del lado de `hackai/`.

## Qué falta y qué está roto

Estado del snapshot del 10/11/2026. Detalle en la [nota del análisis](research/2026-11-10-repo-campus-nacho.md).

**Falta en el zip**

- `lib/content/server`. Lo importan `app/campus/conceptos/page.tsx`, `components/conceptos/ConceptoParts.tsx` y `lib/jornadas.ts`. Por eso `npm run typecheck` falla con 15 errores en esos 3 archivos.
- El contenido de las jornadas (`content/` trae solo los tipos), `public/decks` y `docs/shots`.
- `content/hackai` existe y está vacía. Parece el lugar reservado para la hackathon; a confirmar con Nacho.
- `.env.example`. Variables que hacen falta: un proyecto Supabase propio, `SESSION_SECRET`, `PROFESSOR_ACCESS_CODE` y `ANTHROPIC_API_KEY`.

**No corre**

- Los seeds: `scripts/seed/base.ts` importa del repo hermano `../mbt`, que no vino. Sin eso no hay curso, jornadas ni padrón de prueba. Cada feature de `hackai/` trae su seed propio.
- No se probó `next build`, la app, ni las migraciones: no hay base ni credenciales.

**Sí corre:** `tests/learning.test.ts`, `tests/assignments.test.ts` y `tests/learning-flow.ts`.

**Documentación desactualizada.** Si un doc de campus choca con el código, vale el código:

- `SPEC.md` dice que el curso va del 10/11 al 03/12; el README, del 12/11 al 10/12.
- `SPEC.md` pide migraciones `01NN`; la serie real va por 0230, repetido en dos archivos.
- `CONTRACTS.md` describe mal los scripts npm y la navegación.

**Campus rompe sus propias reglas** en varios lugares: migraciones que alteran tablas existentes, una página sin `requireSession` (`app/profesor/bienvenida`), ids de modelo duplicados fuera de `lib/claude.ts`, tres variantes de helpers de API, errores de base que se tragan. El código de `hackai/` sigue la regla escrita.

**Bloqueo conocido para rutas nuevas de alumno:** `middleware.ts` redirige todo `/campus` a la bienvenida hasta el 12/11 a las 18:30, salvo excepciones o la variable `CAMPUS_ABRE`.

**Para avisarle a Nacho (seguridad; no bloquean una feature):**

- `GET /salir` cierra la sesión en todos los dispositivos.
- El servidor MCP no limita pedidos y acepta el token en la URL.
- El cupo diario del tutor se puede pasar con pedidos simultáneos.
- Algunos errores 500 devuelven el mensaje interno.

## Cómo se le entrega código a Nacho

`scripts/port-to-campus.sh` copia las rutas de una feature de `hackai/` a una copia de campus y muestra el diff (skill `port-to-campus`). Ese diff es lo que se le manda. Antes de armarlo, el workflow `mergeable-check` revisa la feature contra el [checklist de compatibilidad](research/2026-11-10-repo-campus-nacho.md#11-checklist-para-que-el-código-sea-mergeable).

El diff tiene dos partes: archivos nuevos de la feature, que entran sin conflicto, y los toques a archivos compartidos (menú, middleware, `package.json`), que Nacho mergea a mano. Cómo quiere recibirlo (PR, parche, zip) está sin definir: pregunta N7 de [preguntas-abiertas.md](product/preguntas-abiertas.md).

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
4. Actualizar `scripts/sync-campus.sh`, la skill `sync-campus` y la sección «Origen» de este archivo para que apunten al subtree, y registrar el cambio en un ADR que reemplace esa parte del [ADR 0001](adr/0001-repo-envoltorio-con-campus-vendorizado.md).
5. Comparar el primer subtree contra el zip: confirmar que aparece `lib/content/server` y que el typecheck pasa, y actualizar «Qué falta y qué está roto».

`git subtree push` no se usa: la entrega a Nacho sigue siendo el diff de `port-to-campus`, o un PR desde un clon de su repo si él lo prefiere.

## Historial de snapshots

| Fecha | Origen | Notas |
| --- | --- | --- |
| 2026-11-10 | Zip `campus-aicm` de Nacho | Primer snapshot. Incompleto: ver arriba |
