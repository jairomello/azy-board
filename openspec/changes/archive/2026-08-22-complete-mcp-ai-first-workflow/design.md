## Context

O servidor MCP atual usa transporte stdio e uma API HTTP simples, mas expõe somente 11 ferramentas concentradas em listar/criar/mover/concluir itens e operar checklists. O restante do domínio existe na API REST, porém um code agent precisa conhecer rotas internas, IDs e regras de sequência para administrar um projeto.

A auditoria também identificou que várias rotas validam apenas `tenant_id` e o identificador da entidade, sem confirmar o `project_id` da URL. Isso permite IDOR entre projetos do mesmo tenant e torna inseguro ampliar o MCP antes de corrigir a camada REST. A solução deve funcionar com Bun, SQLite local, PostgreSQL/Supabase futuro e clientes como Claude Code, Codex e OpenCode.

## Goals / Non-Goals

**Goals:**

- Tornar todo o ciclo de gerenciamento e execução de projetos acessível por ferramentas MCP descobríveis e documentadas.
- Corrigir escopo `tenant + project + entidade` em API REST, WebSocket e relações entre entidades.
- Padronizar validação de entrada, erros, respostas estruturadas, paginação, limites e correlação de operações.
- Suportar projetos `SIMPLE` e `HIERARCHICAL` sem exigir que o agente conheça detalhes de implementação.
- Permitir operações unitárias e batch seguras, com idempotência onde a operação puder ser repetida.
- Testar o registro MCP, schemas, transporte, API isolada, RBAC, multi-tenancy e falhas de rede.

**Non-Goals:**

- Não criar a skill de alto nível para agentes; ela será uma camada posterior sobre o MCP.
- Não substituir a API REST pública nem remover compatibilidade das ferramentas atuais sem plano de migração.
- Não permitir que API Keys ignorem RBAC do Owner ou membership do projeto.
- Não adicionar dependências com licenças GPL, AGPL, LGPL, BSL ou comerciais.
- Não transformar operações destrutivas em exclusão lógica sem requisito específico.

## Decisions

- **Camada de domínio compartilhada:** extrair validações e operações de projeto/item para serviços usados tanto pelas rotas REST quanto pelo MCP. Isso evita que o MCP replique regras ou crie caminhos de segurança diferentes. Alternativa rejeitada: o MCP chamar endpoints arbitrários sem uma camada comum, pois perpetua respostas inconsistentes e IDOR.
- **Catálogo por domínio:** organizar ferramentas em descoberta (`list_projects`, `get_project`, `get_board`, `get_tree`), planejamento (projeto, módulos, colunas, sprints, versões, tags), execução (items, move, reorder, claim/release, archive, delete), colaboração (membros/squads), evidências (checklists, logs, anexos) e automação (batch/conversão). Manter aliases compatíveis para as 11 ferramentas existentes durante a transição.
- **Respostas MCP estruturadas:** cada ferramenta retornará `structuredContent` com dados tipados, além de texto resumido legível. Erros usarão código estável, `message`, `details` seguros e `retryable`, sem stack trace ou SQL. Alternativa rejeitada: somente JSON serializado dentro de texto, que força parsing frágil pelo agente.
- **Validação runtime sem dependência nova:** criar schemas/validadores pequenos para campos obrigatórios, enums, limites, IDs, datas e paginação antes da chamada HTTP. Os mesmos contratos serão usados para gerar/descrever `inputSchema` e os testes validarão ausência de divergência.
- **Escopo de segurança obrigatório:** cada operação de entidade deve validar `tenant_id`, `project_id` e o ID da entidade; relações (`parent`, `module`, `column`, `sprint`, `tag`, `version`, `cost center`, `assignee`) devem pertencer ao mesmo projeto e tenant. O WebSocket deve validar membership antes do upgrade. Comentários `[TENANT]` permanecerão nos pontos críticos.
- **API Key com escopo opcional:** manter o Owner como limite máximo e adicionar escopo opcional por projetos/permissões (`read`, `write`, `admin`, `delete`), expiração, revogação e `last_used_at`. `delete` exige Owner ADMIN. Chaves legadas sem escopo continuam operando somente onde o Owner tem membership. O segredo bruto nunca será persistido ou retornado.
- **Idempotência e batch:** mutações de criação/configuração e conversões aceitarão `idempotencyKey` com retenção de 24 horas, vinculada ao Owner, ferramenta e payload. Batch aceitará `atomic`, com padrão `false` e limite inicial de 50 itens; `atomic=true` confirma ou desfaz todo o lote, enquanto `false` retorna resultado por item. Claim, move e delete não terão retry idempotente implícito e retornarão conflito explícito quando o estado mudar.
- **Operações destrutivas:** exclusão, arquivamento e conversão de board terão `dryRun`/preview quando tecnicamente possível e confirmação explícita no input. O preview informará registros afetados e não modificará dados; a execução revalidará autorização e estado para evitar TOCTOU.
- **Paginação e erros:** consultas paginadas usarão cursor opaco baseado em `position`, `updatedAt` e `id`, com padrão 50 e máximo 100. Erros usarão códigos estáveis (`VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `PROJECT_NOT_FOUND`, `ITEM_NOT_FOUND`, `RELATION_OUT_OF_SCOPE`, `CONFLICT`, `IDEMPOTENCY_CONFLICT`, `RATE_LIMITED`, `INTERNAL_ERROR`) e `retryable`, sem stack trace, SQL ou IDs internos.
- **Aliases e rastreabilidade:** manter aliases `list_tasks`, `create_task`, `move_task` e `complete_task` para compatibilidade, adotando nomes genéricos nas novas ferramentas. Aceitar `agentRunId`/`X-Correlation-Id` para rastrear uma execução sem registrar dados sensíveis.
- **Compatibilidade de projetos simples:** o MCP consultará `boardMode`/`simpleStoryId`; criação de TASK/BUG em projeto simples será encaminhada à STORY fixa. Ferramentas de módulo/épico retornarão estado claro de indisponibilidade em vez de induzir o agente a criar hierarquia inválida.
- **Uploads fora do MCP:** o programa continuará podendo lidar com anexos pelos fluxos manuais existentes, mas o agente não fará upload de arquivos nesta fase. O MCP poderá apenas consultar metadata/URL autorizada em uma etapa posterior, sem transformar o Azy Board em repositório de arquivos.
- **Testes por camadas:** manter testes unitários de `tools.ts`, adicionar testes de schemas/handlers MCP e integração contra API Hono com SQLite em memória e múltiplos tenants/projetos/roles. O transporte stdio será coberto por smoke test sem segredo real.
- **Documentação como contrato:** gerar/atualizar README do MCP e exemplos para Claude Code, Codex e OpenCode a partir do catálogo real. Um teste verificará que ferramentas documentadas e registradas não divergem.

## Risks / Trade-offs

- [Catálogo grande pode sobrecarregar o agente] → descrições curtas, agrupamento por domínio, limites explícitos e ferramentas de alto nível para fluxos comuns.
- [Mudança de API Key pode quebrar clientes] → migração aditiva, campos opcionais, chaves legadas com escopo Owner e período de compatibilidade documentado.
- [Batch e idempotência podem esconder conflitos] → resposta por item com códigos estáveis, estado anterior/atual quando seguro e sem retry automático em conflitos.
- [Correção de IDOR pode revelar bugs existentes] → adicionar testes multi-projeto antes da alteração e retornar 404/403 conforme a política sem vazar existência.
- [Agentes podem tentar usar o Azy Board como armazenamento] → não expor upload via MCP nesta fase; limitar eventual consulta futura a metadata/URL autorizada e manter o armazenamento fora do objetivo central.
- [Conversões e deletes são irreversíveis] → preview, confirmação e transação; não prometer restauração de estruturas removidas.

## Migration Plan

1. Criar contratos, validadores, códigos de erro e testes multi-tenant para as rotas REST atuais.
2. Corrigir escopos relacionais, WebSocket e operações silenciosas; publicar sem alterar o catálogo MCP.
3. Adicionar campos de ciclo de vida/escopo de API Key via migração compatível e preservar chaves existentes.
4. Implementar o catálogo MCP por grupos, começando por descoberta e CRUD de projeto/board, depois execução e governança.
5. Adicionar respostas estruturadas, paginação, batch, idempotência e previews conforme cada domínio for liberado.
6. Atualizar documentação e executar testes locais, CI e smoke contra cada instalação publicada.
7. Em rollback, manter migrações aditivas, desabilitar ferramentas novas por catálogo/feature flag e preservar as ferramentas legadas corrigidas.

## Open Questions

- Não há decisões abertas para esta etapa; uploads via IA estão explicitamente fora do escopo.
