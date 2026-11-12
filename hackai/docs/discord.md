# Bot de Discord para HackAI

Cómo crear el bot que usa el adaptador de Discord (`lib/adapters/discord/`), cargar su token y probarlo contra el servidor del equipo. Por qué funciona así (REST sin gateway, intent, 429): [research de canales externos](../../docs/research/2026-11-10-canales-externos-apis.md).

El token del bot es la contraseña del bot, no la de tu cuenta: quien lo tiene escribe como HackAI. Va solo en `hackai/.env.local`. Nunca en el chat, un issue, un commit ni una captura; si se filtra, se genera otro con **Reset Token**.

## 1. Sin Discord: los tests

Usan un Discord falso, así que no piden token ni red. Desde `hackai/`:

```bash
npm test
```

Tienen que terminar con `fail 0`.

## 2. Crear el bot (una vez por equipo)

1. Entrá al [Developer Portal](https://discord.com/developers/applications). Si pregunta «¿Qué te trae al Portal?», elegí solo **Crear un bot**. Tocá **New Application** y ponele `HackAI`.
2. En **Bot**:
   - **Reset Token**, copiá el token y pegalo en `hackai/.env.local` (paso 3).
   - En **Privileged Gateway Intents**, activá **Message Content Intent** y guardá. Sin él, los mensajes llegan con el texto y los adjuntos vacíos. En menos de 100 servidores se activa sin revisión.
3. En **General Information**, copiá el **Application ID**. No es secreto.
4. Invitá el bot al servidor abriendo esta URL con tu Application ID. Hace falta poder gestionar el servidor. Si vas a usar **Conectar con Discord** (sección 7), no hace falta: ese botón agrega el bot.

```text
https://discord.com/oauth2/authorize?client_id=APPLICATION_ID&scope=bot&permissions=309506149392
```

`309506149392` son los permisos que usa el adaptador: ver canales, enviar mensajes, leer el historial, crear hilos públicos, enviar mensajes en hilos, **gestionar canales** y **gestionar roles**. Los dos últimos son para crear los canales de una materia con sus permisos (sección 7); el bot que se invitó antes con `309237713920` sincroniza igual, pero no puede crearlos. Si el canal tiene permisos propios, el rol del bot los necesita también ahí. El bot aparece desconectado en la lista de miembros: es normal, porque no mantiene una conexión abierta.

El bot del equipo ya existe (Application ID `1569889274470334484`). Para usarlo en otra máquina, pedí el token a quien lo creó por un canal privado, o generá uno nuevo con **Reset Token**, que invalida el anterior.

## 3. Cargar el token

Desde `hackai/`:

```bash
cp .env.example .env.local
```

En `hackai/.env.local`:

```text
DISCORD_BOT_TOKEN=el-token-del-bot
```

## 4. Sacar el id de un canal

1. En Discord: engranaje ⚙️ (abajo a la izquierda) → **Avanzado** → activá **Modo desarrollador**.
2. Clic derecho sobre un canal de texto del servidor → **Copiar ID del canal**. Es un número de 18 o 19 dígitos.

Usá un canal de prueba: la prueba completa publica mensajes.

## 5. Probar contra Discord

Desde `hackai/`. Solo lectura, sin publicar nada:

```bash
npm run discord:probar -- ID_DEL_CANAL --solo-leer
```

Prueba completa (lee, publica un mensaje, le responde en un hilo y relee desde el cursor):

```bash
npm run discord:probar -- ID_DEL_CANAL
```

El script imprime ids y resultados, nunca el texto de los mensajes. Si encuentra adjuntos, baja el último e imprime su tamaño: para probar la descarga, subí antes un archivo al canal.

Salida esperada de la prueba completa:

```text
Leídos N mensajes; cursor ...
Publicado ...
Respondido ... en el hilo ...
Releer desde el cursor trae el mensaje y la respuesta: OK
```

| Síntoma | Causa |
| --- | --- |
| «Todos los mensajes llegaron vacíos» o `0 caracteres` en todos | Falta Message Content Intent (paso 2) |
| `falla-externa` | Token mal copiado, o el bot sin permisos en ese canal |
| `canal-inexistente` | Id mal copiado, o el bot no está en ese servidor |
| «Falta DISCORD_BOT_TOKEN» | No existe `hackai/.env.local` o la línea está vacía |

## 6. Usarlo en la app

En `hackai/.env.local`:

```text
HACKAI_EXTERNAL_CHANNEL=discord
DISCORD_BOT_TOKEN=...
```

Sin `HACKAI_EXTERNAL_CHANNEL`, la app usa el canal externo en memoria con los datos sintéticos. Sus canales son los del set sintético: `1301000000000000001` (avisos de AM1, comisión A), `1301000000000000002` (consultas) y `1301000000000000003` (material).

## 7. Conectar con Discord y crear los canales (el camino del docente)

Dos botones en el espacio de la materia, en la tarjeta **Discord de la cátedra**, que ve solo el docente que lo gestiona:

1. **Conectar con Discord** lleva a la página de autorización de Discord (OAuth2, scopes `bot` e `identify`). El docente elige el servidor de su cátedra (Discord pide que pueda gestionarlo) y el bot se agrega con los permisos de la sección 2. Al volver a HackAI, su cuenta de Discord queda vinculada con su persona en Personas y el espacio recuerda el servidor. La vuelta lleva un `state` firmado con `SESSION_SECRET`, de un solo uso y que vence en 10 minutos (`lib/oauth-state.ts`): una vuelta que no empezó en HackAI, que se repite o que es de otra persona va a `/discord/rechazado`.
2. **Crear canales en Discord** crea una categoría con el nombre de la materia y adentro un canal por cada canal del espacio que el docente gestiona y no está vinculado: `#material`, y `#avisos-a` y `#consultas-a` por cada comisión que dicta. Los deja vinculados y con permisos: en avisos y material escriben solo los docentes (un rol `Docentes · <materia>` que se les da a los docentes con cuenta vinculada) y el bot; en consultas, todos. Si un canal ya está vinculado, no se crea otro. Si Discord falla a mitad de camino, lo creado queda vinculado y volver a tocar crea lo que falta.

Con el servidor conectado, **Vincular con un canal de Discord** muestra además la lista de canales de texto del servidor para elegir uno, si la cuenta de Discord del docente es miembro de ese servidor.

**Qué configurar, una vez por equipo:**

1. En el [Developer Portal](https://discord.com/developers/applications), en la aplicación `HackAI` → **OAuth2**:
   - En **Redirects**, agregá la URL de vuelta de cada lugar donde corre HackAI, exacta: `http://localhost:3000/discord/vuelta` para la compu y `https://<dominio del hosting>/discord/vuelta` para el hosting. Si la de un lugar no es `<origen>/discord/vuelta` (por ejemplo, detrás de un proxy), fijala con `DISCORD_REDIRECT_URI`.
   - **Reset Secret** y copiá el Client Secret.
2. En **Bot**, dejá **Public Bot** activado para que cualquier docente pueda agregarlo a su servidor (apagado, solo puede quien creó la aplicación), y **Requires OAuth2 Code Grant** apagado.
3. En `hackai/.env.local` y en el hosting, además de `DISCORD_BOT_TOKEN` y `HACKAI_EXTERNAL_CHANNEL=discord`:

```text
DISCORD_CLIENT_ID=el-application-id
DISCORD_CLIENT_SECRET=el-client-secret
```

El Client Secret, como el token, va solo en `.env.local` y en el hosting. Sin estas dos variables la tarjeta no ofrece **Conectar con Discord** y queda vincular a mano (abajo).

4. Con `HACKAI_STORE=supabase`, aplicá `supabase/migrations/0005_spaces_external_server.sql`, que guarda el servidor de cada espacio.

**Prueba manual con el servidor del equipo:** entrá como Mariana Ledesma, abrí AM1, tocá **Conectar con Discord**, elegí el servidor del equipo y autorizá. Vuelve con «Listo: la materia quedó conectada…». Tocá **Crear canales en Discord**: en el servidor aparece la categoría «Análisis Matemático I» con `#avisos-a`, `#consultas-a` y `#material`. Publicá un aviso en HackAI y mirá que llegue; con una cuenta sin el rol de docentes, comprobá que en `#avisos-a` no se puede escribir y en `#consultas-a` sí.

## 8. Vincular un canal a mano

La alternativa a crear los canales, por ejemplo para usar canales que la cátedra ya tiene:

1. Entrá como docente de la materia (en la demo, Mariana Ledesma dicta AM1 comisión A) y abrí el espacio en **Mis materias**.
2. Elegí el canal (`#avisos`, `#consultas`, `#material` o uno creado) y abrí **Vincular con un canal de Discord**. Elegí el canal de la lista del servidor conectado, o pegá su enlace (en Discord, clic derecho sobre el canal → **Copiar enlace**, sin modo desarrollador) o su ID (sección 4), y tocá **Vincular**.
3. Lo que ya tenía el canal de Discord entra a HackAI. Desde ahí, abrir el espacio trae lo nuevo (no más de una vez cada 10 segundos); con el canal abierto, la pantalla se fija cada 5 segundos si hay algo nuevo y se actualiza sola, sin recargar. La corrida periódica (`/api/cron/sync`, README, «Corrida periódica») sincroniza aunque nadie lo abra.

Un canal de Discord se vincula con un solo canal de HackAI. Lo vinculan los docentes de la comisión del canal, o los de la materia si el canal es de toda la materia.

**Cuentas de Discord de los docentes.** El autor de un mensaje de Discord se reconoce por su id de usuario de Discord, vinculado en Personas (`people_accounts`, sistema `discord`). **Conectar con Discord** vincula la cuenta del docente que autoriza. El seed vincula a los docentes y alumnos sintéticos con ids inventados. Sin vínculo, el mensaje aparece con tu nombre de Discord y «desde Discord».

Sin **Conectar con Discord**, para la prueba con el servidor del equipo cargá el id real de tu cuenta (clic derecho sobre tu nombre → **Copiar ID de usuario**) en la persona de demo que vas a usar, por ejemplo con `update people_accounts set external_id = '<tu id>' where person_id = 'p-mledesma' and system = 'discord';`. Eso necesita `HACKAI_STORE=supabase`: en memoria, los vínculos salen del set sintético y no se pueden cambiar.

**Quién publica desde Discord.** HackAI trae todo lo que se publica en el canal vinculado, escriba quien escriba. En el canal de material entran los adjuntos, no el texto. Quién puede escribir en cada canal lo decide el servidor de Discord. Los canales que crea **Crear canales en Discord** ya vienen con avisos y material solo para docentes; uno vinculado a mano queda como lo dejó la cátedra, que tiene que cerrarlo ella si no quiere que los alumnos publiquen ahí. Está abierto en la pregunta 18 de [preguntas-abiertas.md](../../docs/product/preguntas-abiertas.md).

**Dónde queda guardado.** Con `HACKAI_STORE` y `HACKAI_FILES` vacías, espacios, mensajes, vínculos con Discord y archivos viven en la memoria del proceso: al reiniciar la app o recrear el contenedor se pierden, y hay que volver a vincular los canales. Para guardarlos van `HACKAI_STORE=supabase` y `HACKAI_FILES=supabase`, con `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` y las migraciones `0001` a `0005` aplicadas (README). Los archivos van al bucket privado `hackai-files` y su registro a `space_material` o a los adjuntos de `space_messages`.

## 9. Prueba manual de ida y vuelta

Con `HACKAI_EXTERNAL_CHANNEL=discord`, un canal de prueba vinculado a `#consultas` de AM1 A y `CRON_SECRET` cargado:

1. Como alumno (Tomás Aguirre), publicá una consulta en HackAI. En Discord aparece con su nombre, con un hilo abierto y la notificación del canal.
2. Respondé en ese hilo desde Discord. Volvé a abrir el espacio en HackAI (esperá 5 segundos): la respuesta aparece bajo la consulta.
3. Subí un archivo a un mensaje de Discord en el canal vinculado al material: aparece en **Material** con el origen Discord, y se sigue abriendo después de que vence su enlace.
4. Para probar los pendientes, cargá un token inválido, publicá, volvé a poner el bueno y pedí la corrida: el mensaje llega a Discord y deja de decir «Enviando a Discord».

Para medir la tarea T3 («enterarme», [alcance.md](../../docs/product/alcance.md#cómo-se-mide)), cronometrá desde que el docente publica el aviso en Discord hasta que el alumno lo ve en HackAI. Los resultados van a [validaciones.md](../../docs/product/validaciones.md).

## Cómo se comporta el adaptador

- **Hilos:** HackAI responde abriendo un hilo de Discord sobre el mensaje. Al leer, los mensajes del hilo y las respuestas con «Responder» de Discord vuelven con el id del primer mensaje de la cadena como hilo, aunque ese mensaje se haya leído en una sincronización anterior. Un mensaje reenviado no cuenta como respuesta.
- **Hilos archivados:** se leen los activos y los archivados después del cursor, así que un hilo que se archiva entre dos sincronizaciones no pierde mensajes.
- **Adjuntos:** sus URLs vencen. Espacios los copia a Archivos al leerlos.
- **Lo que publica HackAI:** sale como el bot: el texto primero (Discord nombra el hilo de una consulta con la primera línea) y abajo, en letra chica (`-#`), quién lo escribió. Los adjuntos de HackAI van solo por nombre: se abren en HackAI, que pide sesión. Lo que se sube al material de HackAI se avisa en el canal de material vinculado con el nombre del archivo, sin el archivo (pregunta abierta 19).
- **Límites:** ante un 429 el adaptador espera lo que pide Discord y reintenta hasta 3 veces. Si pide esperar más de 30 segundos, devuelve `falla-externa` en vez de bloquear, y la próxima sincronización vuelve a intentar.
- **Menciones:** lo que publica HackAI no notifica por arroba: un `@everyone` escrito en HackAI llega a Discord como texto. Ojo: si el servidor tiene las notificaciones en «Solo @menciones», un aviso sin mención no le suena a nadie. Está abierto en la pregunta 12 de [preguntas-abiertas.md](../../docs/product/preguntas-abiertas.md).
