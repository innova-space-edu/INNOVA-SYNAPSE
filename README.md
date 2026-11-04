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

**Estado:** preparación de despliegue en código. Todavía no se ha copiado el repositorio al directorio del anfitrión, iniciado el stack en producción, configurado la ruta web ni añadido el enlace al menú. El conector Dell no tiene permiso para hacerlo por sí mismo actualmente.

## Funcionalidades

Dashboard y búsqueda de proyectos, importación/exportación ZIP, editor LaTeX multiarchivo CodeMirror, panel de Archivos/Conversaciones, visor PDF, compilación TeX Live, chat contextual con API keys opcionales de proveedores de IA, guardado en PostgreSQL y snapshots restaurables. No incluye todavía colaboración en tiempo real, Zotero/arXiv, OCR de ecuaciones ni voz.

## Más documentación

- [Guía de instalación Dell](docs/INSTALACION-DELL.md)
- [Seguridad](docs/SEGURIDAD.md)
- [Arquitectura](docs/ARQUITECTURA.md)
- [Integración con panel administrativo](docs/INTRANET-ADMIN.md)
- [Matriz de funcionalidades](docs/PRISM-MATRIZ.md)
- [Migración de documentos](docs/MIGRACION-PRISM.md)

## Pruebas

```bash
npm install
npm run typecheck
npm run lint
npm test
npm run build
python3 -m unittest discover -s compiler -p 'test_*.py'
bash -n scripts/deploy-dell.sh scripts/check-synapse.sh scripts/smoke-compiler.sh
```

Se requieren además pruebas funcionales reales de Docker, compilación, autenticación y restauración antes de considerar completada la publicación.
