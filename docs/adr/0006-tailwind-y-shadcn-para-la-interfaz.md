---
status: accepted
date: 2026-11-10
---

# La interfaz de `hackai/` usa Tailwind CSS y shadcn/ui en vez de CSS plano

El ADR 0002 pedía CSS plano y ninguna dependencia que Campus Austral no tuviera, para poder copiar cada feature al repo de Nacho sin reescribirla. El ADR 0004 abandonó ese objetivo: HackAI es un sistema propio y no le mandamos código a Nacho. Sin esa razón, lo que pesa es la demo del 13/11, que pide muchas pantallas pensadas para el celular, con foco en UX y UI, en tres días y entre cuatro personas. Decidimos usar Tailwind CSS 4 para los estilos y shadcn/ui, sobre Radix, para los componentes base: botones, pestañas, diálogos y listas accesibles con teclado, sin escribirlos de cero.

## Opciones consideradas

- **CSS plano** (lo del ADR 0002): sin dependencias, pero cada componente accesible (pestañas, diálogos, menús) se escribe a mano. Rechazada por tiempo.
- **Una librería de componentes cerrada** (MUI, Chakra, Mantine): trae su propio sistema de estilos y es más difícil llevarla a los colores de la Austral. Rechazada.
- **Tailwind sin shadcn/ui**: queda igual el costo de escribir a mano los componentes accesibles. Rechazada.

## Consecuencias

- Reemplaza solo la parte de estilos del ADR 0002. El resto sigue valiendo: Node 22, Next.js 15, React 19, TypeScript estricto, Supabase, `node:test` y ADR para cualquier otro paquete.
- Paquetes que entran: `tailwindcss`, `@tailwindcss/postcss` y `postcss` (build); `shadcn`, `radix-ui`, `class-variance-authority`, `cn`, `lucide-react` y `tw-animate-css`, que necesitan los componentes. `cn` es de los autores de shadcn/ui y reemplaza a `clsx` + `tailwind-merge`.
- Los componentes de shadcn/ui se copian al repo con `npx shadcn add <componente>` en `components/ui/`: son código nuestro y se editan. Al sumar uno se pasa a las convenciones del repo (comillas simples, sin punto y coma, `cn` desde `@/lib/utils`), salvo los strings que ya traen comillas simples adentro.
- Los tokens viven en `app/globals.css`: los colores de la Austral alimentan las variables de shadcn/ui (`--primary`, `--background`…) y Tailwind las expone como utilidades (`bg-primary`). La tipografía es Montserrat con `next/font`, así que el build necesita red para bajarla la primera vez.
- Las pantallas siguen sin reglas de negocio (ADR 0004): Tailwind y shadcn/ui solo viven en `app/` y `components/`, nunca en `lib/core/`, `lib/ports/` ni `lib/adapters/`.
