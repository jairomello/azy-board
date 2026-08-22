## 1. Contratos e segurança de base

- [x] 1.1 Inventariar todas as rotas REST e ferramentas MCP atuais, consolidando nomes, payloads, status e respostas em um contrato único.
- [x] 1.2 Criar validadores runtime compartilhados para strings, enums, IDs, datas, paginação, limites e `idempotencyKey`, sem introduzir dependência incompatível.
- [x] 1.3 Padronizar erro de domínio/MCP com `code`, `message`, `details` seguro e `retryable`, removendo stack traces e erros SQL das respostas.
- [x] 1.4 Extrair helpers de escopo que validem `tenant_id + project_id + entity_id` e adicionar comentários `[TENANT]` nos pontos de isolamento.

## 2. Corrigir isolamento e autorização REST

- [x] 2.1 Corrigir rotas de items para filtrar sempre por `projectId` e `tenantId`, incluindo detalhe, criação, edição, move, claim, release, delete, logs e checklists.
- [x] 2.2 Validar no mesmo projeto e tenant as relações `parentId`, `moduleId`, `columnId`, `sprintId`, `tagId`, `versionId`, `costCenterId` e `assigneeId`.
- [x] 2.3 Corrigir rotas de módulos, colunas, sprints, tags, versões, anexos, membros, squads e centros de custo para impedir referências cross-project.
- [x] 2.4 Corrigir WebSocket para validar membership e papel antes do upgrade e manter broadcast isolado por tenant/projeto.
- [x] 2.5 Fazer operações sem efeito retornarem 404/409/422 apropriado em vez de sucesso falso.
- [x] 2.6 Adicionar testes REST com dois projetos no mesmo tenant, dois tenants e roles ADMIN/MEMBER/VIEWER.

## 3. API Keys de agentes

- [x] 3.1 Definir e documentar escopos de projeto/permissão, estado revogado e expiração opcional, mantendo compatibilidade com chaves legadas.
- [x] 3.2 Adicionar migração/schema para escopo, expiração, revogação e `last_used_at`, com comentários `[DB-SWAP]` aplicáveis.
- [x] 3.3 Atualizar middleware para rejeitar chaves inválidas, expiradas ou revogadas e impedir escopo além do RBAC do Owner.
- [x] 3.4 Garantir que segredo bruto só seja exibido na criação, nunca seja logado/retornado, e cobrir ciclo de vida com testes.

## 4. API orientada a agentes

- [x] 4.1 Implementar ou alinhar endpoints de descoberta: listar projetos, detalhe de projeto, board estruturado, árvore e Shadow Markdown.
- [x] 4.2 Expandir listagem/detalhe de items com filtros completos, cursor/paginação limitada e modo `SIMPLE`/`HIERARCHICAL`.
- [x] 4.3 Corrigir e completar operações de items: criar, atualizar, move, reorder, claim, release, reassign, concluir, archive/unarchive e delete.
- [x] 4.4 Completar operações de planejamento: projetos, módulos, colunas, sprints, tags, versões e centros de custo.
- [x] 4.5 Completar operações de colaboração e evidências: membros, squads, roles, checklists e logs; anexos ficam limitados a consulta futura de metadata/URL autorizada, sem upload via IA.
- [x] 4.6 Adicionar conversão de board e operações destrutivas com preview/dry-run, confirmação e transação quando aplicável.
- [x] 4.7 Retornar recursos atualizados, contagens e conflitos de forma consistente em todos os endpoints usados pelo MCP.

## 5. Catálogo MCP AI First

- [x] 5.1 Refatorar registro/handlers MCP para usar catálogo tipado, validadores runtime e respostas `structuredContent` além do texto legível.
- [x] 5.2 Adicionar ferramentas de descoberta e contexto: `list_projects`, `get_project`, `get_board`, `get_tree` e `get_shadow_markdown`.
- [x] 5.3 Adicionar ferramentas de criação/configuração de projeto, modo simples/hierárquico, módulos e colunas.
- [x] 5.4 Adicionar ferramentas de sprints, tags, versões, centros de custo, membros, squads e permissões.
- [x] 5.5 Adicionar ferramentas completas de items, incluindo todos os campos, filtros, update, reassign, release, reorder, archive, restore e delete.
- [x] 5.6 Adicionar ferramentas de checklists e logs com limites e respostas seguras; não adicionar upload de anexos via MCP.
- [x] 5.7 Implementar batch, idempotência, dry-run, limites e correlation/`agentRunId` nas mutações adequadas.
- [x] 5.8 Manter aliases de `list_tasks`, `create_task`, `move_task` e demais ferramentas atuais, documentando a migração para nomes novos.
- [x] 5.9 Fazer o MCP consultar `boardMode` e operar corretamente em projetos simples, incluindo a STORY fixa.

## 6. Documentação e ergonomia

- [x] 6.1 Atualizar `apps/mcp/README.md` com catálogo real, configuração genérica e fluxos completos para code agents.
- [x] 6.2 Documentar exemplos de configuração para Claude Code, Codex e OpenCode sem incluir URLs, tokens ou detalhes de infraestrutura privada.
- [x] 6.3 Alinhar README principal, OpenSpec, schemas MCP, mensagens de erro, nomes de colunas/status e exemplos com a implementação.
- [x] 6.4 Criar documentação de playbooks AI First para bootstrap de projeto, planejamento, execução, revisão e encerramento.

## 7. Testes e release

- [x] 7.1 Testar todos os schemas e handlers registrados no MCP, incluindo argumentos inválidos e erros estruturados.
- [x] 7.2 Testar integração MCP ↔ API real com SQLite isolado, múltiplos projetos/tenants/roles e API Key temporária.
- [x] 7.3 Testar projetos `SIMPLE` e `HIERARCHICAL`, conversões, preservação de dados e operações destrutivas com preview/rollback.
- [x] 7.4 Testar paginação, batch, idempotência, concorrência, timeout, falhas de rede e respostas inválidas.
- [x] 7.5 Adicionar teste que compare catálogo MCP, documentação e rotas suportadas, evitando divergências futuras.
- [x] 7.6 Executar `bun run test:mcp`, testes de integração, typecheck, lint, build e smoke test sem credenciais reais.
- [x] 7.7 Validar instalação publicada localmente e em cada ambiente de deploy sem versionar documentação ou segredos de infraestrutura.
