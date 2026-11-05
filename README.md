# INNOVA SYNAPSE — investigación científica autohospedada

Editor de documentos LaTeX y plataforma de investigación científica independiente, inspirado visualmente en el flujo de Prism. No contiene código privado de Prism.

## Alojamiento elegido: servidor Dell de Innova Space Education

**INNOVA SYNAPSE se alojará directamente en nuestro servidor Debian**, dentro de la infraestructura de intranet. No se requiere una plataforma de alojamiento web externa. El código principal, los proyectos y su compilación permanecen en el Dell.

| Componente | Dónde funciona |
| --- | --- |
| Next.js 16 y editor web | `synapse-web` (Docker en Dell) |
| PostgreSQL 17 | `synapse-db`, volumen independiente `synapse_pgdata` |
| LaTeX / PDF | `synapse-compiler` con TeX Live |
| Entrada web | Cloudflare Tunnel ya existente, como nueva ruta protegida |
| Autorización | Cloudflare Access JWT verificado por SYNAPSE y correo administrador |
| Menú administrativo | Enlace pendiente en la intranet actual |

La instalación no comparte base de datos con el portal ni tiene permisos para modificar SUU o MaleCNS.

### Instalación

Sigue la guía completa: **[INSTALACION-DELL.md](docs/INSTALACION-DELL.md)**.

El procedimiento copia el repositorio entero a `/srv/intranet/synapse` mediante Git, crea las claves localmente en Debian, ejecuta preflight y construye tres contenedores.

```bash
sudo install -d -m 0750 -o "$(id -un)" -g "$(id -gn)" /srv/intranet/synapse
git clone https://github.com/innova-space-edu/INNOVA-SYNAPSE.git /srv/intranet/synapse
cd /srv/intranet/synapse
bash scripts/deploy-dell.sh prepare
# Configurar únicamente en el Dell el correo admin, Team Domain y AUD de Cloudflare Access en .env
bash scripts/deploy-dell.sh preflight
bash scripts/deploy-dell.sh deploy
bash scripts/smoke-compiler.sh
```

**Estado observado (5 de noviembre de 2026):** El usuario confirmó mediante capturas y registros de Docker que el stack SYNAPSE está desplegado en el Dell, Cloudflare Access autentica al administrador, la API de proyectos responde y el editor carga documentos. La prueba CLI de TeX Live produjo un PDF. Esto no acredita todavía que el botón de compilación y descarga funcione de extremo a extremo en el navegador. La integración del enlace en el menú administrativo de la intranet sigue pendiente. El conector de Dell no permite desplegar ni configurar directamente este servicio.

## Funcionalidades

Dashboard, botón **Proyectos creados**, lista separada **Por recuperar** (solo lectura), búsqueda de proyectos, importación/exportación ZIP, editor LaTeX multiarchivo CodeMirror, panel de Archivos/Conversaciones, visor PDF, compilación TeX Live, chat contextual con API keys opcionales de proveedores de IA, guardado en PostgreSQL y snapshots restaurables. No incluye todavía colaboración en tiempo real, Zotero/arXiv, OCR de ecuaciones ni voz.

## Más documentación

- [Guía de instalación Dell](docs/INSTALACION-DELL.md)
- [Seguridad](docs/SEGURIDAD.md)
- [Arquitectura](docs/ARQUITECTURA.md)
- [Integración con panel administrativo](docs/INTRANET-ADMIN.md)
- [Matriz de funcionalidades](docs/PRISM-MATRIZ.md)
- [Migración de documentos](docs/MIGRACION-PRISM.md)

## Verificación de producción en el Dell

```bash
cd /srv/intranet/synapse
bash scripts/audit-dell.sh
```

La auditoría muestra el estado de los contenedores, conteos de proyectos según formato JSONB, presencia (sin revelar valores) de configuración Cloudflare y modelos/keys de IA, número de respaldos locales y timers visibles. No prueba por sí sola la validez de las API keys ni que un respaldo sea restaurable.

**Proyectos antiguos:** si la biblioteca indica registros por recuperar, la sección **Por recuperar** permite ver su nombre y cantidad de archivos sin modificar datos. La migración debe ejecutarla el administrador del Dell solo tras un respaldo verificado:

```bash
bash scripts/repair-jsonb.sh --check
bash scripts/repair-jsonb.sh --apply
bash scripts/repair-jsonb.sh --check
```

[Procedimiento de recuperación y protección de datos](docs/RECUPERACION-JSONB.md). No ejecutar `--apply` si no se puede crear el respaldo o si la salida evidencia datos no reconocidos.

### Pendiente de comprobar antes de declarar la instalación completa

- Recuperación de los tres registros previos con `jsonb` tipo `string` y confirmación de archivos tras abrirlos.
- Crear, cambiar, guardar, recargar, exportar ZIP y compilar/descargar PDF desde el navegador.
- Probar cada proveedor de IA con API key/modelo válido (sin mostrar credenciales).
- Programar respaldos periódicos y demostrar restauración a base de datos de prueba; cifrado/copia fuera del servidor.
- Añadir el enlace exclusivo para administradores al menú de la intranet, sin modificar servicios no autorizados.
- Revisión de MFA, rate limiting, aislamiento de TeX y controles de privacidad (ver Seguridad).

## Pruebas

```bash
npm install
npm run typecheck
npm run lint
npm test
npm run build
python3 -m unittest discover -s compiler -p 'test_*.py'
bash -n scripts/deploy-dell.sh scripts/check-synapse.sh scripts/smoke-compiler.sh scripts/audit-dell.sh scripts/repair-jsonb.sh
```

Se requieren además pruebas funcionales reales de Docker, compilación, autenticación y restauración antes de considerar completada la publicación.
