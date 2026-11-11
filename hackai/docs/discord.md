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
4. Invitá el bot al servidor abriendo esta URL con tu Application ID. Hace falta ser admin del servidor:

```text
https://discord.com/oauth2/authorize?client_id=APPLICATION_ID&scope=bot&permissions=309237713920
```

`309237713920` son los permisos que usa el adaptador: ver canales, enviar mensajes, leer el historial, crear hilos públicos y enviar mensajes en hilos. Si el canal tiene permisos propios, el rol del bot los necesita también ahí. El bot aparece desconectado en la lista de miembros: es normal, porque no mantiene una conexión abierta.

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

Sin `HACKAI_EXTERNAL_CHANNEL`, la app usa el canal externo en memoria con los datos sintéticos.

## Cómo se comporta el adaptador

- **Hilos:** HackAI responde abriendo un hilo de Discord sobre el mensaje. Al leer, los mensajes del hilo y las respuestas con «Responder» de Discord vuelven con el id del primer mensaje de la cadena como hilo, aunque ese mensaje se haya leído en una sincronización anterior. Un mensaje reenviado no cuenta como respuesta.
- **Hilos archivados:** se leen los activos y los archivados después del cursor, así que un hilo que se archiva entre dos sincronizaciones no pierde mensajes.
- **Adjuntos:** sus URLs vencen. Espacios los copia a Archivos al leerlos.
- **Límites:** ante un 429 el adaptador espera lo que pide Discord y reintenta hasta 3 veces. Si pide esperar más de 30 segundos, devuelve `falla-externa` en vez de bloquear, y la próxima sincronización vuelve a intentar.
- **Menciones:** lo que publica HackAI no notifica por arroba (`@usuario`, `@everyone`). Está abierto en la pregunta 12 de [preguntas-abiertas.md](../../docs/product/preguntas-abiertas.md).
