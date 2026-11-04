#!/usr/bin/env bash
set -euo pipefail
cd "${SYNAPSE_HOME:-/srv/intranet/synapse}"
echo "== Servicios independientes =="
docker compose -f compose.intranet.yaml ps
echo "== HTTP local (solo /api/health) =="
curl -fsS --max-time 10 http://127.0.0.1:3410/api/health
echo
echo "== PostgreSQL de SYNAPSE =="
docker compose -f compose.intranet.yaml exec -T db pg_isready -U synapse -d synapse
echo "== Comunicación con compilador =="
docker compose -f compose.intranet.yaml exec -T web node -e \
  "fetch('http://compiler:8000/health',{signal:AbortSignal.timeout(8000)}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
echo "Compilador accesible. La compilación de un PDF se debe probar por separado."
echo "== Volumen persistente =="
docker volume inspect synapse_pgdata --format '{{.Name}}: existe'
