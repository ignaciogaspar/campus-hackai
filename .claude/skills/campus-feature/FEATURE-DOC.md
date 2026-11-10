# Formato de `hackai/docs/<FEATURE>.md`

El modelo es `campus/docs/POST-CLASS.md`: leelo antes de escribir. Mismas cinco secciones, en este orden, en prosa corta.

```markdown
# <Nombre de la feature en español>

## Producto y alcance
Qué resuelve, en una oración. Historias del alumno y del docente. Criterios de aceptación.

## Arquitectura
Tablas nuevas, cómo se accede a los datos, qué valida cada action, decisiones no obvias y su razón.

## Archivos y pasos
1. Modelo y reglas: migración y `lib/<feature>/`.
2. UI: `components/<feature>/` y páginas.
3. Integración: cada archivo compartido tocado, con la línea exacta que se agrega.
4. Verificación: tests y scripts.

## Fallos, despliegue y rollback
Qué ve el usuario cuando falla la persistencia o falta la migración. Orden de despliegue. Cómo se revierte sin perder datos. Qué queda fuera de la entrega.

## Verificación realizada
Cada comando corrido y su resultado. Lo que no se pudo verificar, dicho como tal.
```

Dentro de «Archivos y pasos», después de la lista, agregá un bloque que campus no tiene:

```markdown
### Pendiente para el merge
- Número de migración: 02NN, a confirmar con Nacho.
- Qué es real y qué está simulado (datos de SIU y de Moodle sintéticos).
- Excepciones al checklist de compatibilidad, con su motivo.
```

Las rutas se escriben como en campus, sin `hackai/` adelante: el doc se copia tal cual.
