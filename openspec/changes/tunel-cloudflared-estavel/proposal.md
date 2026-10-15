# Proposal

## Why

O túnel de produção (`cloudflared`) registra `lookup caddy … server misbehaving` de forma esporádica — inclusive antes do último rollout. A investigação dos arquivos de deploy mostrou quatro causas encadeadas:

- **O nome `caddy` sai do DNS durante o deploy.** O cloudflared resolve a origem pelo nome `caddy` via DNS embutido do Docker; ao recriar o container do caddy, o nome desaparece do registro por um instante e o resolver do Go responde com erro.
- **A subida é ordenada por "iniciou", não por "está pronto".** `cloudflared` espera apenas o caddy iniciar, o caddy espera apenas o `web` iniciar, e o `web` não tem healthcheck. Num boot limpo há corrida real.
- **A imagem do cloudflared usa `latest`** — a única tag flutuante do compose de produção; um `pull` pode trocar o binário sem ninguém perceber.
- **O deploy não verifica o túnel.** O `deploy.sh` espera a API ficar saudável e para: o caminho `cloudflared → caddy → web` não é testado, então degradação passa silenciosa.

## What Changes

- `web` e `caddy` ganham healthcheck; `caddy` passa a esperar `web` saudável e `cloudflared` passa a esperar `caddy` saudável.
- A imagem do cloudflared passa a ser fixada em versão concreta, e a checagem do CI passa a reprovar qualquer tag flutuante no compose de produção.
- O `deploy.sh` passa a esperar o caddy saudável, sondar a URL pública através do túnel com retentativas, reiniciar o cloudflared se a sonda falhar e reportar a contagem de erros de DNS do log (sem segredos).

## Capabilities

### Modified Capabilities

- `reproducible-deploy`: a fixação de versões passa a cobrir todas as imagens do compose de produção; a ordem de subida por prontidão e a verificação do túnel entram como requisito próprio.

## Impact

- **Compose de produção:** healthchecks e dependências por prontidão; cloudflared fixado.
- **Deploy:** verificação pós-rollout do caminho público, com recuperação e diagnóstico.
- **CI:** nova reprovação para tags flutuantes no compose de produção.
- **Limite honesto:** erros residuais de DNS durante a recriação do caddy são inerentes ao DNS embutido do Docker. O alvo é zerar a janela de indisponibilidade e não deixar degradação passar silenciosa — não prometer log limpo.

## Board ref

B13 (túnel e ordem de subida) e T79 (guarda de tags no CI) — projeto Azyboard.
