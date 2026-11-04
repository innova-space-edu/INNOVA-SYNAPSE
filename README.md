# INNOVA SYNAPSE — Editor científico privado

Aplicación independiente de OpenAI Prism para LaTeX, investigación científica, PDF e IA. No incorpora código privado de OpenAI.

## Modo intranet (en desarrollo; aún NO instalado)

Se prepara para funcionar como **sesión administrativa separada** de la intranet Innova Space Education, con el hostname previsto `synapse.innova-space-edu.cl`.

- **Acceso:** Cloudflare Zero Trust Access (aplicación dedicada, correo admin exacto, OTP/IdP). El backend verifica el JWT firmado, emisor, audiencia y email permitido en cada ruta privada. Sin configuración, deniega todo.
- **Persistencia:** PostgreSQL propio, `synapse_pgdata`, proyecto y versiones, chat y último PDF. No usa `intranet-db` ni la sesión Better Auth de la intranet.
- **Servidor:** Docker Compose en `/srv/intranet/synapse`; web en `127.0.0.1:3410` y en la red compartida `portal_default`, compilador y base en red privada; reinicios automáticos.
- **Integración:** crear enlace **INNOVA SYNAPSE** dentro de `/dashboard/empresa` solo para el rol `admin`, sin alterar permisos del portal. El enlace todavía no se ha instalado.
- **Backups:** script `scripts/backup-synapse.sh` y timer systemd en `ops/systemd`, todavía no activados ni probados en Dell.

## Funciones existentes

Panel oscuro de proyectos, explorador **Archivos / Conversaciones**, CodeMirror LaTeX, PDF lateral y descarga, ZIP de archivos, compilación aislada con TeX Live, chat IA opcional (Gemini, Groq, OpenRouter, OpenAI, SambaNova, Cerebras, Together), guardado en servidor y snapshots.

**Limitaciones:** no hay colaboración Yjs, comentarios, Zotero/arXiv, voz, OCR, MFA adicional a la política Access o un panel de cuotas de IA. Falta probar la compilación en Docker y comprobar el funcionamiento en la infraestructura real.

## Preparación en Dell (solo con acceso autorizado)

```bash
ssh estefano@100.90.202.99
sudo mkdir -p /srv/intranet/synapse /srv/intranet/backups/synapse
sudo chown "$USER":"$USER" /srv/intranet/synapse
git clone https://github.com/innova-space-edu/INNOVA-SYNAPSE.git /srv/intranet/synapse
cd /srv/intranet/synapse
cp .env.intranet.example .env
chmod 600 .env
# Editar .env con los secretos generados EN EL SERVIDOR, Access AUD, team y correo autorizado.
docker compose -f compose.intranet.yaml config --quiet
docker compose -f compose.intranet.yaml up -d --build
bash scripts/check-synapse.sh
```

**No ejecutes un despliegue sin verificar los valores de Access y la política del túnel.** El MCP Dell actual admite diagnósticos, pero no está habilitado para instalar SYNAPSE en el anfitrión.

### Desarrollo local

```bash
npm install
# disponer de PostgreSQL SYNAPSE y aplicar db/001-initial.sql
# .env.local: SYNAPSE_LOCAL_DEV=true + SYNAPSE_DATABASE_URL=...
npm run dev -- --hostname 127.0.0.1
```

## Documentación

- [Administración e integración a Dell](docs/INTRANET-ADMIN.md)
- [Arquitectura](docs/ARQUITECTURA.md)
- [Seguridad](docs/SEGURIDAD.md)
- [Matriz de funcionalidades de Prism](docs/PRISM-MATRIZ.md)
- [Hoja de ruta](docs/HOJA-DE-RUTA.md)
- [Migración desde Prism](docs/MIGRACION-PRISM.md)

**Estado:** código en revisión. El dominio y enlace administrativo no están publicados.
