# INNOVA SYNAPSE

Plataforma independiente de investigación y escritura científica, basada en funcionalidades observables de OpenAI Prism. **No es un producto de OpenAI ni usa código privado de Prism.**

## Estado: prototipo inicial

Interfaz oscura siguiendo las capturas de referencia: dashboard de proyectos, explorador de archivos, editor LaTeX CodeMirror, visor PDF y chat contextual con IA. Guardado automático local (IndexedDB), instantáneas restaurables y conversaciones IA persistentes; importación/exportación ZIP. Los servicios de compilación e IA requieren configuración. La colaboración, cuentas, permisos y respaldo remoto aún no están implementados.

## Comenzar

**Node.js 22+**:

```bash
npm install
npm run dev
```

Abrir `http://localhost:3000`. Para compilar archivos LaTeX es necesario levantar el servicio separado:

```bash
cp .env.example .env
# Establecer LATEX_COMPILER_TOKEN con un token aleatorio largo
# Si trabajas exclusivamente en localhost, habilita SYNAPSE_ENABLE_DEMO_APIS=true
# y, si se desea IA, configurar las claves y modelos propios.
docker compose up --build
```

La aplicación web se publica **solo en 127.0.0.1:3000** en Compose por defecto. Las rutas de IA/compilación están deshabilitadas salvo que se establezca `SYNAPSE_ENABLE_DEMO_APIS=true`. Usar esta opción **únicamente en un entorno local controlado**. No publicar el compilador ni activar rutas de demostración en Vercel o Internet sin autenticación y cuotas.

## Características del MVP

- Crear, buscar, duplicar, renombrar y eliminar proyectos.
- Editor de múltiples archivos con árbol lateral, paneles redimensionables, autoguardado en IndexedDB, hasta 20 instantáneas locales y modo oscuro.
- Importar ZIP con `.tex`, `.bib`, `.sty`, `.cls` e imágenes, y exportar el proyecto a ZIP.
- PDF después de compilar en contenedor de TeX Live; log de errores y descarga.
- Chat contextual persistente por proyecto local con claves de Gemini, OpenAI, Groq, OpenRouter, SambaNova, Cerebras o Together API. No se inventan modelos: cada proveedor requiere `*_MODEL`.
- La IA sugiere revisiones: el editor no cambia automáticamente sin confirmación.

## Módulos planeados (no listos)

Colaboración Yjs, comentarios, roles, PostgreSQL, almacenamiento remoto privado, snapshots, búsqueda bibliográfica Zotero/arXiv/Crossref, voz, OCR matemático, revisión académica, más plantillas y panel de administración.

## Referencias y documentación

- [Arquitectura y plan de producción](docs/ARQUITECTURA.md)
- [Matriz de cobertura Prism](docs/PRISM-MATRIZ.md)
- [Seguridad y limitaciones](docs/SEGURIDAD.md)
- [OpenPrism (MIT)](https://github.com/OpenDCAI/OpenPrism)
- [assistant-ui/open-prism (MIT)](https://github.com/assistant-ui/open-prism)
- [TeXlyre (AGPL: evaluar obligaciones)](https://github.com/TeXlyre/texlyre)
- [Overleaf (evaluar edición/licencia y aislamiento)](https://github.com/overleaf/overleaf)

## Normas

No alojar aquí material privado de Prism ni secretos; respetar licencias de terceros, y hacer exportaciones de proyectos propios antes del cierre del servicio.
