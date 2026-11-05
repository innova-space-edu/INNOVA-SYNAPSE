#!/usr/bin/env bash
# Read-only health and readiness audit. Never prints keys or token values.
set -Eeuo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

echo "== SYNAPSE: código y servicios =="
printf 'Commit: '; git rev-parse --short HEAD
docker compose -f compose.intranet.yaml ps
bash scripts/check-synapse.sh

echo "== Integridad de proyectos almacenados (conteos solamente) =="
docker compose -f compose.intranet.yaml exec -T db psql -X -U synapse -d synapse \
  -v ON_ERROR_STOP=1 -P pager=off -c "
SELECT 'proyectos' AS tipo, jsonb_typeof(document) AS formato, count(*) AS cantidad
FROM synapse_projects GROUP BY jsonb_typeof(document)
UNION ALL
SELECT 'instantaneas', jsonb_typeof(payload), count(*)
FROM synapse_snapshots GROUP BY jsonb_typeof(payload)
ORDER BY 1,2;"

echo "== Proveedores y configuración (solo indicadores; sin secretos) =="
docker compose -f compose.intranet.yaml exec -T web node - <<'NODE'
const env = process.env;
for (const name of ['CF_ACCESS_TEAM_DOMAIN','CF_ACCESS_AUD','SYNAPSE_ADMIN_EMAILS','LATEX_COMPILER_TOKEN']) {
  console.log(name + ': ' + (env[name]?.trim() ? 'presente' : 'faltante'));
}
for (const name of ['OPENAI','GEMINI','GROQ','OPENROUTER','SAMBANOVA','CEREBRAS','TOGETHER']) {
  const key = Boolean(env[name + '_API_KEY']?.trim());
  const model = Boolean(env[name + '_MODEL']?.trim());
  console.log(name + ': ' + (key && model ? 'clave y modelo configurados; API no probada' : key ? 'falta modelo' : model ? 'falta API key' : 'sin configurar'));
}
NODE

echo "== Respaldos locales (solo recuento; no significa restauración validada) =="
backup_dir="${SYNAPSE_BACKUP_DIR:-/srv/intranet/backups/synapse}"
if [[ -d "$backup_dir" && -r "$backup_dir" ]]; then
  find "$backup_dir" -maxdepth 1 -type f \( -name 'synapse_*.sql.gz' -o -name 'synapse-before-jsonb-repair-*.dump' \) \
    -printf '.' | wc -c | awk '{print "Archivos de respaldo:", $1}'
else
  echo "Carpeta inaccesible o inexistente: $backup_dir"
fi

echo "== Timer de respaldo local =="
if command -v systemctl >/dev/null 2>&1; then
  systemctl list-timers --all --no-pager 2>/dev/null | grep -i synapse || echo "No aparece un timer SYNAPSE en esta consulta"
else
  echo "systemctl no disponible"
fi

echo "La auditoría no valida credenciales con los proveedores IA ni confirma restauraciones de backup."
