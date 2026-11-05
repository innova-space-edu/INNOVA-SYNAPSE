#!/usr/bin/env bash
# INNOVA SYNAPSE: preparation and activation on Dell, without touching any other stack.
set -Eeuo pipefail
umask 077
cd "$(dirname "${BASH_SOURCE[0]}")/.."
ROOT="$(pwd -P)"
COMPOSE_FILE="compose.intranet.yaml"
cmd="${1:-help}"

die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
check_tools() {
  for tool in docker python3 git curl; do command -v "$tool" >/dev/null || die "Falta $tool"; done
  docker info >/dev/null 2>&1 || die "Docker no responde o el usuario no tiene permisos";
  docker compose version >/dev/null || die "No está instalado Docker Compose";
}
check_location() {
  [[ "$ROOT" == "/srv/intranet/synapse" ]] || die "Ubicación incorrecta: se requiere /srv/intranet/synapse (actual: $ROOT)";
  [[ -d .git && -f "$COMPOSE_FILE" ]] || die "Se requiere el repositorio completo clonado";
}
prepare() {
  command -v python3 >/dev/null || die "Falta Python 3";
  if [[ -e .env ]]; then
    [[ ! -L .env ]] || die "El archivo .env no puede ser enlace simbólico";
    echo "Conservando .env existente (no se sobrescribirán credenciales)."
  else
    cp -- .env.intranet.example .env
    chmod 600 .env
    python3 - <<'PY'
from pathlib import Path
import secrets
p=Path('.env')
data=p.read_text(encoding='utf-8')
data=data.replace('replace-with-64-character-alphanumeric-secret', secrets.token_hex(32))
data=data.replace('replace-with-long-random-token', secrets.token_hex(32))
p.write_text(data,encoding='utf-8')
p.chmod(0o600)
PY
    echo "Archivo .env creado con claves aleatorias; falta definir valores reales de Cloudflare Access y el correo administrador."
  fi
}
validate_env() {
  [[ -f .env && ! -L .env ]] || die "Falta .env seguro. Ejecuta: bash scripts/deploy-dell.sh prepare";
  [[ "$(stat -c %a .env)" == "600" ]] || die "El archivo .env debe tener permisos 0600";
  python3 - <<'PY'
from pathlib import Path
from urllib.parse import urlsplit
import re
pairs = {}
for line in Path(".env").read_text(encoding="utf-8").splitlines():
    line=line.strip()
    if not line or line.startswith("#"):continue
    if "=" not in line:raise SystemExit("Variable .env malformada")
    k,v=line.split("=",1)
    if k in pairs:raise SystemExit("Variable repetida en .env: "+k)
    pairs[k]=v.strip()
domain = pairs.get("CF_ACCESS_TEAM_DOMAIN", "")
aud = pairs.get("CF_ACCESS_AUD", "")
admins = pairs.get("SYNAPSE_ADMIN_EMAILS", "")
if domain == "your-team.cloudflareaccess.com" or not re.fullmatch(r"[a-z0-9-]+\.cloudflareaccess\.com", domain):
    raise SystemExit("Configura CF_ACCESS_TEAM_DOMAIN (dominio exacto de Cloudflare Access)")
if not re.fullmatch(r"[A-Za-z0-9_-]{12,160}", aud) or "replace" in aud.lower():
    raise SystemExit("Configura CF_ACCESS_AUD real de la aplicación SYNAPSE")
if not re.fullmatch(r"[^\s,@]+@[^\s,@]+\.[^\s,@]+", admins) or "example.com" in admins.lower():
    raise SystemExit("Configura SYNAPSE_ADMIN_EMAILS con un solo correo administrador real")
for k in ("SYNAPSE_DB_PASSWORD", "LATEX_COMPILER_TOKEN"):
    if not re.fullmatch(r"[a-f0-9]{64}", pairs.get(k,"")):
        raise SystemExit("Genera una clave hexadecimal aleatoria de 64 caracteres para "+k)
if pairs.get("SYNAPSE_LOCAL_DEV") != "false":
    raise SystemExit("SYNAPSE_LOCAL_DEV debe ser false en producción")
print("Variables de acceso, propietario y contraseñas: formato correcto. No se revelan secretos.")
PY
}
preflight() {
  check_location; check_tools
  docker network inspect portal_default >/dev/null 2>&1 || die "No se encontró portal_default. La intranet debe estar activa antes de instalar SYNAPSE"
  # Refuse a potentially resource-exhausting installation on a full disk.
  python3 - <<'PY'
import os
s=os.statvfs('/srv/intranet')
free=s.f_bavail*s.f_frsize
print("Disco disponible: %.1f GiB" % (free/1024**3))
if free < 8*1024**3:
    raise SystemExit("Menos de 8 GiB libres; no iniciar construcción del compilador TeX Live")
PY
  [[ -z "$(git status --porcelain --untracked-files=no)" ]] || die "Existen cambios no confirmados en archivos rastreados; revisa el repositorio"
  echo "Revisión local: $(git rev-parse --short HEAD)"
  validate_env
  docker compose -f "$COMPOSE_FILE" config --quiet
  echo "Preflight correcto. Ningún contenedor fue modificado."
}
deploy() {
  preflight
  echo "Construyendo únicamente SYNAPSE; el compilador TeX Live requiere espacio libre."
  docker compose -f "$COMPOSE_FILE" build web compiler
  docker compose -f "$COMPOSE_FILE" up -d --no-build --wait --wait-timeout 90 db
  bash scripts/backup-synapse.sh
  docker compose -f "$COMPOSE_FILE" exec -T db psql -U synapse -d synapse -v ON_ERROR_STOP=1 < db/003-collaboration.sql
  docker compose -f "$COMPOSE_FILE" up -d --no-build --wait --wait-timeout 180
  bash scripts/check-synapse.sh
  echo "Servicios locales iniciados. Acceso remoto AÚN requiere configurar Tunnel y Cloudflare Access."
}
status() {
  check_location; check_tools
  docker compose -f "$COMPOSE_FILE" ps
  bash scripts/check-synapse.sh
}
case "$cmd" in
  prepare) check_location; prepare;;
  preflight) preflight;;
  deploy) deploy;;
  status) status;;
  help|-h|--help) printf "Uso: bash scripts/deploy-dell.sh {prepare|preflight|deploy|status}\n";;
  *) die "Comando desconocido: $cmd";;
esac
