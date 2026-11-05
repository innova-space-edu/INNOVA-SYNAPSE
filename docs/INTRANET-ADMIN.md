# INNOVA SYNAPSE — módulo reservado a administrador

## Integración elegida
**Aplicación separada** de la intranet, accesible únicamente desde un enlace dentro de `/dashboard/empresa` del portal principal (menú *INNOVA SYNAPSE*). La aplicación utiliza otro hostname, otra cookie/sesión de Cloudflare Access y otra base de datos. No reemplaza ni comparte el inicio de sesión Better Auth del portal.

- Intranet existente: `https://intranet.innova-space-edu.cl`, contenedor `intranet-portal`, PostgreSQL `intranet-db`.
- SYNAPSE en servicio según capturas del usuario (5 de noviembre de 2026): `https://synapse.innova-space-edu.cl`, contenedor `synapse-web`, DB dedicada `synapse-db`.
- Docker: misma red externa `portal_default` solamente para `synapse-web`; DB y compilador en red interna del stack SYNAPSE.
- Cloudflare Tunnel existente puede resolver `http://synapse-web:3000` sin exponer el puerto; si usa `intranet-web` como reverse proxy, configurar ruta upstream sin alterar reglas de intranet.
- Firewall: `127.0.0.1:3410` solo pruebas en el servidor. **Nunca abrir 3410, 5432 ni 8000 a Internet.**
- Acceso por Zero Trust: crear una **aplicación Self-hosted independiente** para SYNAPSE, con política Allow de una sola dirección de correo administradora, autenticación One-time PIN (o IdP actual), sesión corta (15–30 min), preferentemente verificación multifactor.
- Servidor SYNAPSE verifica criptográficamente el JWT `Cf-Access-Jwt-Assertion`, emisor, audiencia y correo permitido. Según la sesión mostrada por el usuario, Cloudflare Access y los valores del entorno están funcionando. No publicar ni copiar esos valores fuera de Dell. No existe una puerta trasera por correo de cabecera.
- **Importante:** si ya existe una cookie global de Cloudflare, puede no solicitar una contraseña otra vez; aun así emite un token de aplicación diferente y aplica su política propia. Para independencia adicional, usar otro IdP, sesión más corta o forzar reautenticación según las opciones del panel Access.

## Entrada desde Innova Empresa
En la navegación protegida del portal `/dashboard/empresa` agregar una opción **Investigación > INNOVA SYNAPSE**, visible solo si Better Auth verifica `role === 'admin'`. Link externo a `https://synapse.innova-space-edu.cl` (misma pestaña o nueva). No basarse solo en ocultar el botón: Cloudflare Access y el verificador de la app deben bloquear visitas directas y llamadas `/api/*` no autorizadas.

**No modificar automáticamente** el código de `/srv/intranet/portal`: inspeccionar componentes de menú y guards existentes primero. Un parche incorrecto rompería la sesión de la intranet. El enlace es un cambio pendiente en el repositorio/deploy del portal, separado de este stack.

## Condiciones antes de exponerlo
1. Las comprobaciones de GitHub CI están verdes.
2. Copiar `.env.intranet.example` a `.env` en Dell; valores secretos solo en el anfitrión, permisos 0600.
3. Cloudflare Access configurado y probado desde ventana privada: sin sesión → bloqueo/login, no admin → 403, admin → acceso, después de expirar → bloqueo.
4. Tunnel con regla específica solo para hostname SYNAPSE.
5. DB y volúmenes persistentes; validar el flujo crear/guardar/recargar, importar ZIP, compilar y exportar PDF.
6. Activar timer de backup después de **probar restauración de una copia en una base de pruebas**.
7. Cloudflare WAF/rate limiting en endpoint de SYNAPSE; no aceptar documentos LaTeX ajenos sin aislamiento reforzado del compilador.

## Operación del servidor Dell
El MCP actual permite diagnóstico, pero el agente administrativo declara un catálogo de despliegue restringido a `intranet` y no permite instalar SYNAPSE directamente. Se necesita añadir el proyecto `synapse` a una lista permitida mediante un cambio aprobado y con rollback. Conector **no equivale a acceso SSH/shell**; no se ha instalado SYNAPSE en el anfitrión por el simple hecho de que MCP responda.

## Comandos en el host (cuando se autorice el despliegue)
```bash
ssh estefano@100.90.202.99
sudo mkdir -p /srv/intranet/synapse /srv/intranet/backups/synapse
sudo chown "$USER":"$USER" /srv/intranet/synapse
git clone https://github.com/innova-space-edu/INNOVA-SYNAPSE.git /srv/intranet/synapse
cd /srv/intranet/synapse
cp .env.intranet.example .env
chmod 600 .env
# Editar secretos, emisor y audiencia reales de Access; NO ponerlos aquí ni compartirlos por chat.
docker compose -f compose.intranet.yaml config --quiet
docker compose -f compose.intranet.yaml up -d --build
bash scripts/check-synapse.sh
```
Antes de cambiar túnel/portal: comprobar aplicación en Docker y DB; hacer backup inicial.

## Operaciones de mantenimiento
- Ver salud: `bash scripts/check-synapse.sh`
- Ver logs: `docker compose -f compose.intranet.yaml logs --tail=100 web`
- Actualizar con versión fija y backup previo: `git fetch --tags; git checkout <tag-verificada>; docker compose -f compose.intranet.yaml up -d --build`
- Volver a versión anterior: `git checkout <tag-anterior>; docker compose -f compose.intranet.yaml up -d --build`
- Reinicio de solo SYNAPSE: `docker compose -f compose.intranet.yaml restart web`
- **No ejecutar** `docker compose down -v` ni `docker system prune --volumes`: borrarían el volumen de datos.
- Backup: `bash scripts/backup-synapse.sh` con permisos adecuados.
- Backup remoto/cifrado: configurar de forma independiente; el timer local por sí solo no protege contra pérdida completa del disco.
