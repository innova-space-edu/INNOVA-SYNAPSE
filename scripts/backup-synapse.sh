#!/usr/bin/env bash
set -euo pipefail
cd "${SYNAPSE_HOME:-/srv/intranet/synapse}"
BACKUP_DIR="${SYNAPSE_BACKUP_DIR:-/srv/intranet/backups/synapse}"
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
filename="$BACKUP_DIR/synapse_$(date -u +%Y%m%dT%H%M%SZ).sql.gz"
umask 077
# Dedicated SYNAPSE database only; does not access intranet-db.
docker compose -f compose.intranet.yaml exec -T db pg_dump -U synapse -d synapse --no-owner --no-privileges | gzip -9 > "$filename"
test -s "$filename"
gzip -t "$filename"
sha256sum "$filename" > "$filename.sha256"
find "$BACKUP_DIR" -maxdepth 1 -type f -name 'synapse_*.sql.gz' -mtime +14 -delete
find "$BACKUP_DIR" -maxdepth 1 -type f -name 'synapse_*.sql.gz.sha256' -mtime +14 -delete
echo "SYNAPSE backup verified: $filename"
