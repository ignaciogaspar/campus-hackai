---
name: port-to-campus
description: Llevar una feature de hackai/ a una copia de campus y armar el parche para Nacho. Usar cuando una feature está lista para entregar, o para ver qué diff produciría sobre campus.
---

El entregable para Nacho es un diff sobre **su** repo. Se arma en una copia de campus fuera de este repo; `campus/` queda intacto.

## Pasos

1. **Confirmar que la feature está lista.** El workflow `mergeable-check` corrió sobre el estado actual sin hallazgos abiertos y existe `hackai/docs/<FEATURE>.md`. Si falta algo, volvé a la skill `campus-feature`.

2. **Copiar.** Desde la raíz del repo:

   ```
   scripts/port-to-campus.sh <feature> [destino]
   ```

   Sin `destino`, el script trabaja sobre una copia temporal de `campus/`. Con `destino`, sobre esa carpeta: usá el clon del repo de Nacho si lo tenemos, en una rama nueva, porque el snapshot de `campus/` está incompleto y puede estar viejo. El script copia las rutas de compatibilidad de la feature (saltea los archivos «compat» de `hackai/compat.txt`), muestra el diff y deja `<feature>.patch` en una carpeta temporal cuya ruta imprime; los cambios quedan en el index del destino, sin commitear.

3. **Revisar el diff.** Cada archivo del diff es nuevo y está dentro de las rutas de la feature. Un archivo modificado, o uno fuera de esas rutas, es un hallazgo: se corrige en `hackai/` y se vuelve a correr el script.

4. **Listar lo que el script no copia.** Son los archivos compartidos, que Nacho (o nosotros en su clon) toca a mano. Sacá cada cambio de la sección «Archivos y pasos» del doc de la feature y escribilo como línea exacta a agregar:

   - `lib/routes.ts`: la línea del menú (`ALUMNO_NAV` o `PROFESOR_NAV`).
   - `middleware.ts`: la excepción para la ruta nueva de alumno, o el aviso de que depende de `CAMPUS_ABRE`.
   - `app/campus/page.tsx` y `app/profesor/page.tsx`: solo si la feature aparece en la home.
   - `package.json`: el script de test.
   - Número de migración: el que usamos y que hay que confirmarlo contra las migraciones que él tenga.

5. **Verificar en el destino**, si es un clon completo: `npm ci`, `npm run typecheck`, `npm run build` y los tests de la feature. Sobre la copia del snapshot el typecheck ya falla de entrada (falta `lib/content/server`, ver `docs/campus-upstream.md`): ahí alcanza con que los errores sean los mismos que antes de copiar.

6. **Armar el entregable** y mostrárselo al usuario:

   - El `.patch` que dejó el script, o la rama lista para un PR si trabajaste en el clon.
   - Una nota corta para Nacho: qué hace la feature, la migración y su número, la lista del paso 4, qué se verificó y qué no, qué datos son sintéticos.

7. **Parar.** Abrir un PR, pushear al repo de Nacho o mandarle un mensaje lo hace el usuario, o vos solo después de que el usuario lo confirme en esta conversación para ese envío puntual.
