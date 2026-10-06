## 1. Contratos compartilhados

- [x] 1.1 Declarar `read_attachment` em `packages/tool-registry/src/fields.ts` com `projectId`, `itemId` e `attachmentId` obrigatórios
- [x] 1.2 Registrar a policy de leitura (`VIEWER`) de `read_attachment` em `packages/tool-registry/src/policies.ts`
- [x] 1.3 Adicionar em `packages/tool-registry/src/registry.ts` a classificação `{ domain: 'evidence', scope: 'item', operation: 'read' }`, o namespace `discovery`, a descrição (formatos suportados, limites e `unsupported`) e o schema de resposta da leitura
- [x] 1.4 Definir `ATTACHMENT_READ_MAX_BYTES` e `ATTACHMENT_READ_MAX_CHARS` em `packages/assistant-contracts/src/assistantLimits.ts`, mantendo o teto de caracteres abaixo de `HARNESS_LIMITS.toolOutputChars`
- [x] 1.5 Atualizar os testes de contrato do catálogo (`packages/tool-registry/src/registry-contract.test.ts`) e regenerar a documentação (`bun run generate:docs`)

## 2. API — extração e rota de conteúdo

- [x] 2.1 Criar `apps/api/src/services/attachmentContent.ts` com registro de extratores por MIME para `text/plain`, `text/markdown`, `text/csv` e `application/json`, com decodificação UTF-8/BOM e `format` identificado
- [x] 2.2 Retornar `format: unsupported` com motivo para PDF, Office, imagens, áudio, vídeo e compactados, sem texto e sem afirmar leitura
- [x] 2.3 Implementar leitura limitada de bytes pelo `StorageAdapter` (BunFile e web stream para `arrayBuffer`), interrompendo no teto de bytes sem carregar o arquivo inteiro
- [x] 2.4 Adicionar ao router `apps/api/src/routes/attachments.ts` a rota `GET /projects/:projectId/items/:itemId/attachments/:attachmentId/content` com `requireRole('VIEWER')`, ancoragem `getItem`/`getAttachment` e `storageAdapterForTenant`, sem expor caminho físico
- [x] 2.5 Manter a leitura funcionando com anexos desabilitados (`enabled=false`), sem liberar upload, edição ou remoção
- [x] 2.6 Retornar sempre `totalBytes`, `readBytes`, `charCount`, `truncated`, `reason` e `nextOffset` quando houver corte por limite de caracteres
- [x] 2.7 Reforçar a ancoragem por projeto na query de anexos do adapter Postgres (`apps/api/src/db/postgres/adapter.ts`) como melhoria defensiva

## 3. MCP

- [x] 3.1 Implementar `toolReadAttachment` em `apps/mcp/src/tools.ts` consumindo a rota de conteúdo da API
- [x] 3.2 Registrar o dispatch de `read_attachment` em `apps/mcp/src/registry.ts`
- [x] 3.3 Regenerar o README/catálogo do MCP e atualizar os testes de catálogo/opcionais

## 4. Harness do agente

- [x] 4.1 Delimitar e rotular no transcript o conteúdo extraído como dado não confiável, neutralizando sequências que colidam com o delimitador (`apps/api/src/services/assistantHarness.ts`)
- [x] 4.2 Respeitar o teto de caracteres da leitura e repassar `truncated`/`reason`/`nextOffset`, permitindo leitura segmentada sem corte silencioso
- [x] 4.3 Registrar os anexos efetivamente lidos na run e anotar a prévia de proposta com o anexo de origem, sem alterar argumentos nem o hash da operação
- [x] 4.4 Ajustar os reexports de `apps/api/src/services/assistantTools.ts` se necessário para o novo fluxo de leitura

## 5. Skill oficial

- [x] 5.1 Documentar em `skills/azyboard/SKILL.md` e `skills/azyboard/references/mcp-operations.md` o uso de `read_attachment`, os formatos suportados, os limites com `truncated`/`nextOffset`, o conteúdo não confiável e a regra de não fingir leitura de formato incompatível
- [x] 5.2 Espelhar a atualização em `.opencode/skills/azyboard/` e executar `bun run test:agent-skill`

## 6. Testes e verificação

- [x] 6.1 Cobrir autorização e isolamento da leitura (não-membro, cross-tenant e cross-project) e leitura com anexos desabilitados em `apps/api/src/integration.test.ts`
- [x] 6.2 Cobrir extração por formato, `unsupported`, limites/`nextOffset`, interrupção no teto de bytes e ausência de caminho físico no teste do serviço/rota de conteúdo
- [x] 6.3 Cobrir no harness a delimitação/não injeção do conteúdo, o repasse de `truncated` e a prévia citando apenas anexos efetivamente lidos (`apps/api/src/services/assistantHarness.test.ts`)
- [x] 6.4 Cobrir paridade de schema/validação/dispatcher e forma mínima de `read_attachment` nos testes de catálogo/MCP
- [x] 6.5 Executar `bun run check`, `bun run test:smoke` e `bun run test:agent-skill` e corrigir o que falhar
