Board ref: 127985ce-0438-4f30-8e09-a6f84ae27a1c

## 1. Fonte única das constantes de limites

- [x] 1.1 Criar `packages/types/src/assistantLimits.ts` com `DEFAULT_GOVERNANCE`, `GOVERNANCE_BOUNDS`, `HARNESS_LIMITS`, `MAX_MESSAGE_BYTES` e `MAX_ASSISTANT_ACTIONS`, preservando os valores atuais do runtime
- [x] 1.2 Reexportar o módulo em `packages/types/src/index.ts` e rodar o typecheck dos workspaces
- [x] 1.3 Migrar `apps/api/src/routes/assistant.ts` e `apps/api/src/services/assistantHarness.ts` para consumir as constantes compartilhadas
- [x] 1.4 Migrar `apps/web/src/components/RootAssistantSettings.tsx` para consumir os defaults e faixas compartilhados (corrigindo a divergência de `maxSteps`/`maxPayloadBytes`)
- [x] 1.5 Adicionar testes garantindo que os valores efetivos de runtime não mudaram e que API e web usam a mesma fonte

## 2. Geradores de referências voláteis

- [x] 2.1 Criar `scripts/generate-mcp-catalog.ts` gerando a seção do catálogo in-place em `apps/mcp/README.md` entre marcadores `<!-- BEGIN GENERATED: mcp-catalog -->`/`<!-- END GENERATED: mcp-catalog -->`
- [x] 2.2 Criar `scripts/generate-openapi.ts` escrevendo `docs/generated/openapi.json` a partir de `openApiDocument()`
- [x] 2.3 Criar `scripts/generate-assistant-limits.ts` escrevendo `docs/generated/assistant-limits.md` a partir das constantes compartilhadas
- [x] 2.4 Adicionar o agregador `generate:docs` no `package.json` e o cabeçalho padrão de origem/regeneração em cada artefato
- [x] 2.5 Gerar e versionar os artefatos iniciais e ajustar `check:mcp-catalog`/`check-agent-skill` para continuarem válidos

## 3. Verificação de integridade

- [x] 3.1 Criar `scripts/check-docs.ts` que regenera os artefatos em memória e falha em divergência
- [x] 3.2 Adicionar verificação de links internos relativos de Markdown, ignorando âncoras e URLs externas
- [x] 3.3 Adicionar lista única de afirmações proibidas (ex.: "toda mutação exige aprovação", importação de CSV ligada à UI) e falhar quando reintroduzidas
- [x] 3.4 Adicionar o script `check:docs` no `package.json` e testes do verificador

## 4. Correção e consolidação da documentação

- [x] 4.1 Corrigir no `README.md` as afirmações divergentes (limites do agente, CSV, aprovação obrigatória, SQLite/PostgreSQL) e substituir números por referência ao artefato gerado
- [x] 4.2 Corrigir a wiki (`docs/azyboard-wiki/`) e `DEPLOY.md`/`DEPLOY_LABAPPS_LOCAL.md` nas mesmas divergências e apontar para os gerados
- [x] 4.3 Criar `docs/README.md` como índice de papéis das fontes de documentação
- [x] 4.4 Atualizar `docs/ci.md` com o novo gate de documentação
- [x] 4.5 Atualizar o pack de conhecimento do agente (`assistantKnowledge.ts`) se algum caminho de fonte for movido, regenerando `build-azy-knowledge-pack`

## 5. Integração à verificação e ao CI

- [x] 5.1 Adicionar o gate `check:docs` a `scripts/regression.ts`
- [x] 5.2 Adicionar o job/etapa de documentação em `.github/workflows/ci.yml`
- [x] 5.3 Rodar localmente `bun run check:docs`, `bun run generate:docs` e `bun run check`

## 6. Definição de pronto

- [x] 6.1 Adicionar ao checklist de PR do `CONTRIBUTING.md` a revisão de documentação e o `check:docs`
- [x] 6.2 Adicionar ao `CONTRIBUTING.md` a seção de papéis das fontes, referenciando `docs/README.md`

## 7. Verificação e fechamento

- [x] 7.1 Rodar `bun run check`, `bun run test:regression` e `bun run test:smoke`
- [x] 7.2 Rodar `bun run test:agent-skill` caso `skills/azyboard/` seja tocada
- [x] 7.3 Registrar no card do board (`Board ref: 127985ce-0438-4f30-8e09-a6f84ae27a1c`) o vínculo com esta change
- [x] 7.4 Ao concluir a implementação, fechar o card com `complete_task` e confirmar no board que o status é `DONE`
