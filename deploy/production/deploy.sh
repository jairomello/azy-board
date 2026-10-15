#!/usr/bin/env bash
set -Eeuo pipefail

ROOT=/opt/azyboard
COMPOSE_FILE="$ROOT/docker-compose.production.yml"
ENV_FILE="$ROOT/.env.production"
IMAGE_TAG="${1:-}"

if [[ ! "$IMAGE_TAG" =~ ^sha-[0-9a-f]{40}$ ]]; then
  printf '%s\n' 'Uso: deploy.sh sha-<40 caracteres hexadecimais>' >&2
  exit 2
fi
if [[ ! -f "$COMPOSE_FILE" || ! -f "$ENV_FILE" ]]; then
  printf '%s\n' 'Compose/env de produção ausente em /opt/azyboard.' >&2
  exit 2
fi
if [[ "$(stat -c '%a' "$ENV_FILE")" != 600 ]]; then
  printf '%s\n' 'Permissões inválidas: /opt/azyboard/.env.production deve ser modo 0600.' >&2
  exit 2
fi

export AZYBOARD_IMAGE_TAG="$IMAGE_TAG"
compose=(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE")

# URL pública do túnel (não é segredo; pode ser sobrescrita pelo ambiente).
PUBLIC_URL="${PUBLIC_URL:-https://azyboard.jairo.tools}"
inicio_janela="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

# Prontidão: nenhum serviço depende de outro apenas "iniciado".
wait_healthy() {
  local servico="$1" tentativas="$2" id estado
  id="$("${compose[@]}" ps -q "$servico" 2>/dev/null || true)"
  if [[ -z "$id" ]]; then
    printf 'Serviço %s não subiu.\n' "$servico" >&2
    return 1
  fi
  for _ in $(seq 1 "$tentativas"); do
    estado="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$id" 2>/dev/null || true)"
    if [[ "$estado" == healthy ]]; then return 0; fi
    if [[ "$estado" == unhealthy || "$estado" == exited || "$estado" == dead ]]; then break; fi
    sleep 2
  done
  printf 'Serviço %s não ficou saudável (estado: %s).\n' "$servico" "${estado:-desconhecido}" >&2
  return 1
}

# Sonda o caminho público através do túnel. Sem URL configurada, não há o que sondar.
sonda_publica() {
  local tentativas="${1:-5}"
  if [[ -z "$PUBLIC_URL" ]]; then
    printf '%s\n' 'PUBLIC_URL não configurada; sonda pública ignorada.' >&2
    return 0
  fi
  for _ in $(seq 1 "$tentativas"); do
    if curl -fsS -o /dev/null --max-time 10 "$PUBLIC_URL"; then return 0; fi
    sleep 3
  done
  return 1
}

# Backup local antes de qualquer migration. Staging local não substitui a cópia
# externa, que deve ser configurada e verificada separadamente.
postgres_id="$("${compose[@]}" ps --all -q postgres 2>/dev/null || true)"
if [[ -n "$postgres_id" ]]; then
  "${compose[@]}" up -d postgres
  for attempt in $(seq 1 60); do
    status="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$postgres_id" 2>/dev/null || true)"
    if [[ "$status" == healthy ]]; then break; fi
    if [[ "$status" == unhealthy || "$status" == exited || "$status" == dead ]]; then
      printf 'PostgreSQL não ficou saudável antes do backup (estado: %s).\n' "$status" >&2
      exit 1
    fi
    sleep 2
  done
  if [[ "$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$postgres_id")" != healthy ]]; then
    printf '%s\n' 'PostgreSQL não ficou saudável antes do backup.' >&2
    exit 1
  fi
  timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
  backup_dir="$ROOT/backups/predeploy-${timestamp}-${IMAGE_TAG}"
  install -d -o root -g root -m 0700 "$backup_dir"
  "${compose[@]}" exec -T postgres sh -ec 'pg_dump --format=custom -U "$POSTGRES_USER" "$POSTGRES_DB"' > "$backup_dir/postgres.dump"
  tar -C "$ROOT/data" -czf "$backup_dir/files.tar.gz" instance uploads
  (cd "$backup_dir" && sha256sum postgres.dump files.tar.gz > SHA256SUMS)
  chmod 0600 "$backup_dir"/*
  printf 'Backup local salvo em %s\n' "$backup_dir"
fi

"${compose[@]}" pull
"${compose[@]}" run --rm migrate
"${compose[@]}" up -d --remove-orphans

api_id="$("${compose[@]}" ps -q api)"
if [[ -z "$api_id" ]]; then
  printf '%s\n' 'O Compose não criou o container da API.' >&2
  exit 1
fi
if ! wait_healthy api 60; then
  printf '%s\n' 'Consulte docker compose ps e logs sem expor segredos.' >&2
  exit 1
fi

# O túnel só faz sentido com o proxy pronto: o cloudflared resolve a origem pelo
# nome do serviço, que deixa de existir enquanto o container é recriado.
if ! wait_healthy caddy 60; then
  printf '%s\n' 'Proxy não ficou saudável; o caminho público não é confiável.' >&2
  exit 1
fi

if ! sonda_publica 5; then
  printf '%s\n' 'Sonda pública falhou; reiniciando o túnel e sondando novamente.' >&2
  "${compose[@]}" restart cloudflared >/dev/null
  if ! sonda_publica 10; then
    printf '%s\n' 'Sonda pública continua falhando após reiniciar o túnel.' >&2
    exit 1
  fi
  printf '%s\n' 'Túnel recuperado após reinício.'
fi

# Diagnóstico da janela: sintoma silencioso vira número no relatório do deploy.
erros_dns="$("${compose[@]}" logs --since "$inicio_janela" cloudflared 2>/dev/null | grep -c 'server misbehaving' || true)"
printf 'Erros de resolução no log do túnel nesta janela: %s\n' "${erros_dns:-0}"

printf '%s\n' "$IMAGE_TAG" > "$ROOT/current-image-tag"
chmod 0644 "$ROOT/current-image-tag"
printf 'Deploy concluído: %s\n' "$IMAGE_TAG"
