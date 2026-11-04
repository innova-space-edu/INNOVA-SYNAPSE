# Hoja de ruta con criterios de aceptación

## Hito 0: prototipo técnico (implementado en rama de desarrollo; pendiente validación de CI)
- Dashboard, proyectos locales, importación y exportación ZIP.
- Editor y árbol de archivos multiarchivo. Autosave en IndexedDB.
- Compilación en servicio aislado si está configurado; vista y descarga de PDF.
- Asistente de IA y revisión manual de propuestas con API key configurada.
- Criterio para declarar listo: lint, typecheck, build, tests y smoke test real de compilación.

## Hito 1: servicio seguro multiusuario (no implementado)
- Auth: inicio de sesión, MFA opcional, cierre de sesión, recuperación y correo verificado.
- PostgreSQL y S3 privado; migración de IndexedDB; proyectos persistentes tras cerrar sesión; backups y restauraciones comprobadas.
- Organizaciones, equipos y roles propietario/editor/comentarista/lector; autorización en cada petición.
- Registro de auditoría, políticas de privacidad y retención, cuotas por usuario y rate limits.
- Tareas de compilación en cola, workers aislados por trabajo; sin red ni shell escape.
- Criterio: pruebas de aislamiento entre usuarios y recuperación de respaldo.

## Hito 2: escritura colaborativa (no implementado)
- Yjs/Hocuspocus con autorización por documento, awareness, cursores, comentarios, sugerencias.
- Snapshots inmutables, diferencias, comparación y rollback.
- Criterio: conflictos concurrentes, reconexión, autorización de invitaciones, recuperación de edición.

## Hito 3: investigación avanzada (no implementado)
- Biblioteca Zotero/OAuth, exportación de citas BibTeX, DOI/Crossref/arXiv/Semantic Scholar con trazabilidad.
- Generadores de tablas, ecuaciones, figuras, BibTeX, plantillas de papers IEEE/ACM y proyectos nacionales.
- Agentes supervisados para estado del arte, hipótesis, metodología, resultados, discusión, revisión por pares, detección de inconsistencia y verificación de referencias.
- Criterio: las referencias deben poder verificarse; citas no verificadas se marcan.

## Hito 4: multimedia y administración (no implementado)
- Imagen a LaTeX con revisión, voz a texto, comandos de voz, TTS, OCR científico, soporte figuras y diagramas.
- Panel administrador: API keys cifradas, proveedores, límites, costos, calidad y métricas.
- Exportación de espacios, API pública con permisos, trabajos asíncronos, SDK/skills/MCP read-only.
- Criterio: pruebas de seguridad, privacidad, rendimiento y experiencia de usuario.

## Integración
No fusionar el prototipo con producción pública hasta completar los controles del Hito 1. Evitar habilitar funciones prometidas como si fueran funcionales.
