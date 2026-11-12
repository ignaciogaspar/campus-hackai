---
status: accepted
date: 2026-11-12
---

# El QR del ingreso se genera con `qrcode`

«Mal desde el celular» es el 49% de la encuesta, y la demo se proyecta desde una compu. Para que el jurado y los alumnos de las validaciones prueben HackAI en su teléfono, el ingreso muestra en la compu un QR con la dirección del deploy de HackAI (issue #56). El QR se arma en el servidor, sin pedírselo a un servicio externo: la dirección no sale de HackAI y la pantalla no depende de que otro sitio responda.

## Opciones consideradas

- **Un servicio externo que devuelve la imagen** (una URL de un generador de QR): sin código, pero le manda la dirección a un tercero y el QR desaparece si ese servicio no responde o la red del lugar lo bloquea. Rechazada.
- **Codificarlo a mano:** sin dependencias, pero un QR válido pide Reed-Solomon, la elección de máscara y las tablas de versiones; son cientos de líneas propias que nadie del equipo quiere mantener para una pantalla. Rechazada.
- **`qrcode`:** el paquete de QR más usado de Node, el mismo que ya usa Campus Austral (`campus/package.json`), con salida en SVG desde el servidor. Elegida.

## Consecuencias

- Entran `qrcode` como dependencia y `@types/qrcode` como dependencia de desarrollo, las dos en la misma versión que Campus (`1.5.4` y `1.5.6`), pero fijadas, sin el `^` que usa `campus/package.json`.
- Solo se usa en el servidor (`components/session/sign-in-qr.ts`, con `server-only`): `qrcode` no llega al navegador.
- El QR sale como SVG en una imagen con texto alternativo y la dirección escrita debajo, para quien no lo pueda escanear.
