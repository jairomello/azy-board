## Why

Quatro follow-ups do MCP afetam a mesma experiência operacional: confirmações de
mutação exigem reconsultas pesadas, respostas de `update_items` não mostram a mudança
aplicada, erros de tool call não orientam recuperação e checklists exigem repetição de
IDs instáveis. Consolidar os ajustes reduz payload e ambiguidade para agentes, melhora
a recuperação de falhas e cria caminhos semânticos e em lote para operações repetitivas.

Board refs: `6e02905a-82d7-4562-b9bc-376548a3031f`, `741f2306-12c3-4ee2-84a1-5f8cc27483db`, `e50f3019-94ff-4e6a-9ae4-f164ecd78d15`, `f1438f61-643c-4517-bbaa-5277198d6cb8`

## What Changes

- Corrigir o contrato de resposta de `update_item`/`update_items`, distinguindo a
  identidade retornada da mudança aplicada e preservando `matchedCount`/`updatedCount`.
- Tornar `list_tasks` leve por padrão, com `includeDescriptions` explícito, limite
  padrão, projeção opcional e relações de sprint/tag achatadas para confirmação rápida.
- Definir padrão de recuperação para JSON inválido e mensagens acionáveis com forma
  mínima, além de orientar `get_current_sprint` quando não houver sprint ativa.
- Adicionar resolução semântica para operações de checklist e operação em lote para
  marcar/desmarcar passos, mantendo o caminho atual por IDs como alternativa.
- Atualizar testes de contrato, smoke/regressão, documentação e skill oficial.
- **BREAKING**: o default de `list_tasks` deixará de retornar o projeto inteiro e
  descrições completas; consumidores que dependem desse comportamento deverão pedir
  `includeDescriptions`/paginação explicitamente.

## Capabilities

### New Capabilities

- `mcp-checklist-operations`: resolução semântica e operações em lote para checklists.

### Modified Capabilities

- `mcp-server`: contrato de respostas de mutação, listagem leve, checklist e orientação
  de recuperação passam a ser explícitos e testáveis.
- `mcp-tool-registry`: catálogo passa a declarar projeção, limite, relações achatadas,
  resposta de mudanças e formas mínimas acionáveis.
- `official-agent-skill`: skill passa a documentar payload leve, retry isolado para JSON
  inválido, mensagens acionáveis e o fluxo semântico/em lote de checklists.
- `unified-error-contract`: mensagens de validação e semântica de retry passam a
  orientar o próximo passo sem inferência pelo agente.

## Impact

- `packages/tool-registry` — descrições, schemas, tipos de resposta, validação e testes
  de `update_items`, `list_tasks` e checklists.
- `apps/mcp` — executores, normalização de respostas, resolução semântica e operações
  em lote.
- `apps/api` — projeção/limite de `list_tasks`, payloads de batch e rotas de checklist,
  caso a API ainda não exponha os dados necessários.
- `skills/azyboard/` e `.opencode/skills/azyboard/` — fluxo operacional e erros.
- Testes de contrato, API E2E, smoke e `bun run test:agent-skill`.
- O item de reportar o bug do harness externo será documentado como acompanhamento,
  sem adicionar dependência nem código ao repositório deste projeto.
