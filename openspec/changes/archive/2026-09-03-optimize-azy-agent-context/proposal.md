## Why

O Azy Agent perde contexto ao confirmar mutações e atualmente envia o catálogo completo de ferramentas em cada chamada, consumindo cerca de 50 mil tokens mesmo em mensagens simples. A mudança corrige a continuidade transacional e reduz custo e latência sem enfraquecer autorização server-side.

## What Changes

- Retomar runs aguardando confirmação, executando a operação aprovada uma única vez.
- Tratar confirmações como estado explícito de uma run, não como uma nova pergunta sem contexto.
- Enviar histórico limitado e resumo estruturado da conversa ao iniciar novas runs.
- Selecionar ferramentas por intenção e expor ao modelo apenas o subconjunto necessário.
- Manter fallback seguro para expandir ferramentas quando necessário.
- Ajustar limites e testes para o catálogo atual de ferramentas.

## Capabilities

### New Capabilities

- `assistant-context-optimization`: contexto resumido, seleção dinâmica de ferramentas e limites de tokens.

### Modified Capabilities

- `azy-agent-chat`: conversas devem preservar contexto e confirmação entre mensagens.
- `azy-agent-harness`: runs pendentes devem ser retomáveis e as ferramentas devem respeitar allowlists sem substituir autorização.

## Impact

- Backend: rotas do assistente, harness, registry MCP e schema/migrações SQLite.
- Frontend: drawer do Azy Agent, histórico persistido e controles explícitos de aprovação.
- Banco: estado persistido para contexto/resumo e continuação de aprovação.
- Testes: novos cenários de confirmação, histórico, seleção de ferramentas e limites.
