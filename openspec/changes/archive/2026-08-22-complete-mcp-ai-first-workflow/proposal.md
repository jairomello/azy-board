## Why

O Azy Board foi concebido como um produto AI First, mas o MCP atual permite apenas uma parte pequena da execução: listar itens, criar alguns tipos de item, mover/concluir tarefas e operar checklists. Um code agent ainda precisa alternar para a interface ou montar chamadas REST manualmente para criar e configurar projetos, administrar estrutura, equipe, planejamento e ciclo completo de entrega.

Além da cobertura insuficiente, a revisão encontrou divergências de contrato e riscos críticos de isolamento entre projetos do mesmo tenant nas rotas consumidas pelo MCP. Antes de ampliar a automação, o produto precisa garantir que cada operação seja segura, previsível, observável e realmente executável por um agente.

## What Changes

- Corrigir validações de `tenant_id`, `project_id` e identificadores de entidades em todas as rotas usadas pelo MCP, incluindo hierarquia, colunas, sprints, tags, versões, responsáveis, centros de custo e WebSocket.
- Alinhar README, schemas MCP, nomes de ferramentas, payloads, status e respostas com a API real.
- Adicionar descoberta de projetos, configuração, board estruturado, árvore e Shadow Markdown.
- Expor pelo MCP o ciclo de vida completo de projetos, módulos, colunas, sprints, tags, versões, equipe, squads, centros de custo, itens, subtasks, checklists e logs. Upload de arquivos via IA ficará fora do escopo; anexos existentes poderão ser consultados por metadata/URL autorizada quando necessário.
- Adicionar atualização, reatribuição, claim/release, movimentação, ordenação, arquivamento/restauração, exclusão e operações em lote quando suportadas pelo domínio.
- Permitir que agentes criem e configurem projetos simples e hierárquicos, incluindo a conversão entre modos com confirmação/preview adequado.
- Padronizar respostas estruturadas, erros acionáveis, paginação por cursor, limites, idempotência seletiva, dry-run, batch e correlação de execução para code agents.
- Expandir testes para transporte/registro MCP, API real isolada, RBAC, multi-tenancy, projetos simples, falhas e contratos documentados.

## Capabilities

### New Capabilities

- `mcp-ai-first-workflow`: cobertura do fluxo completo de gerenciamento e execução do Azy Board por code agents.

### Modified Capabilities

- `mcp-server`: ampliar ferramentas, schemas, respostas, validação, confiabilidade e cobertura de testes do servidor MCP.
- `ai-api`: corrigir e expandir os contratos REST usados por agentes, incluindo validação relacional e operações de board.
- `multi-tenancy`: impedir IDOR entre projetos do mesmo tenant e exigir pertencimento consistente em todas as relações.
- `api-key-management`: definir escopo, ciclo de vida, expiração, revogação, auditoria e uso seguro de API Keys de agentes.

## Impact

- `apps/mcp/src/index.ts`, `tools.ts`, testes, README e transporte stdio.
- Rotas Hono de projetos, itens, colunas, sprints, tags, versões, anexos, checklists e autenticação.
- Middleware de API Key/JWT, RBAC, WebSocket e modelo de dados de credenciais.
- Tipos compartilhados e serializadores de respostas para consumo por LLMs.
- Documentação de configuração em Claude Code, Codex, OpenCode e outros clientes MCP.
- Testes unitários, integração MCP ↔ API e smoke tests sem credenciais reais.
- Possíveis migrações de banco para escopo/estado/expiração de API Keys, sem incluir segredos no repositório.
