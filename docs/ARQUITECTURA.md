# Arquitectura — INNOVA SYNAPSE

## Decisiones

- Interfaz Next.js 16 / React / TypeScript; diseño original inspirado en patrones de editores científicos, sin incorporar código propietario de Prism.
- Editor CodeMirror; persistencia local IndexedDB para el primer prototipo. **No constituye todavía almacenamiento multiusuario ni copia de seguridad de servidor.**
- Importación/exportación ZIP LaTeX/BibTeX con archivos de figuras; descarga de PDF compilado.
- Compilación **fuera** de la aplicación web: API Python y TeX Live en un contenedor restringido, sin shell escape; no exponer la API del compilador a Internet.
- Proxy de IA server-side con lista fija de proveedores; claves únicamente en variables de entorno del servidor; el resultado se presenta como sugerencia, nunca se modifica el documento automáticamente.

## Evolución para producción

1. Añadir PostgreSQL con modelo `organizations`, `users`, `memberships`, `projects`, `project_files`, `snapshots`, `comments`, `conversations`, `messages`, `compile_jobs`, `audit_log`.
2. Autenticación real (Better Auth u otro IdP) y control de acceso por recurso en cada endpoint; roles propietario/editor/comentarista/lector; acceso compartido con vencimiento.
3. Almacenamiento objeto privado S3/MinIO con URLs firmadas y límites por usuario; backups automáticos con restauración comprobada; migración desde IndexedDB.
4. Habilitar CRDT Yjs + Hocuspocus detrás de autorización por documento para edición en tiempo real; checkpoints persistentes.
5. Cola de trabajos, aislamiento fuerte de compilación con seccomp/AppArmor, no egress, límites CPU/RAM/tiempo/disco, antivirus de adjuntos, control de tasa y auditoría.
6. Integraciones bibliográficas (Zotero mediante OAuth, arXiv y Crossref), herramientas de revisión, plantillas y asistencia de voz.

## Advertencia

El proyecto actual es una **base funcional de prototipo local**, no una implementación auditada o lista para permitir usuarios externos. No activar despliegue público con las rutas de IA/compilación sin capa de autenticación, rate limiting y cuotas.
