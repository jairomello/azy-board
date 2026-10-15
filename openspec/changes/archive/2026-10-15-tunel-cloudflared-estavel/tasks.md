# Tasks

Board ref: B13 e T79 (projeto Azyboard)

## 1. Prontidão e túnel (B13)

- [x] 1.1 Adicionar healthcheck ao `web` (HTTP local) e ao `caddy` (TCP na porta do túnel) e trocar as dependências para `condition: service_healthy`; verificar com `docker compose config -q` e executando os comandos de sonda nas imagens reais (B13)
- [x] 1.2 Esperar o caddy saudável no `deploy.sh`, sondar a URL pública através do túnel com retentativas, reiniciar o cloudflared se a sonda falhar e reportar a contagem de erros de DNS da janela; verificar com ensaio do script e leitura do relatório (B13)

## 2. Versão fixada e guarda no CI (T79)

- [x] 2.1 Fixar a imagem do cloudflared em versão concreta no compose de produção; verificar com `docker compose config -q` (T79)
- [x] 2.2 Reprovar tags flutuantes no compose de produção na checagem de versões do deploy, com mensagem que indique serviço, imagem e forma aceita; verificar com teste da própria checagem nos dois casos (T79)

## 3. Verificação integrada

- [x] 3.1 Rodar `bun run check`, `bun run check:deploy-versions` e `bun run test:smoke` verdes na árvore final
- [x] 3.2 Confirmar no deploy de produção que o relatório traz a sonda pública e a contagem de erros de DNS, e que o túnel permanece conectado após a recriação dos containers

## Workflow follow-up

- Implementar a change com `/opsx-apply`.
- Encerrar os cards B13 e T79 no Azy Board com `complete_task` e confirmar `status: DONE` no board real.
