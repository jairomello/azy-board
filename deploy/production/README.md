# Produção do Azy Board na Vultr

Stack pública para `https://azyboard.jairo.tools`, independente do Apache e do
PostgreSQL já existentes no host. Nenhum container publica portas no host; o
tráfego entra pelo Cloudflare Tunnel e termina TLS no Caddy, com certificado
Let's Encrypt emitido por DNS-01.

## Componentes

- PostgreSQL 16 e Valkey 8, em rede Docker sem portas publicadas.
- API e `agent-worker` ADVANCED/SEPARATE.
- Nginx do Azy Board com IP real e protocolo HTTPS encaminhados pelo proxy.
- Caddy com módulo DNS Cloudflare para certificado Let's Encrypt.
- `cloudflared` como conector de saída. A rota pública não usa Cloudflare Access.
- Anexos no storage local persistente `/opt/azyboard/data/uploads` (sem S3).
- Limites de memória individuais para o piloto na VPS de 1 GB; monitorar swap e
  `docker stats` depois da publicação.

## Pré-requisitos externos

1. A zona `jairo.tools` deve estar `Active` na Cloudflare.
2. Criar um Tunnel chamado `azyboard-prod`, com rota pública
   `azyboard.jairo.tools` para `https://caddy:8443`.
3. No origin TLS do Tunnel, definir SNI/server name como
   `azyboard.jairo.tools` e manter a validação do certificado habilitada.
4. Não habilitar Cloudflare Access para o hostname público.
5. Criar um token Cloudflare com permissão `Zone:DNS:Edit`, limitado à zona
   `jairo.tools`, para o desafio DNS-01. Guardar o token somente no servidor.

O túnel cria o registro DNS necessário para `azyboard.jairo.tools`. Os registros
atuais `jairo.tools` e `www` permanecem DNS-only e não devem ser substituídos
por endereços da VPS.

## Arquivos e segredos no servidor

Copiar o compose, os dois modelos `.env`, `deploy.sh` e `prepare-host.sh` para
`/opt/azyboard`; então executar `bash /opt/azyboard/prepare-host.sh` como root.
O script cria as pastas `/opt/azyboard/data/postgres`, `data/instance`,
`data/uploads` e `backups`, além de gerar segredos aleatórios para PostgreSQL,
Valkey, JWT e cifra. Ele não imprime nem sobrescreve `.env.production` se já
existir. O Compose monta dados somente em `/opt/azyboard`; não usa
`/var/www/html`.

Antes de iniciar os containers, preencher `CLOUDFLARE_API_TOKEN`,
`CLOUDFLARE_TUNNEL_TOKEN` e `ACME_EMAIL` em `/opt/azyboard/.env.production`.
Permissões esperadas: `root:root`, modo `0600`. Não usar os valores `CHANGE_ME`.

O `CLOUDFLARE_API_TOKEN` e o token do Tunnel são credenciais independentes. Não
colocar nenhum deles no Git, em logs ou em mensagens.

## Primeiro setup

Depois que as imagens estiverem publicadas e o DNS/Tunnel configurados:

1. Criar temporariamente `/opt/azyboard/.env.bootstrap` a partir de
   `bootstrap.env.example`, com `ADMIN_EMAIL` e uma senha forte exclusiva.
2. Executar a migration e o setup por Compose usando `--env-file` para os dois
   arquivos. O setup usa o provedor `LOCAL` (e-mail/senha) e não imprime a senha.
3. Remover `.env.bootstrap` após confirmar o login inicial. A senha não deve
   permanecer na configuração de runtime.

O setup cria um tenant novo. Não execute seed em produção. Instalações ADVANCED
não importam os dados SQLite do labapps.

## Rollout

As imagens API, Web de produção e Caddy são publicadas no GHCR pelo job
`publish-production-images` somente após todos os gates do CI passarem em `main`.
Cada imagem recebe uma tag imutável `sha-<commit>`; o deploy deve selecionar o
mesmo SHA nos três serviços. O comando `bash /opt/azyboard/deploy.sh sha-<40-hex>` atualiza as
imagens, cria um backup local dos dados existentes, executa migrations e espera
a API ficar saudável. A cópia externa é recomendada para recuperação de desastre,
mas não é uma pré-condição para o rollout. Não fazer downgrade de schema.

## Backup

`/opt/azyboard/backups` é apenas staging local, não é backup contra perda da
VPS. Antes de habilitar deploy recorrente, configurar cópia criptografada para
destino externo e testar restore de PostgreSQL, marcador de instalação e
uploads. Backups automáticos da Vultr estão atualmente desativados.

## Observabilidade inicial

- `GET /health/ready` deve responder pelo hostname público.
- Conferir `docker compose ps`, `docker stats` e `free -h` após a primeira
  utilização.
- Acompanhar espaço de `/` e retenção de backup; 25 GB totais exigem política de
  retenção curta e destino externo.
- Manter as regras atuais de UFW para 22/80/443 enquanto o Apache estiver em uso.
  Não publicar portas Docker para API, PostgreSQL ou Valkey.

## MCP remoto (Streamable HTTP)

O endpoint MCP remoto vive na API (`/mcp`) e é alcançado pelo mesmo hostname
público: Cloudflare Tunnel → Caddy (`https://azyboard.jairo.tools:8443`) →
nginx do web (`web:80`) → API. O nginx do web repassa `/mcp` sem buffering com
HTTP/1.1 (`location = /mcp`, ver `docker/nginx-web.conf.template`); o Caddy e o
Tunnel não exigem regra nova porque todo o tráfego já passa por `web:80`.

Autenticação por `Authorization: Bearer azb_...`, revalidada a cada requisição.
Projeto informado no argumento da ferramenta ou no cabeçalho
`X-Azyboard-Project-Id`; mutações aceitam `Idempotency-Key`. O endpoint é
stateless (resposta JSON) e não adiciona container nem serviço.

Teste de conectividade no host (ou de qualquer cliente com rede até o
hostname), com uma API Key válida:

```bash
curl -sS https://azyboard.jairo.tools/mcp \
  -H "Authorization: Bearer $EASYBOARD_API_KEY" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"curl","version":"1"}}}'

curl -sS https://azyboard.jairo.tools/mcp \
  -H "Authorization: Bearer $EASYBOARD_API_KEY" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'
```

O segundo comando lista as ferramentas; sem credencial válida a resposta é 401.
Para rollback do endpoint, definir `AZYBOARD_MCP_HTTP_ENABLED=false` no serviço
`api` (responde 404) — o transporte `stdio` local permanece disponível.
