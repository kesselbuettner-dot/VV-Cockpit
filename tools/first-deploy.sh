#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if ! command -v docker >/dev/null || ! docker compose version >/dev/null 2>&1; then
  echo 'Docker Engine und docker compose müssen auf dem Server installiert sein.' >&2
  exit 1
fi
if [[ ! -f .env ]]; then
  cp .env.example .env
  python3 - <<'PY'
from pathlib import Path
import secrets
file=Path('.env')
values={'VV_ADMIN_PASSWORD','VV_VIEWER_PASSWORD','VV_KASSE_PASSWORD','VV_SESSION_SECRET'}
file.write_text('\n'.join(line.split('=',1)[0]+'='+secrets.token_urlsafe(36) if line.split('=',1)[0] in values else line for line in file.read_text().split('\n')))
PY
  chmod 600 .env
  echo 'Neue Zugangsdaten in /opt/VV-Cockpit/.env erstellt (keine Standardpasswörter).'
else
  echo 'Vorhandene .env wird beibehalten.'
fi
docker compose up -d --build
docker compose ps
printf '\nAdmin-Passwort lokal auf dem Server anzeigen: grep "^VV_ADMIN_PASSWORD=" /opt/VV-Cockpit/.env\n'
