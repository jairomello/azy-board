Board refs: `6e02905a-82d7-4562-b9bc-376548a3031f`, `741f2306-12c3-4ee2-84a1-5f8cc27483db`, `e50f3019-94ff-4e6a-9ae4-f164ecd78d15`, `f1438f61-643c-4517-bbaa-5277198d6cb8`

## 1. Resposta de mutações

- [x] 1.1 Mapear o payload atual produzido por `update_item`/`update_items` na API, MCP e testes, identificando onde `items[].changes` recebe identidade em vez de valores aplicados
- [x] 1.2 Definir no `packages/tool-registry` o contrato compartilhado de resposta com `identity`, `changes`, `applied`, `matchedCount` e `updatedCount`
- [x] 1.3 Alterar o executor de atualização para preencher `changes` somente com campos efetivamente aplicados e `identity` com os dados de identificação
- [x] 1.4 Adicionar resumo agregado `applied` quando o valor for comum, sem remover `matchedCount`/`updatedCount`
- [x] 1.5 Criar testes de contrato para atualização unitária, atualização filtrada, valores comuns e valores diferentes por item

## 2. `list_tasks` leve e projetável

- [x] 2.1 Adicionar ao catálogo os campos `includeDescriptions`, `fields`, `limit` e `cursor`, com descrições, tipos, default e limites coerentes
- [x] 2.2 Alterar API/MCP para default `includeDescriptions=false` e `limit=50`, preservando máximo 100 e paginação por cursor
- [x] 2.3 Implementar projeção declarativa que rejeite campos desconhecidos e preserve os campos estruturais mínimos necessários
- [x] 2.4 Achatar relações de sprint e tags para a resposta (`sprintId`, `sprintName`, `tagIds`, `tagNames`) sem carregar relações aninhadas desnecessárias
- [x] 2.5 Manter `includeDescriptions=true` como caminho explícito para descrições completas
- [x] 2.6 Adicionar testes de contrato, orçamento de payload, cursor, limite, projeção e compatibilidade de detalhes explícitos
- [x] 2.7 Atualizar README, skill e CHANGELOG sobre a mudança observável do default de `list_tasks`

## 3. Erros acionáveis e retry

- [x] 3.1 Padronizar mensagens de validação MCP com código, caminho, causa e snippet mínimo quando o formato ou campo for inválido
- [x] 3.2 Ajustar `get_current_sprint` para retornar `status: NONE` com `nextSteps` acionáveis quando não houver sprint ativa
- [x] 3.3 Documentar na skill o retry único e isolado para JSON inválido, sem paralelismo e sem afirmar sucesso não confirmado
- [x] 3.4 Documentar a decisão de retry por `retryable`/`Retry-After`, separando parsing local de erros permanentes da API
- [x] 3.5 Adicionar testes do envelope, snippets mínimos, `nextSteps`, retryable e ausência de retry em validação/autorização/conflito
- [x] 3.6 Registrar o acompanhamento do bug externo de serialização paralela sem adicionar código ou dependência ao repositório

## 4. Checklists semânticos e em lote

- [x] 4.1 Definir no registry os parâmetros semânticos de `check_item`/`update_checklist_item` e a resolução por checklistName + texto/posição
- [x] 4.2 Implementar resolução dentro do card, com normalização documentada, erro para zero resultados e conflito para múltiplos resultados
- [x] 4.3 Manter e testar o caminho canônico por IDs, sem cruzamento silencioso com critérios semânticos
- [x] 4.4 Criar a ferramenta `check_items` com lista limitada a 100 entradas, policy, routing, schema e executor
- [x] 4.5 Implementar execução atômica por card, contagens agregadas e falhas/conflitos identificados por entrada
- [x] 4.6 Adicionar testes para lote válido, limite excedido, item ambíguo, item inexistente, rollback e atualização por IDs
- [x] 4.7 Atualizar skill, README, catálogo e suíte MCP para o fluxo semântico e em lote

## 5. Integração e gates

- [x] 5.1 Revisar paridade entre catálogo, API, MCP, dispatcher, policy, executor e documentação para todas as mudanças
- [x] 5.2 Rodar `bun run check`, `bun run test:smoke`, `bun run test:agent-skill` e a suíte de regressão MCP
- [x] 5.3 Corrigir regressões de consumidores que dependiam do payload completo de `list_tasks` ou do significado antigo de `changes`
- [x] 5.4 Conferir os quatro Board refs nos artefatos e registrar logs separados nos cards quando a implementação iniciar
