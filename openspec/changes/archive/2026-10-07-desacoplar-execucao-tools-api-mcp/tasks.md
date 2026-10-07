Board ref: 5a92afc0-d02d-4dbe-9852-b931cb81ecb2

## 1. Contratos e dependências

- [x] 1.1 Inventariar ferramentas/executores/imports de `registry.ts`, `tools.ts`, `assistantTools.ts` e consumidores do harness/worker; registrar mapa dos casos críticos e fallback não crítico.
- [x] 1.2 Integrar interfaces estabilizadas de T36 `corrigir-inicializacao-advanced` e T38 `garantir-mutacoes-idempotentes-transacionais`, sem recriar adapters ou unidade de trabalho.
- [x] 1.3 Integrar contexto/fencing de T37 `separar-worker-agent-advanced` e fronteira de publicação de T39 `sincronizar-eventos-entre-instancias`; registrar ownership da extração.
- [x] 1.4 Criar fixtures de contrato para coerção/null/duração/projeto/sanitização/aprovação/snapshot e resultados atuais antes de mover executores.

## 2. Execução independente de transporte

- [x] 2.1 Criar `packages/tool-execution` com port de invocação tipado e contexto confiável, exports/workspace/build strict, sem dependências de apps/framework/driver e somente licenças permitidas.
- [x] 2.2 Extrair normalização, dispatch, resolução de projeto e sanitização para o pacote preservando contratos e erros.
- [x] 2.3 Extrair mapeamentos HTTP de `apps/mcp/src/tools.ts` para adaptador compartilhado e deixar MCP como transporte; manter fachada compatível temporária.
- [x] 2.4 Migrar `apps/api/src/services/assistantTools.ts` e consumidores para imports do pacote, retirando dependência direta ou transitiva de fontes MCP.

## 3. Casos de uso críticos

- [x] 3.1 Extrair criação de item em `apps/api/src/application` usando ports T36/T38, autorização server-side, relações/defaults e resultado transacional único.
- [x] 3.2 Extrair edição/movimento com revisão, Leaf Rule e efeitos da mesma unidade de trabalho; reduzir handlers de `routes/items.ts` a adaptação.
- [x] 3.3 Extrair batch de criação/atualização/movimentação e conectar `routes/batch.ts` sem commit parcial ou regra duplicada.
- [x] 3.4 Extrair invocação de ferramenta do agente para caso local com revalidação e fencing, preservando política de aprovação e contexto de fotografia.
- [x] 3.5 Inserir `// [TENANT]` nos pontos de contexto/query e `// [DB-SWAP]` nos pontos de composição específicos de adapter; verificar funções pequenas e ausência de credenciais hardcoded.

## 4. Verificação e rollout

- [x] 4.1 Testar casos diretamente com falha injetada, membership revogada, cross-tenant/projeto, revisão antiga, perda de posse e retry pós-commit sem duplicação.
- [x] 4.2 Executar matriz REST/MCP HTTP/agente local de resultados, erros e efeitos em SIMPLE/ADVANCED reais.
- [x] 4.3 Adicionar gate de imports/ciclos e build/boot da API em staging sem `apps/mcp`, preservando o workspace original.
- [x] 4.4 Retirar fachadas transitórias após paridade verde; atualizar referências de arquitetura/geração de docs e registrar procedimento de rollback compatível com schema.
- [x] 4.5 Na futura implementação, executar `bun run check`, `bun run test:smoke`, catálogo MCP e matriz ADVANCED, registrando evidências antes do aceite.
