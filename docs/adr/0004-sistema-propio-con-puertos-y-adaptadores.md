---
status: accepted
date: 2026-11-10
---

# Sistema propio con puertos y adaptadores, en vez de features para mergear a campus

El ADR 0001 apuntaba a que cada feature de `hackai/` se pudiera copiar al repo de Nacho. Decidimos otra cosa: `hackai/` es un sistema propio, construido de cero y centrado en resolver un problema real del alumno, no en sumar features a un sistema existente. Su núcleo unifica la vida académica del alumno. SIU Guaraní, el Campus Virtual (Moodle) y Campus Austral son sistemas externos detrás de un puerto, y el núcleo no conoce a ninguno. Por cada capacidad, si un sistema existente la resuelve bien, el núcleo la delega en él a través de su adaptador; si no, la implementamos nosotros en el núcleo. Lo burocrático y las certificaciones, por ejemplo, quedan en el SIU. A Campus Austral no le copiamos código: reimplementamos la lógica suya que nos sirva y lo conectamos a nuestro sistema como un sistema externo más, que hoy es lo único que tenemos del lado docente. Las razones: las quejas más votadas de la encuesta cruzan varias materias y los dos sistemas, Campus Austral es de un solo curso y dos roles, y construir sobre su zip nos hacía depender de Nacho desde el primer día.

## Opciones consideradas

- **Construir sobre Campus Austral y mergear a su repo** (ADR 0001): rechazada. Obliga a refactorizar su núcleo de un solo curso y nos ata a un zip que no compila y a preguntas que Nacho todavía no respondió.
- **Plugins o configuración sobre Moodle y SIU**: rechazada. No hay acceso de administrador ni API confirmada; sirve para mencionar arreglos rápidos en el pitch, no para construir.
- **Motor propio que reemplace al SIU** (la propuesta «motor propio» del Google Doc, con carreras, actas e historia en nuestro núcleo): rechazada como regla general. El núcleo implementa una capacidad solo cuando el sistema existente no la resuelve bien.
- **Núcleo que solo agrega y delega todo**: rechazada. Varias de las quejas (matricularse a mano, avisos que no llegan, cursos viejos mezclados) son justamente lo que ningún sistema existente resuelve.

## Consecuencias

- Reemplaza el objetivo de mergeabilidad del ADR 0001: no le mandamos código a Nacho. Siguen valiendo el repo envoltorio y `campus/` como snapshot de solo lectura, ahora como referencia de su lógica.
- El ADR 0002 sigue valiendo: mismo stack, sin dependencias nuevas.
- Lo que existía para mandarle código a Nacho se saca del repo: la regla de rutas compatibles de `AGENTS.md`, `hackai/compat.txt`, `scripts/port-to-campus.sh` y las skills y workflows que dependen de eso.
- Qué capacidad resuelve cada sistema y cuál implementa el núcleo es una decisión por capacidad, que se registra en el alcance.
