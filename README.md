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

### Opciones en «Por recuperar»

Los proyectos JSONB antiguos con contenido válido ofrecen tres acciones por registro:

- **Recuperar copia**: lee el JSON original y crea **otro** proyecto con identificador nuevo, que puede abrirse inmediatamente. El registro anterior no cambia. El historial de instantáneas del antiguo no se transfiere a la copia.
- **Exportar ZIP**: descarga los archivos del proyecto antiguo, sin alterar PostgreSQL; no contiene instantáneas históricas ni representa un respaldo completo de la base de datos.
- **Eliminar**: requiere escribir el UUID completo como confirmación. La API comprueba que el registro **aún sea un JSONB string**, pertenezca al administrador autenticado y solo entonces lo elimina; por la relación ON DELETE CASCADE, también elimina sus instantáneas. Esta acción es irreversible salvo que exista un respaldo completo de PostgreSQL.

Para una recuperación integral de datos/historiales, preferir la migración transaccional con respaldo `bash scripts/repair-jsonb.sh --apply`. Nunca usar «Eliminar» para intentar arreglar un proyecto sin haber comprobado antes si su contenido es recuperable.

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

## Optimización del editor y agentes de escritura (noviembre de 2026)

- **Editor LaTeX:** CodeMirror y su gramática TeX se cargan como componente cliente diferido para reducir el JavaScript inicial del espacio de trabajo. El área de código tiene scroll vertical y horizontal independiente del visor PDF.
- **Asistente compacto:** cuadro de entrada de altura fija (36 px) y conversación acotada con scroll propio; historial en PostgreSQL.
- **Especialidades de IA:** Editar (cambios mínimos), LaTeX (sintaxis y diagnóstico con el registro de compilación), Revisar (coherencia científica) y Referencias (claves BibTeX y citas). Una petición utiliza **solo un proveedor/modelo**.
- **Automatización local rápida:** instrucciones inequívocas como «cambia el año de 2027 a 2026» generan propuestas de diferencias sin llamar al modelo externo. Cada propuesta exige aceptación del usuario.
- **Velocidad y consumo:** máximo cuatro mensajes recientes y hasta 12 000 caracteres del archivo (8 000 para revisión), en vez de enviar todo el documento. Espera máxima del proveedor: 45 segundos.
- **Errores del proveedor:** si devuelve HTML, problemas de autenticación, cuota o una respuesta malformada, se informa en el chat sin mostrar HTML, API keys ni datos internos.

**Limitaciones:** no hay un sistema multiagente autónomo que edite varios archivos, valide DOI contra fuentes externas ni compile automáticamente cada cambio. La disponibilidad de proveedores requiere comprobación individual desde Dell.

### Diagnóstico de IA

```bash
cd /srv/intranet/synapse
docker compose -f compose.intranet.yaml logs --tail=80 --no-color web | grep SYNAPSE_AI
bash scripts/audit-dell.sh
```

Si un modelo sigue devolviendo 502, revisar API key, identificador de modelo, endpoint y cuota. No compartir credenciales ni tokens.

## Revisión de cambios directamente sobre el código (noviembre de 2026)

El asistente trabaja como una herramienta compacta y no debe tapar el editor. Al recibir una propuesta de edición LaTeX, SYNAPSE contrae automáticamente el chat y muestra sobre el archivo activo:

- Texto **rojo**: fragmento original que se reemplazará.
- Texto **verde**: contenido nuevo propuesto, visualizado por CodeMirror sin modificar el documento.
- Controles **✕ Rechazar** y **✓ Aceptar** junto a la cabecera del editor.

Al aceptar se comprueba la huella del archivo y la unicidad de los fragmentos, se guarda una instantánea anterior en Historial, se persiste la modificación en la base de datos propia de SYNAPSE y se inicia automáticamente la compilación PDF sobre la versión aceptada. Si el compilador falla, el cambio guardado no se revierte y se mantiene el mensaje de error en el registro. Al rechazar se conserva el código original. El asistente conserva mensajes cortos en vez de una vista de diferencias extensa dentro del chat.

El área CodeMirror posee un contenedor de altura acotada y scroll vertical independiente del PDF. El panel desplegado del asistente tiene altura máxima de 238 px y su entrada no supera 34 px; los mensajes tienen scroll interno.

**Verificación requerida en producción:** abrir documento largo, desplazar el código, generar una propuesta con Groq, comprobar colores rojo/verde y controles ✓/✕, aceptar, esperar compilación y refrescar para comprobar que texto y PDF se conservaron. Esta validación de navegador es distinta de las pruebas automáticas del repositorio.

## Compartir proyectos e invitar colaboradores
Disponible en el código: ventana Compartir, invitaciones por correo con aceptación, permisos propietario/editor/lector, retirada de acceso y biblioteca Compartido contigo. Los guardados incluyen revisión para rechazar sobrescrituras entre sesiones. La actualización de cambios de otros usuarios es manual; aún no hay edición simultánea de pulsaciones.

**Antes de desplegar:** respaldar y aplicar db/003-collaboration.sql; después reconstruir web. Configurar los correos permitidos en Cloudflare Access sin hacerlos administradores. El envío opcional utiliza RESEND_API_KEY, SYNAPSE_MAIL_FROM y SYNAPSE_PUBLIC_URL. Si no están configurados, se informa que la invitación se registró sin enviar correo y se puede copiar el enlace.

Procedimiento, alcance, permisos y comprobaciones: [docs/COLABORACION.md](docs/COLABORACION.md).
