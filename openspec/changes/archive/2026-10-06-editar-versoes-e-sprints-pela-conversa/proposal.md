## Why

O Azy Agent já cria versões e cria/ativa/fecha sprints, mas não consegue **editar** nenhuma das duas entidades pela conversa. A tela de configurações permite renomear uma versão, definir data de lançamento, descrição e situação (`PLANNED`/`IN_DEV`/`RELEASED`/`CANCELLED`), e editar nome e datas de uma sprint; nada disso tem paridade no catálogo compartilhado. Além disso, `create_version` expõe apenas `name`, embora a API já aceite `description`, `releaseDate` e `status`. Isso obriga o usuário a sair do chat e abrir Configurações para um ajuste que o próprio agente deveria conduzir com prévia e aprovação.

O card **T24 — Editar versões e sprints pela conversa** fecha essa lacuna na mesma trilha do doc `docs/SUGESTOES-EVOLUCAO-AZY-AGENT.md` (oportunidade 8: “Manter versões e sprints sem sair da conversa”).

**Board ref:** `96126546-6215-4438-bed7-4619e78a18af` (T24 - Editar versões e sprints pela conversa, coluna "Backlog").

## What Changes

- **Edição de sprint pela conversa**: nova ferramenta `update_sprint` para alterar `name`, `startDate` e/ou `endDate`, apoiada na rota `PATCH /projects/:id/sprints/:sprintId` já existente. A edição SHALL preservar status e ciclos analíticos da sprint (não reabre, não suspende, não encerra); transições continuam exclusivas de `activate_sprint`/`close_sprint`.
- **Edição de versão pela conversa**: nova ferramenta `update_version` para alterar `name`, `releaseDate`, `description` e/ou `status`, apoiada em `PATCH /projects/:id/versions/:versionId`. Inclui limpar campos opcionais (`releaseDate`, `description`) — o mesmo efeito de “Sem versão”/descrição vazia na tela.
- **`create_version` paritário**: passa a aceitar `releaseDate`, `description` e `status` (hoje só `name`), alinhado ao que `POST /projects/:id/versions` já aceita.
- **Contrato de alteração explícito**: `update_sprint` e `update_version` usam um argumento `changes` com `{ field, operation, value }` e operações `SET`/`CLEAR`, o mesmo modelo já usado por `update_item`/`update_item_log`, para expressar “antes → depois” e distinguir “não informado” de “limpar”.
- **Prévia antes/depois e aprovação**: a prévia de aprovação exibe os campos alterados com valor atual → novo valor, em pt-BR, antes de executar. Toda mutação continua exigindo aprovação humana.
- **RBAC e ciclo de vida**: as ferramentas exigem `ADMIN` (como as rotas) e rejeitam alterações inválidas (datas de sprint incoerentes, `CLEAR` em campo não anulável, `status` fora do enum) com erro acionável, sem persistência parcial.
- **Skill e documentação**: a skill oficial documenta as novas ferramentas e o formato `changes` (`SET`/`CLEAR`).
- **Sem BREAKING**: as mudanças são aditivas; `create_sprint`, `create_version`, `activate_sprint` e `close_sprint` mantêm o comportamento atual.

**Fora de escopo:** excluir versões/sprints pela conversa (`delete_version`/`delete_sprint`), reordenar versões (`position`), transição coordenada de sprint com prévia (oportunidade 11) e demais oportunidades do doc.

## Capabilities

### New Capabilities

<!-- Nenhuma nova capability: a mudança completa contratos e comportamentos existentes. -->

### Modified Capabilities

- `mcp-tool-registry`: novos descritores `update_sprint` e `update_version` (campos, schema de `changes` por ferramenta, routing, classificação e policy `ADMIN`); expansão de `create_version` com `releaseDate`/`description`/`status`.
- `mcp-server`: executores e dispatch de `update_sprint`/`update_version`; `create_version` repassa os campos novos; paridade schema/validador/executor no CI.
- `sprint-management`: edição de sprint pela conversa com paridade à tela, preservando status e ciclos.
- `version-management`: edição de versão pela conversa com paridade à tela, incluindo limpeza de campos opcionais e criação com os campos completos.
- `azy-agent-harness`: prévia antes/depois e aprovação para as edições de planejamento; validação de ciclo de vida e permissões.
- `official-agent-skill`: documentação de `update_sprint`, `update_version` e do formato `changes`.

## Impact

- **Catálogo compartilhado**: `packages/tool-registry/src/fields.ts` (campos de `update_sprint`, `update_version`, `create_version`), `registry.ts` (descrições, schemas de `changes` por ferramenta, `friendlyNames`), `policies.ts` (`ADMIN`), `validation.ts` (validação dos novos argumentos).
- **MCP**: `apps/mcp/src/tools.ts` (`toolUpdateSprint`, `toolUpdateVersion`, `toolCreateVersion` ampliado) e `apps/mcp/src/registry.ts` (dispatch); README gerado (`apps/mcp/README.md`).
- **API**: `apps/api/src/routes/sprints.ts` e `versions.ts` (rotas `PATCH` já existentes; conferir retorno e emissão de eventos) e `apps/api/src/validation.ts` (`sprintSchema`/`updateVersionSchema`).
- **Harness do agente**: `apps/api/src/services/assistantHarness.ts` (ramo de `approvalPreview` para edições de planejamento e canonicalização dos `changes`).
- **Skill**: `skills/azyboard/SKILL.md`, `skills/azyboard/references/mcp-operations.md` e espelho `.opencode/skills/azyboard/`.
- **Testes**: `packages/tool-registry/src/registry-contract.test.ts`, `apps/mcp/src/optional-fields.test.ts`/suíte MCP e `bun run test:mcp-catalog`; verificação final com `bun run check` e `bun run test:smoke`.
