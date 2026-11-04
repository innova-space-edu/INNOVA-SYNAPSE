# Arquitectura — INNOVA SYNAPSE (Intranet Dell)

Next.js 16, React, TypeScript y CodeMirror; LaTeX con FastAPI/TeX Live en contenedor; IA por API con proveedores configurables.

## Acceso
Cloudflare Access dedicado, correo administrador exacto, JWT firmado comprobado en Next Proxy y **en cada endpoint privado**; no confiar en una cabecera de rol. Sin configurar team, AUD y lista de admin, la app bloquea la sesión. El enlace desde `/dashboard/empresa` deberá mostrarlo Better Auth solo al admin, pero esta modificación en intranet está pendiente.

## Persistencia
PostgreSQL 17 independiente (`synapse_projects`, `synapse_snapshots`, `synapse_pgdata`) almacena contenido, versiones (máximo 20), conversaciones y último PDF. No se reutiliza `intranet-db`. Se incluyen procedimientos de pg_dump y timer systemd, sin instalación automática.

## Aislamiento
Compose independiente: `synapse-web` comparte únicamente la red `portal_default` para que el túnel reverse-proxy pueda alcanzarlo; `db` y `compiler` solo comparten la red `internal` de Synapse. Web escucha en localhost:3410 del anfitrión para pruebas, sin puerto público.

## Alcance no completado
No hay enlace en la intranet, reglas Cloudflare Access, secretos reales, despliegue Dell o smoke test; tampoco colaboración Yjs, RAG académico ni agentes. Las rutas solo aceptan sesión de administrador verificable. <Mantenimiento futuro>: copia externa cifrada, cuotas IA, aislamiento reforzado de compilación y pruebas restore.
