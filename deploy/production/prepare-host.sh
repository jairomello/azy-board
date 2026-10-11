#!/usr/bin/env bash
set -Eeuo pipefail

ROOT=/opt/azyboard

if [[ "$EUID" -ne 0 ]]; then
  printf '%s\n' 'Execute este preparo como root.' >&2
  exit 1
fi
if ! docker compose version >/dev/null 2>&1; then
  printf '%s\n' 'Docker Compose v2 não está instalado.' >&2
  exit 1
fi
for file in docker-compose.production.yml production.env.example bootstrap.env.example deploy.sh; do
  if [[ ! -f "$ROOT/$file" ]]; then
    printf 'Arquivo obrigatório ausente: %s/%s\n' "$ROOT" "$file" >&2
    exit 1
  fi
done

install -d -o root -g root -m 0750 "$ROOT" "$ROOT/data" "$ROOT/backups"
install -d -o 999 -g 999 -m 0700 "$ROOT/data/postgres"
install -d -o 1000 -g 1000 -m 0750 "$ROOT/data/instance" "$ROOT/data/uploads"
install -d -o root -g root -m 0700 "$ROOT/backups"

if [[ ! -e "$ROOT/.env.production" ]]; then
  python3 - "$ROOT/production.env.example" "$ROOT/.env.production" <<'PY'
from pathlib import Path
import secrets
import sys

source, destination = map(Path, sys.argv[1:])
text = source.read_text(encoding="utf-8")
for name in ("POSTGRES_PASSWORD", "VALKEY_PASSWORD", "JWT_SECRET", "ASSISTANT_ENCRYPTION_KEY"):
    placeholder = f"{name}=CHANGE_ME_HEX_64"
    if placeholder not in text:
        raise SystemExit(f"Placeholder ausente no modelo: {name}")
    text = text.replace(placeholder, f"{name}={secrets.token_hex(32)}", 1)
destination.write_text(text, encoding="utf-8")
PY
  chown root:root "$ROOT/.env.production"
  chmod 0600 "$ROOT/.env.production"
fi

chown root:root "$ROOT/docker-compose.production.yml" "$ROOT/production.env.example" "$ROOT/bootstrap.env.example" "$ROOT/deploy.sh"
chmod 0644 "$ROOT/docker-compose.production.yml" "$ROOT/production.env.example" "$ROOT/bootstrap.env.example" "$ROOT/deploy.sh"
chmod 0600 "$ROOT/.env.production"

printf '%s\n' 'Diretórios e segredos aleatórios preparados em /opt/azyboard.'
printf '%s\n' 'O arquivo .env.production não foi exibido; complete tokens Cloudflare antes de iniciar os containers.'
