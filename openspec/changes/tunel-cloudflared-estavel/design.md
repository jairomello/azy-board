# Design

## Context

A topologia de produção é: `cloudflared` (túnel, rede `edge`) → `caddy` (`:8443`, TLS via DNS-01, rede `edge`) → `web` (nginx, redes `edge` e `backend`) → `api`.

O túnel é token-based, então a origem (`http://caddy:8443`) é resolvida pelo próprio cloudflared a cada conexão, através do DNS embutido do Docker (`127.0.0.11`). Não há healthcheck em `caddy` nem em `cloudflared` (a imagem do cloudflared é *distroless*, sem shell), e o `web` também não tem healthcheck. O `deploy.sh` valida apenas a saúde da API antes de declarar sucesso.

## Goals / Non-Goals

**Goals:**

- Eliminar a corrida de subida: nenhum serviço depende de outro apenas "iniciado".
- Não deixar degradação do túnel passar silenciosa no deploy.
- Tirar a única tag flutuante do compose de produção e impedir que novas apareçam.

**Non-Goals:**

- Eliminar os erros de DNS durante a recriação do caddy (inerentes ao DNS embutido do Docker).
- Publicar portas no host, tocar no Apache do host ou trocar o provedor do túnel.
- Dar healthcheck ao cloudflared por dentro: a imagem não tem shell nem binário de sonda.

## Decisions

### D1 — Prontidão em vez de "iniciou"

`web` (nginx) ganha healthcheck HTTP local; `caddy` ganha healthcheck TCP na porta 8443 (busybox `nc`, presente na imagem alpine). `caddy` passa a `depends_on: web: condition: service_healthy` e `cloudflared` a `depends_on: caddy: condition: service_healthy`.

**Alternativa descartada:** dar healthcheck ao `cloudflared` via `docker exec`. A imagem é distroless: não há shell nem binário para executar a sonda. A verificação do túnel é feita por fora (D3).

### D2 — Versão fixada e guarda no CI

`cloudflare/cloudflared:latest` passa a `cloudflare/cloudflared:2026.10.0`. A checagem `check:deploy-versions` — que já reprova tags flutuantes de runtime nos Dockerfiles — passa a varrer também os serviços do `docker-compose.production.yml`, reprovando `latest`, `stable` e `edge` com mensagem que indica serviço, imagem e a forma aceita.

**Alternativa descartada:** depender de revisão humana no PR. O compose já é validado no CI (`docker compose config -q`), e a guarda de tag entra no mesmo lugar.

### D3 — Verificação do túnel no deploy, com recuperação

Depois de a API ficar saudável, o `deploy.sh`:

1. espera o `caddy` ficar saudável (mesmo padrão já usado para postgres e API);
2. sonda a URL pública através do túnel, com retentativas;
3. se a sonda falhar, reinicia o `cloudflared` e sonda de novo;
4. reporta quantos erros de DNS apareceram no log do cloudflared na janela do deploy.

A sonda usa a URL pública já configurada no ambiente de produção e não imprime segredos. O passo 3 evita deixar o túnel num estado degradado quando o nome não voltou a resolver a tempo; o passo 4 transforma um sintoma silencioso em número visível no relatório do deploy.

**Alternativa descartada:** reiniciar o cloudflared sempre. Isso criaria uma janela de indisponibilidade em todo deploy; reiniciar só quando a sonda falha mantém o deploy sem interrupção no caminho feliz.

### D4 — O que este trabalho não promete

Os erros de DNS residuais durante a recriação do caddy continuam possíveis: enquanto o container não existe, o nome não resolve. O ganho é a janela de indisponibilidade (ordem por prontidão + recuperação) e a visibilidade (sonda + contagem de erros).

## Riscos

- Healthcheck mal calibrado pode marcar serviço saudável cedo demais. Mitigação: sonda TCP/HTTP direta na porta que o túnel usa, com `start_period` para a emissão de TLS do caddy.
- A sonda pública depende de DNS externo; falha de rede do operador não deve ser lida como túnel quebrado. Mitigação: retentativas antes de reiniciar, e mensagem que separa "sonda falhou" de "túnel reiniciado".

## Migration Plan

Sem migração de dados. O rollout aplica o compose novo pelo fluxo já existente (backup → migrate → up), e o rollback segue disponível pelo `current-image-tag` anterior.
