# APIs de Discord, Slack y WhatsApp para sincronizar canales

Fecha: 2026-11-10. Ticket #4 (`ignaciogaspar/campus-hackai`). Pregunta: cómo integrar de ida y vuelta un sistema Next.js en hosting serverless con canales externos, empezando por Discord.

**Reglas de esta nota.** Solo fuentes primarias (documentación oficial de cada producto), con la URL al lado de cada dato. Lo que no figura en la fuente dice «no confirmado». Lo que es deducción propia dice «Inferencia» y no es un dato de la fuente. Las páginas se leyeron el 2026-11-10 con una herramienta de lectura web que resume cada página, por lo que las citas son paráfrasis fieles pero conviene releer la página antes de apoyar una decisión en un número concreto. No hay datos personales de alumnos.

**Aviso de contexto.** La nota se escribió sobre `main`, donde todavía no estaban los ADR 0004 y 0005 ni el alcance actualizado. No depende de ellos.

**Verificación posterior (10/11/2026).** En la página del gateway de Discord, la regla general de intents privilegiados dice que las apps con menos de 10.000 usuarios acceden a ellos habilitándolos en el Developer Portal, y la aprobación tras verificación aplica a las apps en 100 o más servidores. Para un servidor de equipo o de una cátedra, Message Content se activa sin revisión manual. Fuente: https://docs.discord.com/developers/events/gateway

Nota sobre dominios: la documentación de Discord pasó de `discord.com/developers/docs/...` a `docs.discord.com/developers/...` (redirección 301, confirmada al pedir las páginas). Las URLs de abajo son las nuevas, del propio Discord.

## Resumen

| Tema | Discord | Slack | WhatsApp (Cloud API) |
|---|---|---|---|
| Leer sin conexión permanente | Sí, por REST (`Get Channel Messages`) | Sí, por Events API (HTTP) o `conversations.history` | Solo por webhook (no hay API de historial) |
| Gotcha principal | Sin el intent Message Content el bot recibe `content` y `attachments` vacíos | Desde 2025-05-29 las apps comerciales no listadas en Marketplace tienen 1 req/min en `conversations.history` | Fuera de la ventana de 24 h solo se envían plantillas aprobadas |
| Publicar | Bot (`Create Message`) o webhook | `chat.postMessage` o incoming webhook | `POST /<PHONE_NUMBER_ID>/messages` |
| Hilos | Sí | Sí (`thread_ts`) | No documentado en lo leído |

## Discord

### Leer mensajes y adjuntos por REST, sin gateway

- Base de la API: `https://discord.com/api`, con versión en la ruta (`/v10`). Autenticación del bot: header `Authorization: Bot TOKEN`. Todo cliente debe mandar `User-Agent` con el formato `DiscordBot ($url, $versionNumber)`; sin un User-Agent válido las requests pueden bloquearse. Fuente: https://docs.discord.com/developers/reference
- `Get Channel Messages` devuelve mensajes del más nuevo al más viejo. Requiere `VIEW_CHANNEL`; sin `READ_MESSAGE_HISTORY` en el canal no devuelve mensajes. `limit` va de 1 a 100 (por defecto 50). `before`, `after` y `around` son excluyentes entre sí. Fuente: https://docs.discord.com/developers/resources/message
- Es un endpoint HTTP común, así que alcanza con un bot token. **Inferencia:** como el endpoint es REST y no depende del gateway, puede llamarse desde una función serverless; la fuente no habla de serverless.
- Adjuntos: el objeto Attachment trae `id`, `filename`, `size`, `url` y `proxy_url`. Fuente: https://docs.discord.com/developers/resources/message
- Las URLs de adjuntos del CDN están firmadas y expiran: `ex` (timestamp hexadecimal de expiración), `is` (emisión) y `hm` (firma). Los endpoints estándar del CDN no están firmados ni expiran. Fuente: https://docs.discord.com/developers/reference. **Inferencia:** conviene descargar y guardar el archivo (por ejemplo en Supabase Storage) al leerlo y no persistir la URL del CDN; la fuente solo documenta el vencimiento.
- Mensajes publicados por un webhook: el campo `author` trae id, nombre y avatar del webhook, y `webhook_id` permite distinguirlos. Fuente: https://docs.discord.com/developers/resources/message

### Permisos e intents (¿Message Content es privilegiado?)

- Sí. `MESSAGE_CONTENT` (`1 << 15`) es un intent privilegiado. Sin él la app recibe valores vacíos en `content`, `embeds`, `attachments` y `components`, y `poll` se omite. Fuente: https://docs.discord.com/developers/resources/message y https://docs.discord.com/developers/events/gateway
- Excepciones (sí se recibe el contenido): mensajes que envía la propia app, mensajes directos con la app, mensajes donde la app es mencionada y el mensaje objetivo de un comando de menú contextual de mensaje. Fuente: https://docs.discord.com/developers/events/gateway
- El intent aplica «a través de las APIs», incluido HTTP; el valor de `intents` que se manda al identificarse en el gateway no cambia el acceso por HTTP. Fuente: https://docs.discord.com/developers/events/gateway
- Hay que habilitarlo en la página Bot del Developer Portal. Debe estar aprobado para la app; para apps en 100 o más servidores, la aprobación llega con la verificación de la app. Pasar un intent privilegiado no habilitado ni aprobado cierra la conexión del gateway con código `4014`. Fuente: https://docs.discord.com/developers/events/gateway
- **Implicancia para HackAI:** para leer el texto y los adjuntos de un canal cualquiera por REST, el bot necesita Message Content habilitado. Qué se exige exactamente para una app en un solo servidor (el de la Austral o de un equipo) y si hay revisión manual: no confirmado en las páginas leídas, salvo el umbral de 100 servidores arriba.
- Permisos del bot en el canal: `VIEW_CHANNEL` y `READ_MESSAGE_HISTORY` para leer; `SEND_MESSAGES` para publicar, más `READ_MESSAGE_HISTORY` para responder con `message_reference`. Fuente: https://docs.discord.com/developers/resources/message

### Límites de rate

- Límite global: 50 requests por segundo por bot, aparte de los límites por ruta. Los endpoints de interacciones están exentos. Fuente: https://docs.discord.com/developers/topics/rate-limits
- Headers: `X-RateLimit-Limit`, `-Remaining`, `-Reset`, `-Reset-After`, `-Bucket`. La doc dice que los límites no deben hardcodearse. Los buckets se calculan por recurso de nivel superior (canal, guild, webhook). Fuente: https://docs.discord.com/developers/topics/rate-limits
- Ante excedente: HTTP 429 con `retry_after` y `global`; hay que esperar ese tiempo (`Retry-After`). Fuente: https://docs.discord.com/developers/topics/rate-limits
- Bloqueo por IP tras 10.000 requests inválidas (401, 403 o 429) en 10 minutos; un 429 con `X-RateLimit-Scope: shared` no cuenta. Fuente: https://docs.discord.com/developers/topics/rate-limits. **Inferencia:** en serverless las IP salientes son compartidas y cambian, así que reintentar a ciegas ante 429 o 403 puede acercarse a ese tope; no está en la fuente.
- Los números por ruta (por ejemplo cuántos `Get Channel Messages` por segundo): no confirmado; la doc manda leer los headers.

### Publicar: bot o webhook, y responder en hilos

- **Con el bot:** `Create Message`. `content` hasta 2000 caracteres; hace falta al menos uno entre `content`, `embeds`, `sticker_ids`, `components`, `files[n]`, `poll`; tamaño máximo de request 25 MiB. Una respuesta se hace con `message_reference` (solo `message_id` es obligatorio al enviar). Fuente: https://docs.discord.com/developers/resources/message
- **Con webhook:** `Execute Webhook`. Admite `content` (2000 caracteres), `username` y `avatar_url` para sobrescribir nombre y avatar, hasta 10 `embeds`, `wait` (devuelve el mensaje creado, por defecto `false`), `thread_id` (query string) y `thread_name` (para crear un hilo en canales foro o media). Fuente: https://docs.discord.com/developers/resources/webhook
- El token del webhook va en la URL; los endpoints con token no piden otra autenticación, así que la URL es el secreto. La página recomienda sanitizar texto de usuarios y usar `allowed_mentions`. Fuente: https://docs.discord.com/developers/resources/webhook
- Un webhook sirve para publicar. La página no documenta leer mensajes generales del canal con un webhook (solo `Get Webhook Message` para mensajes enviados con ese mismo token). Fuente: https://docs.discord.com/developers/resources/webhook
- **Hilos:**
  - `Start Thread from Message` (`POST /channels/{channel.id}/messages/{message.id}/threads`): `name` obligatorio (1 a 100 caracteres), `auto_archive_duration` opcional (60, 1440, 4320 o 10080 minutos). En un canal de texto crea un hilo público. El id del hilo es el id del mensaje, así que un mensaje tiene como máximo un hilo. No funciona en canales foro o media. Fuente: https://docs.discord.com/developers/resources/channel
  - `Start Thread without Message` (`POST /channels/{channel.id}/threads`). El `type` por defecto es hilo privado y la doc avisa que ese default se va a quitar: mandarlo explícito. Fuente: https://docs.discord.com/developers/resources/channel
  - Publicar en un hilo archivado lo desarchiva automáticamente; la API agrega solos a los usuarios al hilo al enviar un mensaje. Fuente: https://docs.discord.com/developers/resources/channel
  - Un webhook puede publicar en un hilo existente con `thread_id`; el hilo se desarchiva solo. Fuente: https://docs.discord.com/developers/resources/webhook
  - Los permisos concretos para crear hilos: no aparecen en la página leída; no confirmado.

### Identificar al autor y vincularlo con una persona de HackAI

- El objeto User tiene `id` (snowflake), `username` (la doc dice que no es único en la plataforma), `discriminator`, `global_name` y `bot`. Fuente: https://docs.discord.com/developers/resources/user. **Inferencia:** el `id` es la clave razonable para el vínculo, porque el nombre no es único y puede cambiar; la doc no lo declara «identificador estable» textualmente.
- Cada mensaje trae `author` con la estructura de User (válido solo si lo envió un usuario o bot; para webhooks ver más arriba). Fuente: https://docs.discord.com/developers/resources/message
- Para vincular de forma verificable, OAuth2 con el scope `identify`: devuelve el objeto User, que incluye el `id`. Endpoints: autorizar `https://discord.com/oauth2/authorize`, token `https://discord.com/api/oauth2/token`, revocar `https://discord.com/api/oauth2/token/revoke`; los endpoints de token solo aceptan `application/x-www-form-urlencoded`. Fuente: https://docs.discord.com/developers/topics/oauth2
- Un alumno que escribe en Discord no queda vinculado solo a su cuenta de HackAI: hace falta un paso explícito de vínculo (por ejemplo el login OAuth2 de arriba). Es una **inferencia** de diseño, no un dato de la doc.

### Recibir eventos en serverless sin gateway

- Los eventos de mensajes (`MESSAGE_CREATE`) llegan por el gateway (conexión persistente). Lo que sí llega por HTTP son las **interacciones** (comandos de barra, botones), mediante un «Interactions Endpoint URL»; es opt-in y excluyente con recibirlas por gateway. Fuente: https://docs.discord.com/developers/interactions/overview
- El endpoint debe responder al `PING` (`type: 1`) con 200 y un `PONG` (`type: 1`) y validar en cada request la firma con los headers `X-Signature-Ed25519` y `X-Signature-Timestamp`; ante firma inválida responde 401. Discord hace chequeos periódicos y, si falla, quita la URL y avisa por mail y System DM. Fuente: https://docs.discord.com/developers/interactions/overview
- No confirmado en lo leído: el plazo de respuesta a una interacción (circula como 3 segundos) y la validez del token para seguimientos (circula como 15 minutos). Están en las páginas de Receiving and Responding, que no se leyeron.
- **Inferencia (el punto de diseño que más pesa):** sin gateway, la lectura de canales se hace por *polling* de `Get Channel Messages` (por ejemplo con `after=<último id>`), por ejemplo desde un cron del hosting; la mensajería «push» desde Discord hacia HackAI solo existe vía interacciones. Esto no es un dato de la fuente.

## Slack

### Events API sobre HTTP

- Slack envía un POST JSON por cada evento suscripto, «un request, un evento». Hay que responder 2xx en 3 segundos; se aceptan 301 o 302 (sigue hasta dos redirecciones). Recomienda confirmar rápido y procesar asíncrono. Fuente: https://docs.slack.dev/apis/events-api/
- Reintentos: hasta 3, el primero casi inmediato, el segundo al minuto y el tercero a los 5 minutos; headers `x-slack-retry-num` y `x-slack-retry-reason`; con `x-slack-no-retry: 1` en una respuesta no 200 se evitan. Fuente: https://docs.slack.dev/apis/events-api/
- Payload `event_callback`: `event_id` (único global), `team_id`, `type`, `api_app_id`, `event`, `event_time`, entre otros. Fuente: https://docs.slack.dev/apis/events-api/
- Tope de entrega: 30.000 eventos por workspace por app por 60 minutos; superado, Slack manda eventos `app_rate_limited`. Si más del 95 % de las entregas falla en 60 minutos, las suscripciones se desactivan temporalmente (no aplica a apps con menos de 1.000 eventos por hora). Fuente: https://docs.slack.dev/apis/events-api/
- Verificación de requests: headers `X-Slack-Signature` y `X-Slack-Request-Timestamp`; rechazar si el timestamp difiere más de 5 minutos; usar el body crudo; base `v0:<timestamp>:<body>`; HMAC SHA-256 con el Signing Secret; comparar con comparación de tiempo constante contra `v0=<hex>`. Fuente: https://docs.slack.dev/authentication/verifying-requests-from-slack/
- El handshake `url_verification` (desafío al configurar la URL): la página de Events API lo nombra pero no lo describe; no confirmado en lo leído.
- **Inferencia:** al contrario que Discord, Slack sí empuja mensajes por HTTP, así que encaja con funciones serverless sin gateway; el único requisito es responder en 3 segundos y delegar el trabajo.

### Leer mensajes y adjuntos

- El evento `message` requiere los scopes `channels:history`, `groups:history`, `im:history` y `mpim:history` según el tipo de conversación. Trae `user`, `text`, `ts`, `channel`, `channel_type`, `subtype`. La página no documenta `thread_ts`, `files` ni `bot_id` (no confirmado ahí). Fuente: https://docs.slack.dev/reference/events/message/
- `conversations.history` es Tier 3 (50+ por minuto) y usa los mismos scopes `*:history`. Fuente: https://docs.slack.dev/reference/methods/conversations.history y https://docs.slack.dev/apis/web-api/rate-limits/
- **Cambio importante (2025):** las apps distribuidas comercialmente que no están aprobadas en el Slack Marketplace pasan a 1 request por minuto en `conversations.history` y `conversations.replies`, y el máximo y valor por defecto de `limit` baja a 15. Rige desde el 29/05/2025 para apps nuevas y nuevas instalaciones; las instalaciones existentes de apps no Marketplace no se ven afectadas, y las apps internas construidas por el cliente quedan exentas (siguen en 50+ por minuto y `limit` hasta 1.000). Fuente: https://docs.slack.dev/changelog/2025/05/29/rate-limit-changes-for-non-marketplace-apps/
- Si HackAI se instala solo en el workspace de la propia universidad como app interna, esa excepción aplicaría; si fuera una app distribuida a otros workspaces sin Marketplace, aplicaría el límite de 1 por minuto. Es una lectura de la fuente, no una consulta a Slack sobre el caso concreto.
- Descarga de archivos adjuntos (scope necesario y mecanismo de URL): no confirmado, no se leyó la página correspondiente.

### Publicar y responder en hilos

- `chat.postMessage` con scope `chat:write` (token de bot o de usuario); `chat:write.public` para publicar en canales públicos sin unirse; `chat:write.customize` para cambiar nombre o ícono. La app debe ser miembro del canal, o devuelve errores como `not_in_channel`. Fuente: https://docs.slack.dev/reference/methods/chat.postMessage
- Hilos: `thread_ts` con el `ts` del mensaje padre (no el de una respuesta); `reply_broadcast: true` además lo muestra en el canal. Fuente: https://docs.slack.dev/reference/methods/chat.postMessage
- Largo: `text` de unos 4.000 caracteres (puede dividirse), truncado sobre 40.000. Límite de ritmo especial: en general 1 mensaje por segundo por canal, con ráfagas cortas permitidas. Fuente: https://docs.slack.dev/reference/methods/chat.postMessage y https://docs.slack.dev/apis/web-api/rate-limits/
- Incoming webhook: se crea en la configuración de la app, y la URL contiene un secreto (Slack revoca las filtradas). Está atado a un usuario y un canal; no se pueden cambiar canal, nombre ni ícono. Se puede responder en hilo con `thread_ts`, pero la respuesta del webhook no devuelve el `ts`, que hay que obtener por otra vía. No permite borrar mensajes. Fuente: https://docs.slack.dev/messaging/sending-messages-using-incoming-webhooks/
- Ante 429, Slack manda `Retry-After` en segundos. Tiers: 1+, 20+, 50+ y 100+ por minuto. Fuente: https://docs.slack.dev/apis/web-api/rate-limits/

### Identificar al autor

- El campo `user` del evento `message` es el id de quien publicó. Fuente: https://docs.slack.dev/reference/events/message/. El vínculo con una persona de HackAI (por ejemplo con Sign in with Slack o con `users.info` y el mail) no se investigó: no confirmado.

## WhatsApp Business Platform (Cloud API)

Aviso: la documentación de Meta se mudó a `developers.facebook.com/documentation/business-messaging/whatsapp/`. Algunas páginas viejas de `/docs/whatsapp/cloud-api/...` ahora dicen «This page has moved» o devuelven 404 (así pasó con la guía de plantillas). Fuente del índice: https://developers.facebook.com/documentation/business-messaging/whatsapp/llms.txt

### Qué se necesita

- Cuenta de Facebook o Meta administrada con registro de desarrollador; una app de Meta con el caso de uso de WhatsApp en el App Dashboard; una cuenta de WhatsApp Business (WABA); un número «From»; un dispositivo con WhatsApp para probar con el número de prueba. Fuente: https://developers.facebook.com/docs/whatsapp/cloud-api/get-started
- Token: el temporal «expira rápido y no sirve para desarrollo»; para desarrollar se crea un usuario de sistema y un token permanente. Fuente: https://developers.facebook.com/docs/whatsapp/cloud-api/get-started
- Número propio: se agrega en WhatsApp Manager, se verifica la titularidad y se registra por API (`POST /<PHONE_NUMBER_ID>/register`) con un PIN de 6 dígitos (verificación en dos pasos); el endpoint de registro se limita a 10 requests por número en 72 horas. No se puede registrar desde WhatsApp Manager. Fuente: https://developers.facebook.com/documentation/business-messaging/whatsapp/business-phone-numbers/registration.md
- Requisitos exactos del número (por ejemplo si puede estar ya en la app de WhatsApp) y medio de pago: no confirmado en las páginas leídas.

### Aprobación y cuánto tarda

- **Plantillas:** se revisan automáticamente al crearlas o editarlas; «la revisión puede tardar hasta 24 horas». Estados: APPROVED (se puede enviar) y rechazada (no se puede enviar). Cada plantilla es de categoría authentication, marketing o utility; la categoría afecta el precio. Fuente: https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview
- **Nombre para mostrar (display name):** se verifica automáticamente al llegar a un límite de mensajes mayor; el resultado llega por el webhook `phone_number_name_update` (`APPROVED` o `REJECTED`). La doc no dice cuánto tarda. Tras aprobarse un cambio hay 14 días para volver a registrar el número. Fuente: https://developers.facebook.com/documentation/business-messaging/whatsapp/display-names.md
- **Verificación de empresa:** es una de las tres vías para subir el límite de mensajes de 250 a 2.000. Cuánto tarda la verificación: no confirmado (no se encontró una página general de verificación de negocio en el índice). Fuente de las vías: https://developers.facebook.com/documentation/business-messaging/whatsapp/messaging-limits.md
- Revisión de la app (App Review) y permisos: hay páginas en el índice, pero no se leyeron; no confirmado si hace falta para el uso propio de HackAI.

### Enviar y recibir

- Envío: `POST /<WHATSAPP_BUSINESS_PHONE_NUMBER_ID>/messages` con `messaging_product`, `recipient_type`, `to` y `type`. Un 200 indica que el request fue aceptado, no entregado; la entrega se informa por webhook. Fuente: https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages
- Ventana de atención al cliente de 24 horas: se abre cuando el usuario escribe o llama y se reinicia con cada mensaje suyo. Dentro de la ventana se puede enviar texto libre y otros tipos (imagen, audio, video, documento, interactivos, etc.). Cuando cierra, solo plantillas aprobadas. Solo se puede escribir a usuarios que dieron su consentimiento (opt-in). Fuente: https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages
- Webhook: verificación GET con `hub.mode=subscribe`, `hub.verify_token` y `hub.challenge` (responder 200 con el `hub.challenge`); los POST traen `X-Hub-Signature-256` (HMAC-SHA256 del payload con el app secret) y hay que rechazar con un 4xx los que no coinciden. Se exige certificado TLS válido (los autofirmados no se admiten). Reintentos: inmediatos y luego varias veces durante 7 días; los lotes pueden tener hasta 1.000 actualizaciones, no se garantiza el batching y hay que deduplicar. **No hay API para consultar el historial de webhooks**, así que hay que guardar cada payload al recibirlo. Fuente: https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/create-webhook-endpoint.md
- **Inferencia:** como WhatsApp empuja todo por webhook HTTP y no hay historial para leer, una función serverless que recibe y persiste cada payload encaja con el modelo.
- Descarga de media entrante (IDs de media): hay una página en el índice (`business-phone-numbers/media.md`) que no se leyó; no confirmado.

### Límites y costos

- Límite de mensajes: un portfolio nuevo parte en 250 usuarios únicos por ventana móvil de 24 horas (fuera de las ventanas de atención); escala a 2.000, 10.000, 100.000 e ilimitado. Para pasar a 2.000: verificar la empresa, que la verifique un partner, o enviar 2.000 mensajes fuera de ventana a números únicos en 30 días con plantillas de calidad. Fuente: https://developers.facebook.com/documentation/business-messaging/whatsapp/messaging-limits.md
- Throughput: 80 mensajes por segundo por número por defecto (entrantes y salientes). Fuente: https://developers.facebook.com/documentation/business-messaging/whatsapp/throughput.md
- Precios: facturación por mensaje desde el 01/07/2025; los mensajes de usuarios a empresas no se cobran; cada número tiene 1.000 mensajes de servicio gratis por mes y, desde el 01/10/2026, se cobra desde el 1.001. Las tarifas por país y categoría están en la página de precios (no se copian acá). Fuente: https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing.md
- Hilos: WhatsApp no tiene hilos en lo leído; no confirmado.

## Lo que queda sin confirmar

- Discord: plazo de respuesta a interacciones y validez de su token; permisos exactos para crear hilos; límites por ruta de `Get Channel Messages`; requisitos puntuales para habilitar Message Content en una app de un solo servidor.
- Slack: handshake `url_verification`, descarga de adjuntos, `thread_ts` y `files` en el evento `message`, vinculación de identidad.
- WhatsApp: requisitos del número, medio de pago, duración de la verificación de empresa, necesidad de App Review para uso propio, descarga de media.
- Cualquier decisión de producto (qué canal entra al alcance, polling vs. webhooks) queda para el equipo; todo lo marcado «Inferencia» es deducción de esta nota.
