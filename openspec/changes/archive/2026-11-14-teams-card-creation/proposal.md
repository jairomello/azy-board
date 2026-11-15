# Criar card pelo Teams

## Why

O time registra demanda no meio da conversa. Hoje isso vira mensagem solta ou card criado depois, com o link colado à mão. O E5 pede a experiência inversa da notificação: **mencionar o bot no grupo e o card nascer no Azy**, já com o link respondido na thread.

## What Changes

- **Integração de entrada por projeto**: um ADMIN cria a integração, recebe a URL para colar no Teams e informa o token de segurança gerado pelo Teams.
- **Endpoint público** `POST /api/integrations/teams/messages/:token` que valida HMAC, interpreta o comando e cria o card.
- **Comando na conversa**: `@Azy criar <título>` com campos opcionais (`| tipo: BUG | prazo: 20/11 | responsável: Fulano`).
- **Resposta na thread**: link do card criado, ou erro claro (comando inválido, integração inativa).
- **Proteções**: HMAC obrigatório, deduplicação por id da mensagem, limite de uso e isolamento por tenant/projeto.

## Decisões

- **Outgoing webhook do Teams** (webhook de saída), não bot no Azure: é o único caminho que dá menção real no canal sem app no Azure AD nem publicação de bot.
- **Fluxo de entrada apenas**: notificação de saída (Azy → Teams) fica fora deste change.
- **Sem mapeamento de e-mail**: o payload do Teams não traz e-mail; o autor entra como `assigneeLabel` e o nome do remetente fica no log do card. Mapeamento por Graph fica para depois.

## Impact

- Specs: nova capability `teams-card-creation`.
- Banco: integração por projeto (token público, segredo do Teams, coluna/tipo padrão) e registro de mensagens recebidas para dedup.
- API: endpoint público com HMAC + CRUD de configuração (ADMIN).
- UI: seção “Integrações” nas configurações do projeto com URL, token, teste e últimas mensagens.
- Sem alteração no fluxo normal de criação de card.
