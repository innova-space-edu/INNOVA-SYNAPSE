# Colaboración por proyecto

## Permisos
- Propietario: comparte, cambia permisos, revoca, renombra y elimina el proyecto.
- Editor: consulta, edita archivos, compila, usa el asistente y crea/restaura instantáneas.
- Lector: consulta fuentes, historial y PDF existente; puede descargar ZIP/PDF.
- Una invitación pendiente o vencida no permite leer archivos.
- Las invitaciones se aceptan explícitamente con el correo verificado por Cloudflare Access. Vencen a los 7 días; el propietario puede volver a invitar.
- Solo los administradores de SYNAPSE_ADMIN_EMAILS crean proyectos. Invitar no concede administración.
- No hay enlaces públicos anónimos. Copiar enlace no cambia permisos.

## Activación en el Dell
Actualizar primero el repositorio con git pull --ff-only, ejecutar bash scripts/backup-synapse.sh y comprobar el respaldo. Después:
```bash
docker compose -f compose.intranet.yaml exec -T db psql -U synapse -d synapse -v ON_ERROR_STOP=1 < db/003-collaboration.sql
docker compose -f compose.intranet.yaml up -d --build --no-deps web
```
La migración agrega una revisión y la tabla synapse_members; no elimina proyectos ni modifica documentos anteriores. Puede repetirse. Es obligatoria antes de activar esta versión, también en instalaciones nuevas.

## Cloudflare Access
Conservar el JWT firmado, audiencia y origen privado. Agregar a la política Allow los correos concretos invitados (o un grupo institucional deliberadamente autorizado). No agregar esos correos a SYNAPSE_ADMIN_EMAILS. No usar Bypass ni publicar el origen. La aplicación comprueba permisos por proyecto de manera independiente, aunque Access permita iniciar sesión. Un visitante autenticado sin proyectos solo verá su biblioteca vacía.

## Correos
Definir en .env:
- SYNAPSE_PUBLIC_URL=https://synapse.innova-space-edu.cl
- RESEND_API_KEY: clave del servicio de envío.
- SYNAPSE_MAIL_FROM: remitente verificado, por ejemplo INNOVA SYNAPSE <contacto@innova-space-edu.cl>.

Verificar el dominio remitente y sus registros en Resend antes de enviar. Referencia: https://resend.com/docs/api-reference/emails/send-email
Nunca colocar claves en el navegador ni en Git. No se enviaron invitaciones reales durante la implementación.
Sin configuración, la invitación queda registrada y aparece al iniciar sesión con el correo invitado. La ventana indica que no se envió correo y permite copiar el enlace. Un error de envío conserva la invitación y se informa; no se afirma entrega. Esperar al menos un minuto antes de reenviar a un correo pendiente. Máximo 100 colaboradores por proyecto.

## Guardado y conflictos
Cada lectura entrega una revisión del servidor. Cada guardado exige If-Match y bloquea la fila durante la comprobación de permisos y la actualización. Dos escrituras sobre la misma revisión producen un guardado correcto y un conflicto 409. El servidor rechaza clientes antiguos sin revisión para evitar sobrescrituras.
La aplicación conserva el contenido local ante conflicto y bloquea nuevas ediciones; ofrece exportarlo como ZIP y cargar la versión del servidor. Actualizar proyecto permite traer los cambios de otros colaboradores, previa confirmación.

Esta versión permite colaboración con guardado protegido y actualización manual. No implementa cursores compartidos ni fusión de pulsaciones en tiempo real. No abrir un proyecto en dos sesiones esperando una fusión automática.

## Verificación
El trabajo jsonb-postgres de GitHub Actions ejecuta tests/collaboration.integration.mjs contra rutas Next.js reales y PostgreSQL desechable. Comprueba acceso ajeno, invitaciones, aceptación por correo, lector, editor, revocación, expiración, aislamiento, origen y dos guardados simultáneos. No usa correo ni claves reales.

El despliegue completo con bash scripts/deploy-dell.sh deploy arranca la BD, crea un respaldo y aplica la migración antes de activar web. Para una actualización de solo web puede usarse el procedimiento anterior.
