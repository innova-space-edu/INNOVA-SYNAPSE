#!/usr/bin/env bash
set -euo pipefail
cd "${SYNAPSE_HOME:-/srv/intranet/synapse}"
echo "== Compose =="
docker compose -f compose.intranet.yaml ps
echo "== Health =="
curl -fsS --max-time 10 http://127.0.0.1:3410/api/health
echo
echo "== Database health =="
docker compose -f compose.intranet.yaml exec -T db pg_isready -U synapse -d synapse
echo "== Volumes =="
docker volume inspect synapse_pgdata --format '{{.Name}}: {{.Mountpoint}}' | sed 's/: .*$/: mounted/'
