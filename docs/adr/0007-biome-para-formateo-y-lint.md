---
status: accepted
date: 2026-11-11
---

# `hackai/` se formatea y se lintea con Biome

Hasta ahora las convenciones de código de `AGENTS.md` (dos espacios, comillas simples, sin punto y coma) se respetaban a mano, y nada frenaba una función que crecía hasta volverse difícil de seguir. Con cuatro personas y agentes escribiendo código a la vez, el estilo se mezclaba (comas finales en unos archivos sí y en otros no, líneas de más de 120 caracteres) y la complejidad solo se notaba en la review. Decidimos sumar Biome, que formatea y lintea, y que CI y el gancho de pre-commit lo exijan (issue #30).

## Opciones consideradas

- **Seguir a mano:** sin dependencias, pero el estilo ya se estaba mezclando y la complejidad no la mide nadie. Rechazada.
- **ESLint + Prettier:** lo más usado, pero son cuatro o cinco paquetes (`eslint`, `typescript-eslint`, `eslint-config-next`, `prettier` y la integración entre los dos), más lentos, y `next lint` está deprecado desde Next.js 15.5. Rechazada.
- **Biome:** un solo paquete, sin dependencias propias, que formatea, lintea y ordena imports, y tarda milisegundos en todo `hackai/`. Elegida.

## Consecuencias

- Entra `@biomejs/biome` como dependencia de desarrollo, con versión fija. La configuración está en `hackai/biome.json` y repite las convenciones de `AGENTS.md`: dos espacios, comillas simples (también en JSX), sin punto y coma, sin comas finales, paréntesis en todas las funciones flecha y 120 caracteres por línea.
- Biome mira solo `.ts`, `.tsx` y `.mjs` de `hackai/`. `campus/` sigue fuera de todo (es de solo lectura).
- El linter usa las reglas recomendadas de Biome, más `noExcessiveCognitiveComplexity` como error: una función con complejidad cognitiva mayor a 15 no pasa. Las ocho que ya la superaban llevan un `biome-ignore` con su puntaje, y se refactorizan después de la demo.
- `noNonNullAssertion` (el `!` de TypeScript) queda apagada: el código lo usa a propósito para buscar en el set sintético y en los tests, donde el dato existe por construcción.
- Junto con Biome, `tsconfig.json` suma `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch` y `noImplicitReturns`. No necesitan paquetes y el código ya los cumplía.
- El formateo inicial de todo `hackai/` va en un commit propio, listado en `.git-blame-ignore-revs` para que `git blame` y GitHub lo salteen. Los branches abiertos en ese momento resuelven los conflictos quedándose con su versión y corriendo `npm run lint:arreglar`.
- `npm run lint` chequea y `npm run lint:arreglar` arregla lo que Biome puede arreglar solo. CI corre `biome ci` en cada PR y el pre-commit chequea los archivos en stage.
