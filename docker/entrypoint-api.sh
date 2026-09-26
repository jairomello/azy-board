#!/bin/sh
# Entrypoint da imagem da API do Azy Board.
#
# Subcomandos:
#   api      (padrão) sobe o servidor HTTP sem aplicar migrations.
#   migrate  aplica as migrations do perfil (SIMPLE: SQLite; ADVANCED:
#            PostgreSQL) e encerra — job separado executado antes do rollout.
#   outro    qualquer outro valor é executado como comando livre (debug).
set -eu

cmd="${1:-api}"
if [ "$#" -gt 0 ]; then
  shift
fi

case "$cmd" in
  api)
    exec bun /app/apps/api/dist/index.js "$@"
    ;;
  migrate)
    profile="$(printf '%s' "${AZYBOARD_INSTALL_PROFILE:-SIMPLE}" | tr '[:lower:]' '[:upper:]')"
    if [ "$profile" = "ADVANCED" ]; then
      exec bun /app/apps/api/dist/migrate-pg.js "$@"
    fi
    exec bun /app/apps/api/dist/migrate.js "$@"
    ;;
  *)
    exec "$cmd" "$@"
    ;;
esac
