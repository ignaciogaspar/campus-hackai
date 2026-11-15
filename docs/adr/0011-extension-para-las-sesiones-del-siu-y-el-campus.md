---
status: accepted
date: 2026-11-15
---

# Una extensión de Chrome le pasa a HackAI las sesiones del SIU y del Campus

Para entrar con la cuenta real, el alumno copia a mano la cookie del SIU (ADR 0009) y después la del Campus (ADR 0010): abre las herramientas del navegador, busca la cookie y la pega. Son dos pasos técnicos que la mayoría no sabe hacer. HackAI no las puede leer: son HttpOnly y de otros dominios.

## Opciones consideradas

- **Seguir pegándolas a mano:** no suma nada, pero el ingreso real queda para quien sabe abrir las herramientas del navegador. Queda como alternativa, plegada.
- **Un bookmarklet:** no lee cookies HttpOnly. Descartada.
- **Un script local que lee el Chrome del equipo por CDP:** sirve solo en la compu de quien lo corre. Rechazada.
- **Una extensión de Chrome con permiso `cookies` sobre el SIU y el Campus:** al tocar «Iniciar con mi cuenta», abre el login de la Austral, espera a que la persona entre con Microsoft y le da las dos cookies a HackAI. Elegida.

## Decisión

- `hackai/extension/`: Manifest V3 en JavaScript plano, sin build ni paquetes. Permiso `cookies` y acceso solo a `siu.austral.edu.ar` y `campusvirtual.austral.edu.ar`. Su content script corre solo en los orígenes de HackAI (`localhost:3000`, `127.0.0.1:3000` y el deploy), así las cookies no se le dan a otro sitio.
- Un solo pedido, `iniciar`, por `window.postMessage`, mismo origen y misma ventana (`components/session/session-extension.ts`). La página lo manda recién cuando la persona aceptó el consentimiento y tocó el botón. Por cada sitio pedido, la extensión pregunta si ya hay sesión (el SIU sin sesión devuelve la pantalla de acceso; el Campus no muestra el área personal `/my/`). Si falta, abre una pestaña en el login con Microsoft de cada uno (`portal/acceso?auth=saml` y `auth/oidc/`, sin la pantalla de elegir tipo de cuenta del Campus), así con la sesión de Microsoft que deja el SIU el Campus entra solo, espera hasta cinco minutos a que la persona entre, la cierra y vuelve a la pestaña de HackAI. Después devuelve las cookies.
- En `/entrar-con-siu` pide el SIU y el Campus, y se conectan los dos en el mismo paso, con un consentimiento que nombra los dos. Si el Campus no se pudo iniciar o no reconoce la sesión, sigue el segundo paso de siempre (`/conectar-campus`), que también usa la extensión.
- Lo demás no cambia: el servidor recibe las mismas sesiones que hoy se pegan, la del SIU va cifrada en la cookie del navegador y la del Campus se canjea por el token y no se guarda.

## Consecuencias

- No suma un paquete npm: la extensión es un directorio aparte que se carga en Chrome.
- Por ahora se instala «descomprimida» desde `chrome://extensions`. Para cualquier alumno habría que publicarla en la Chrome Web Store, que la revisa: queda para después.
- Una extensión con permiso sobre las cookies del SIU es una llave de la cuenta. Por eso no guarda ni registra nada, solo responde a su content script y este solo corre en HackAI.
- Un deploy en otro dominio (una preview de Vercel) no la ve hasta sumarlo a `matches` del manifest.
- En el celular no hay extensiones: vale lo de las ADR 0009 y 0010.
