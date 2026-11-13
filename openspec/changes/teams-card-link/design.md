# Design — link do card no Teams

## Contexto

O Azy Board já publica eventos de domínio duráveis na outbox (`domain_event_outbox`) com dispatcher at-least-once, lease, backoff e métricas. O `ITEM_CREATED` já carrega projeto, item e autor. Isso é base suficiente para uma integração de saída sem tocar no caminho de mutação.

## Decisões

### 1. Incoming Webhook em vez de bot

O aceite do E5 é “criar um card em reunião e receber o link na thread”. Um **Incoming Webhook** do Teams resolve isso com uma URL por canal:

- não exige app registrado no Azure AD, permissão de tenant nem endpoint público;
- a mensagem pode ser um Adaptive Card com botão “Abrir card”;
- o admin do projeto cola a URL nas configurações e testa.

Bot/message extension (criar card respondendo a uma mensagem) fica fora da v1: exige identidade de bot, catálogo de comandos e verificação da Microsoft.

### 2. Fila própria, disparada pela outbox

O dispatcher publica no WebSocket. A integração **não** substitui esse transporte: ela observa o evento publicado e enfileira uma entrega em `integration_deliveries`.

Por quê:

- uma falha do Teams não pode reter nem repetir o evento de domínio;
- a entrega tem ciclo de vida próprio (tentativas, backoff, erro visível);
- permite reprocessar entregas sem republicar evento.

Deduplicação por `(integration_id, event_id)` garante entrega única mesmo com o dispatcher at-least-once.

### 3. Modelo

```text
project_integrations
  id, tenant_id, project_id, kind ('TEAMS_WEBHOOK'), url, enabled,
  created_by, created_at, updated_at
  unique (tenant_id, project_id, kind)

integration_deliveries
  id, tenant_id, project_id, integration_id, event_id, event_type,
  status ('PENDING','SENT','FAILED'), attempts, last_error, next_attempt_at,
  created_at, updated_at
  unique (integration_id, event_id)
```

A URL é segredo operacional: a leitura devolve apenas host e máscara (`https://…/webhookb2/…`), nunca a URL completa.

### 4. Conteúdo da mensagem

Adaptive Card com:

- código e título do card;
- tipo, status e responsável (usuário ou `assigneeLabel`);
- botão “Abrir no Azy Board” apontando para `/projects/:projectId/board?itemId=:itemId`;
- rodapé com o nome do projeto.

### 5. Segurança

- Somente ADMIN do projeto cria, altera, testa ou remove.
- URL precisa ser `https://` e de domínio do Teams (`*.webhook.office.com`, `outlook.office.com`, `*.logic.azure.com`) — evita SSRF para rede interna.
- Isolamento por tenant em todas as consultas; o worker resolve a integração pelo `tenant_id`/`project_id` do evento.
- Sem retry infinito: após N tentativas a entrega vira `FAILED` e fica visível na configuração.

## Riscos

- **Webhook revogado**: o canal troca a URL e as entregas falham. Mitigação: teste na configuração e erro visível com contagem de falhas.
- **Volume**: reuniões criam poucos cards; ainda assim a entrega é assíncrona e agrupada por evento.
- **Mudança de contrato**: nova tabela exige migration SQLite e PostgreSQL no mesmo PR.
