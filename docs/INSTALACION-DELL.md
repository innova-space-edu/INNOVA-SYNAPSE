# Instalar INNOVA SYNAPSE en el Dell — alojamiento 100 % propio

## Alcance
La aplicación Next.js, el compilador TeX Live y PostgreSQL se ejecutan en el Dell. Las claves de proveedores de IA externos son **opcionales**. No se crea ni configura ningún proyecto externo de alojamiento web.

La aplicación se instala **aislada** de los contenedores existentes y solo `synapse-web` entra a `portal_default`, red del proxy/túnel actual. PostgreSQL y compilador permanecen en una red Docker interna. El puerto `3410` está enlazado a `127.0.0.1` en el host. El sitio se protege con **Cloudflare Access**, que valida identidad y emite un JWT por aplicación; SYNAPSE vuelve a verificar firma, audiencia y correo del administrador.

## Requisitos antes de empezar
- Debian con Docker Engine y Docker Compose activos; acceso SSH/Tailscale con permisos Docker.
- `portal_default` existente (de la intranet); al menos 8 GiB de espacio libre.
- Un correo de administrador y una aplicación Self-hosted en Cloudflare Access destinada a SYNAPSE, con su Team Domain y su Application AUD. No usar una política de dominio de correo genérica; permitir solo el correo correcto.
- No publicar `3410`, `5432`, `8000` en el firewall ni exponer Docker al MCP.
- Comprobar que el entorno de producción no incluye secretos en GitHub.

## 1. Copiar el proyecto íntegro desde GitHub al Dell

Conectarse al servidor (SSH sobre Tailscale) y ejecutar:

```bash
sudo install -d -m 0750 -o "$(id -un)" -g "$(id -gn)" /srv/intranet/synapse
git clone https://github.com/innova-space-edu/INNOVA-SYNAPSE.git /srv/intranet/synapse
cd /srv/intranet/synapse
git rev-parse --short HEAD
bash scripts/deploy-dell.sh prepare
```

`prepare` crea `.env` modo 0600 con tokens aleatorios para BD y compilador y **no inicia servicios**. Si `.env` ya existe, no sobrescribe credenciales.

## 2. Configurar el acceso exclusivo del administrador

Editar `.env` **solo en el Dell**:

```bash
nano /srv/intranet/synapse/.env
```

Cambiar `CF_ACCESS_TEAM_DOMAIN`, `CF_ACCESS_AUD` y `SYNAPSE_ADMIN_EMAILS` por los valores de tu aplicación Access y el correo **único** autorizado. No imprimir valores de `.env` por chat ni subirlo a Git. Mantener los valores generados para `SYNAPSE_DB_PASSWORD` y `LATEX_COMPILER_TOKEN`; nunca cambiarlos sin plan de rotación y respaldo.

Los proveedores IA son opcionales: configurar claves/modelos únicamente si se van a utilizar.

## 3. Preflight y despliegue

```bash
cd /srv/intranet/synapse
bash scripts/deploy-dell.sh preflight
bash scripts/deploy-dell.sh deploy
bash scripts/smoke-compiler.sh
```

El script verifica red, recursos, formato de credenciales y Docker Compose; construye `synapse-web` y `synapse-compiler`, arranca la BD `synapse-db` y ejecuta comprobaciones de salud. **No borra ni reinicia contenedores de intranet, SUU, MaleCNS o NEXORA.** El compilador TeX Live consume espacio y recursos al construir su imagen.

## 4. Ruta web y acceso desde la intranet

Cuando el origen funcione:
1. Añadir una ruta publicada nueva al **Cloudflare Tunnel existente**: hostname `synapse.innova-space-edu.cl` → servicio interno `http://synapse-web:3000`. El contenedor `cloudflared` debe estar realmente conectado a `portal_default` (verificar con `docker inspect`, sin cambiar red a ciegas).
2. Crear/habilitar la aplicación Cloudflare Access de ese hostname con una política **Allow** solo para el email administrador y sesión corta.
3. En `/dashboard/empresa` de la intranet agregar el enlace de menú **INNOVA SYNAPSE** visible solo para administradores. El enlace no concede acceso: Cloudflare Access y el backend lo verifican de forma independiente.
4. Validar desde una ventana incógnita: visitante sin sesión debe ver inicio de Access o bloqueo; cuenta distinta del administrador debe quedar bloqueada; cuenta administrador debe abrir la web y cargar sus proyectos.

**No se ha aplicado ninguna ruta Cloudflare ni editado el portal existente desde este repositorio**; ambos pasos requieren acceso autorizado a la configuración real.

## 5. Verificación y mantenimiento

```bash
bash scripts/deploy-dell.sh status
bash scripts/smoke-compiler.sh
docker compose -f compose.intranet.yaml logs --tail=100 web compiler db
bash scripts/backup-synapse.sh
```

Revisar que un proyecto nuevo se guarda, se recupera tras recargar navegador y tras reiniciar solo `synapse-web`, y que se puede exportar ZIP y PDF. Probar restauración del backup en una **base de prueba**, no en la de producción, antes de habilitar `ops/systemd/synapse-backup.timer`.

Para actualizar el código, primero hacer respaldo y verificar un commit revisado. El sistema **no actualiza automáticamente** desde GitHub ni reinicia otros stacks.

No ejecutar `docker compose down -v` ni eliminar el volumen `synapse_pgdata`.

## Estado de ejecución desde ChatGPT
El conector Dell actual permite comprobar servicios y escribir únicamente en el `/workspace` aislado. El agente administrativo reporta `catalog: []` y **no autoriza registrar ni instalar SYNAPSE**. Por eso esta implementación necesita ejecutar la instalación mediante la cuenta SSH del propietario, o ampliar después el agente con un procedimiento autorizado. La sola presencia de estos archivos en GitHub no implica despliegue en el anfitrión.
