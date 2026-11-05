# Reparación de proyectos JSONB serializados dos veces (Dell)

## Síntoma y causa

`jsonb_typeof(document) = 'string'` indica que un proyecto está almacenado
como cadena JSON en lugar de objeto. Los botones de la biblioteca pueden
abrir la API, pero el editor no encuentra `name` o `files`.
También puede afectar a `synapse_snapshots.payload`.

La causa original fue llamar a `JSON.stringify(project)` antes de enviar
el valor a Postgres.js como JSONB. El código corregido usa
`sql.json(project)` (y `sql.json(snapshot)`) para serializar solo una vez.

## Preparación segura

1. Confirma que estás en `/srv/intranet/synapse` y has actualizado
   la rama `main` que incluye el parche.
2. El script solo actúa sobre la BD dedicada de SYNAPSE, NO la intranet.
3. Crea una carpeta de respaldo restringida, si todavía no puedes escribir en ella:

   ```bash
   sudo install -d -m 0700 -o "$(id -un)" -g "$(id -gn)" /srv/intranet/backups/synapse
   ```

4. Revisa los tipos almacenados, sin escribir:

   ```bash
   bash scripts/repair-jsonb.sh --check
   ```

5. Ejecuta solo una vez la recuperación explícita:

   ```bash
   bash scripts/repair-jsonb.sh --apply
   ```

## Qué hace --apply

- Genera una copia de seguridad completa de SYNAPSE con `pg_dump -Fc`.
- Verifica que el archivo puede leerse con `pg_restore --list` y
  registra SHA-256. No borra respaldos antiguos.
- En una transacción PostgreSQL, procesa solo documentos cuyo JSONB sea
  **string**, los transforma en objetos solo cuando pasan validaciones:
  UUID consistente con la fila, nombre, archivo principal, lista de archivos
  y tipos de campos.
- Repara de la misma manera las instantáneas.
- Si detecta contenido corrupto/inconsistente, aborta y revierte **todo**.
  No intenta adivinar ni reconstruir información faltante.
- Conserva los identificadores, propietario, fechas y bytes de los
  contenidos JSON tras la normalización semántica.
- No cambia contraseñas, archivos del editor, Cloudflare, otros contenedores
  ni volúmenes.

**Importante:** el backup contiene trabajos científicos privados.
No lo subas a GitHub ni lo pegues en chats.

## Después

Abrir en navegador autenticado:
`https://synapse.innova-space-edu.cl/api/projects` y luego el editor.

Verifica que `--check` muestre solamente `object` para los proyectos
recuperados. Prueba crear uno nuevo, guardar, recargar y compilar PDF.
La recuperación se considera completa solo tras abrir los tres registros
históricos y confirmar sus archivos.
