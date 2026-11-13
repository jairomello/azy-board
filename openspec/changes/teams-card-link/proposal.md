# Link do card no Teams

## Why

O plano (F4.5) exige provar a integração com o Teams: criar um card durante uma reunião e receber o link na thread. Hoje o board não tem nenhuma integração de saída — nem webhook, nem comentário. Sem isso, o time continua criando card no Azy e colando o link manualmente no Teams.

## What Changes

- **Configuração por projeto**: webhook de entrada do Teams (`Incoming Webhook`) com URL, ativação e botão de teste, restrita a ADMIN.
- **Notificação de card criado**: ao criar um card (UI, MCP ou API), o sistema envia um cartão adaptativo para o canal com código, título, status, responsável e o **link direto do card**.
- **Entrega confiável**: fila própria com tentativas, backoff e registro de entrega; falha no Teams não bloqueia nem desfaz a criação do card.
- **Segurança**: URL validada (HTTPS), mascarada na leitura, isolada por tenant/projeto e nunca exposta a VIEWER/MEMBER.

## Decisões

- **Incoming Webhook, não bot**: atende “receber o link na thread” sem app no Azure AD, sem permissão de tenant e sem infraestrutura de bot. Bot/message extension fica fora da v1.
- **Somente criação de card na v1**: mudança de status e comentários entram depois, junto de E9/Jira.
- **Reuso da outbox**: a entrega é disparada pelo evento de domínio já existente (`ITEM_CREATED`), sem criar um segundo caminho de mutação.

## Impact

- Specs: nova capability `project-integrations`.
- Banco: tabela de integração por projeto e tabela de entregas (SQLite + PostgreSQL).
- API: `GET/PUT/DELETE /projects/:projectId/integrations/teams` e `POST .../test`.
- Worker: consumo do evento e envio HTTP com retry.
- UI: seção “Integrações” nas configurações do projeto.
- Sem alteração no fluxo de criação de card além do enfileiramento.
