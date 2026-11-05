#!/usr/bin/env bash
# One-off SYNAPSE double-encoded JSONB repair. Run from Dell host only.
# --check: read-only counts. --apply: verified backup + atomic validation/repair.
set -Eeuo pipefail
umask 077
cd "$(dirname "${BASH_SOURCE[0]}")/.."
compose=(docker compose -f compose.intranet.yaml)
db=(docker compose -f compose.intranet.yaml exec -T db)
mode="${1:---check}"

if [[ ! -f compose.intranet.yaml || ! -f db/002-repair-double-encoded-jsonb.sql ]]; then
  echo "Faltan archivos necesarios de SYNAPSE" >&2
  exit 1
fi
if [[ "${mode}" != "--check" && "${mode}" != "--apply" ]]; then
  echo "Uso: bash scripts/repair-jsonb.sh [--check|--apply]" >&2
  exit 2
fi

echo "== Estado actual de JSONB en SYNAPSE (solo conteos) =="
"${db[@]}" psql -X -U synapse -d synapse -v ON_ERROR_STOP=1 -P pager=off -c "
  SELECT 'proyectos' AS tipo, jsonb_typeof(document) AS formato, count(*) AS registros
  FROM synapse_projects GROUP BY jsonb_typeof(document)
  UNION ALL
  SELECT 'instantaneas', jsonb_typeof(payload), count(*)
  FROM synapse_snapshots GROUP BY jsonb_typeof(payload)
  ORDER BY 1,2;
"
if [[ "$mode" == "--check" ]]; then
  echo "Verificación de solo lectura completada. Usa --apply para respaldar y reparar."
  exit 0
fi

backup_dir="${SYNAPSE_BACKUP_DIR:-/srv/intranet/backups/synapse}"
if [[ -L "$backup_dir" ]]; then
  echo "No se permiten enlaces simbólicos en el destino de respaldo" >&2
  exit 1
fi
if ! mkdir -p -- "$backup_dir"; then
  echo "Sin permisos para crear $backup_dir. Prepara la carpeta con un propietario autorizado." >&2
  exit 1
fi
chmod 700 -- "$backup_dir"
backup="$backup_dir/synapse-before-jsonb-repair-$(date -u +%Y%m%dT%H%M%SZ)-$$.dump"
echo "== Creando respaldo completo de PostgreSQL SYNAPSE =="
"${db[@]}" pg_dump -Fc -U synapse -d synapse > "$backup"
test -s "$backup"
"${db[@]}" pg_restore --list < "$backup" >/dev/null
sha256sum "$backup" > "$backup.sha256"
echo "Respaldo creado y comprobado en $backup"
echo "== Reparación SQL transaccional, sin borrado de proyectos =="
"${db[@]}" psql -X -U synapse -d synapse -v ON_ERROR_STOP=1 -P pager=off < db/002-repair-double-encoded-jsonb.sql

echo "== Verificación final de tipos JSONB =="
"${db[@]}" psql -X -U synapse -d synapse -v ON_ERROR_STOP=1 -P pager=off -c "
  SELECT 'proyectos' AS tipo, jsonb_typeof(document) AS formato, count(*) AS registros
  FROM synapse_projects GROUP BY jsonb_typeof(document)
  UNION ALL
  SELECT 'instantaneas', jsonb_typeof(payload), count(*)
  FROM synapse_snapshots GROUP BY jsonb_typeof(payload)
  ORDER BY 1,2;
"
echo "SYNAPSE: reparación finalizada. Respaldo conservado: $backup"
