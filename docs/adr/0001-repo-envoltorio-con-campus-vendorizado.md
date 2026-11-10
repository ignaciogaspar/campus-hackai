---
status: superseded in part by ADR-0004
date: 2026-11-10
---

# Repo envoltorio: `campus/` vendorizado y nuestra app en `hackai/`

Queremos que lo que construyamos para HackAI se pueda mergear al repo de Nacho (Campus Austral) sin quedar atados a él. Campus nos llegó como un zip: sin historial de git e incompleto (falta `lib/content/server`, así que el typecheck falla de entrada, y los seeds importan de un repo hermano que no vino). Decidimos armar un repo envoltorio, `campus-hackai`, con dos carpetas: `campus/`, un snapshot intacto del zip que nunca se edita a mano, y `hackai/`, nuestra app, con el mismo stack y las mismas rutas de carpetas que campus (ADR 0002). La compatibilidad se sostiene con tres cosas: la convención de rutas (una feature ocupa en `hackai/` los mismos paths que ocuparía en campus), `scripts/port-to-campus.sh` (copia esos paths a una copia de campus y muestra el diff, que es lo que se le manda a Nacho) y el workflow `mergeable-check` (revisa la feature contra el checklist de compatibilidad).

## Opciones consideradas

- **Repo directo desde `campus/`** (`git init` adentro del zip y construir encima): es lo más mergeable en apariencia, porque cada commit nuestro ya sería un diff contra su código. Rechazada: arrancaríamos con un repo que no compila y tendríamos que arreglar o esquivar sus problemas antes de escribir una línea nuestra; sin historial común, el día que Nacho pase su git el merge sería igual de manual; cada versión nueva del zip pisaría archivos mezclados con los nuestros; y la demo dependería de un contenido y unos seeds que no tenemos.
- **Repo propio sin `campus/` adentro**: máxima libertad, pero la compatibilidad quedaría de palabra: no habría contra qué correr el port ni de dónde leer sus contratos. Rechazada.
- **`git subtree` o submódulo de su repo**: es la forma correcta de vendorizar, pero hoy no hay un repo git del que tirar. Queda como paso siguiente (ver consecuencias).

## Consecuencias

- `hackai/` compila, se prueba y se demuestra sola. Los problemas de campus se anotan en `docs/campus-upstream.md` para avisarle a Nacho; no los arreglamos nosotros.
- Podemos proponer cosas que campus no tiene (varias materias, modelo académico tipo SIU) como tablas y módulos nuevos, sin pedir permiso ni tocar lo suyo.
- La compatibilidad es una convención, no una garantía del compilador: hasta que Nacho pase el repo completo, el port se verifica por diff y por checklist, no con un build de campus.
- Los archivos compartidos donde una feature tiene que enganchar (`lib/routes.ts`, `middleware.ts`, las homes, `package.json`) no se resuelven con copiar carpetas: `port-to-campus` los lista como cambios manuales del parche.
- Actualizar campus es reemplazar la carpeta entera con `scripts/sync-campus.sh`, en un commit aparte, y volver a correr `mergeable-check` sobre las features hechas.
- Si Nacho da acceso a git, `campus/` pasa a ser un `git subtree` de su repo y el resto de la estructura no cambia.
- Qué entiende Nacho por «mergeable» (un PR, un módulo para integrar después, o solo mismo stack) sigue abierto en `docs/product/preguntas-abiertas.md`. Esta estructura sirve para los tres casos.
