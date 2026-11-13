---
status: accepted
date: 2026-11-12
---

# El SIU real se lee y se escribe con la sesión del propio alumno

Para la demo del 13/11, HackAI tiene que funcionar con la cuenta real de un integrante del equipo, en vivo: sus materias, horarios, notas, carrera e inscripciones abiertas, y además inscribirse y darse de baja (issue #90). Hasta acá, SIU y Moodle eran simulados y la regla dura del `AGENTS.md` decía «SIU y Campus reales: solo lectura». Research: `docs/research/2026-11-12-datos-reales-siu-campus.md`.

## Opciones consideradas

- **API REST de Guaraní (`/rest/v2/`):** la vía oficial, pero pide un usuario de la institución. Queda como el camino de producción, a pedirle a la Austral. Hoy no es posible.
- **Que HackAI inicie sesión por el alumno:** el SIU solo ofrece SAML con Microsoft Entra, con posible doble factor. Habría que manejar la clave de Microsoft del alumno. Rechazada.
- **Leer y escribir la Autogestión (3W) con la cookie de sesión del alumno**: los mismos pedidos que hace la pantalla, con su sesión, que el alumno pega en HackAI. Elegida.

## Decisión

- Cualquiera de la Austral entra con su cuenta desde el ingreso en la compu (`/entrar-con-siu`); en el celular, HackAI usa las personas de la demo, porque el navegador del teléfono no deja copiar la cookie. Una app nativa con el login del SIU embebido, como la de Moodle, lo resolvería: queda para después.
- Desde la compu, pega su sesión del SIU, acepta cómo se usa, y HackAI lo reconoce con un HMAC de su documento. Prendido por defecto; `HACKAI_SIU_REAL_PUBLICO=no` lo apaga. La sesión viaja cifrada en una cookie de su navegador y se arma su cuenta en cada pedido (`lib/adapters/siu-real/registry.ts`, `lib/siu-session.ts`). Con `HACKAI_SIU_REAL=si`, además, una cuenta fija desde `.env.local`.
- `lib/adapters/siu-real/` envuelve al SIU elegido. Responde por cada persona real con lo que muestra su Autogestión, con ids propios por cuenta, y todo lo demás lo pasa al SIU de la demo, cuyas personas siguen en el ingreso.
- Lee en vivo: vuelve a leer el SIU cada `HACKAI_SIU_REAL_SEGUNDOS` (20 por defecto), y la pantalla abierta se redibuja sola si algo cambió. Una nota que aparece después de la primera lectura se avisa en el momento con una notificación del navegador.
- Además inscribe, da de baja y pide la constancia de alumno regular de verdad: abre la pantalla, toma el formulario con su `__csrf` fresco y lo manda como el botón. Cada acción pasa por un paso de confirmación en HackAI (la solicitud de constancia muestra qué se va a pedir y pide «Confirmar y pedir»), porque desde HackAI no se deshace. Prendido por defecto; `HACKAI_SIU_ESCRITURAS=no` lo apaga y manda a la Autogestión.
- La regla dura pasa a ser: al relevar en el navegador, solo lectura; escribir en el SIU real solo lo hace HackAI, con la cuenta de quien lo pide y su confirmación.

## Consecuencias

- La sesión del SIU es la llave de la cuenta, con permiso para inscribir y dar de baja. Va cifrada en la cookie del navegador de su dueño (o, la cuenta fija, en `.env.local`), nunca en logs ni en la base. Lo leído vive en memoria del proceso.
- Pasan por el servidor sesiones y datos de terceros (Ley 25.326): cada persona da su consentimiento antes de entrar, su sesión no se guarda en el servidor (solo cifrada en su navegador) y lo leído vive en memoria. Las condiciones de uso de la Austral sobre acceso automatizado: no encontradas.
- En el hosting sin estado, una instancia nueva del servidor tiene que leer todo de nuevo: la primera pantalla de cada persona puede tardar unos segundos.
- La sesión vence y no se puede renovar sola: hay que pegar una cookie nueva. Si el SIU deja de responder, se muestra lo último leído hasta cinco minutos.
- Leer HTML de pantallas es frágil: un cambio del SIU rompe un parser. Cada parser tiene su test con el marcado relevado.
- Una inscripción de HackAI es una inscripción real. La primera prueba contra la cuenta la confirma su dueño.
- Decidido por el equipo el 2026-11-12: leer y escribir, abierto a cualquiera de la Austral, prendido para la demo. Cambia la decisión 4 de `docs/product/preguntas-abiertas.md` («¿Qué es real y qué está simulado en la demo?»).
