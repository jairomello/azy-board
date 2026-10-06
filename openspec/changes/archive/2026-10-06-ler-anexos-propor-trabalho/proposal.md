## Why

O Azy Agent lista anexos de um card (`list_attachments`), mas não consegue **ler o conteúdo** do arquivo: a aplicação tem download autorizado e ainda não transforma bytes em texto para o modelo. Pedidos naturais — “use o documento anexado aqui para propor os critérios de aceite e uma checklist” — não podem ser atendidos, e o agente pode acabar fingindo uma interpretação que não existe. Fechar essa lacuna é a oportunidade #7 (P2, integração e novo processamento) do doc `docs/SUGESTOES-EVOLUCAO-AZY-AGENT.md` e o escopo do card **T23**.

**Board ref:** `8000ab66-d420-4f2f-9477-0194bc31cde0` (T23 — Ler anexos autorizados e propor trabalho a partir deles, coluna "Fazendo").

## What Changes

- **Nova ferramenta de leitura `read_attachment`** no catálogo compartilhado (MCP + Azy Agent): lê o conteúdo textual de um anexo autorizado do card, por `projectId` + `itemId` + `attachmentId`, e devolve o texto extraído com metadados do arquivo (nome, tipo, tamanho) e a indicação explícita de cobertura.
- **Extração por formato textual**: começa por formatos que o produto já aceita e que são legíveis sem dependências novas — texto/Markdown/CSV/JSON — e por formatos com parser já disponível. Formatos não interpretáveis (imagens for raster, áudio, vídeo, binários compactados) são **declarados como não interpretados**, nunca “lidos” de forma fingida. OCR e visão ficam **fora de escopo** (evolução separada).
- **Leitura autorizada e isolada**: reutiliza a autorização de anexos (membership no projeto, VIEWER+), a ancoragem tenant/projeto/item e o mesmo controle de URL autenticada; nunca expõe caminho físico de armazenamento. Leitura continua permitida mesmo com anexos **desabilitados** no tenant (upload/edição/remoção permanecem bloqueados).
- **Conteúdo não confiável**: o texto extraído entra no transcript como **dado**, delimitado e rotulado, e não pode comandar ferramentas; instruções contidas no documento são tratadas como conteúdo, não como ordens.
- **Limites explícitos e não-truncamento silencioso**: teto de bytes lidos e de caracteres devolvidos por chamada, com `truncated`, `reason` e o intervalo lido sempre presentes; acima do teto, o agente segmenta a leitura em vez de perder texto em silêncio.
- **Proposta de trabalho fundamentada**: com o conteúdo lido, o agente propõe critérios de aceite e/ou checklist citando o **anexo de origem** na prévia de aprovação; a aplicação reutiliza as ferramentas de mutação existentes (`batch`, `create_task`, `update_item`, `create_checklist`/`add_checklist_item_to_task`) sob o fluxo de aprovação já vigente, sem ampliar o escopo aprovado nem inventar dados de arquivos incompatíveis.
- **Sem BREAKING**: ferramenta, campos e metadados são aditivos; nada muda no comportamento atual de `list_attachments` nem nos fluxos sem leitura de conteúdo.

**Fora de escopo:** OCR, interpretação de imagens/visão multimodal, áudio, vídeo, binários compactados; armazenamento persistente de texto extraído; edição de metadados de anexo pela conversa.

## Capabilities

### New Capabilities
- `attachment-content-reading`: leitura autorizada de conteúdo de anexo por ID, extração de texto para formatos suportados, limites explícitos de leitura/exibição com indicação de trechos não interpretados, e tratamento de conteúdo do documento como dado não confiável.
- `attachment-work-proposal`: transformar o conteúdo lido em proposta revisável (critérios de aceite e/ou checklist) com referência ao anexo de origem, sujeita à aprovação existente e sem expandir escopo nem fabricar leitura de formatos incompatíveis.

### Modified Capabilities
- `mcp-tool-registry`: o catálogo compartilhado passa a registrar `read_attachment` (campos, política de leitura, classificação `{ domain: 'evidence', scope: 'item', operation: 'read' }`, descrição e schema de resposta de leitura).
- `mcp-server`: a ferramenta `read_attachment` é exposta no MCP via adaptador HTTP para a leitura autorizada de conteúdo do anexo.
- `adaptive-agent-tool-routing`: `read_attachment` entra no conjunto de descoberta/roteamento para intenções de leitura sobre anexos, ao lado de `list_attachments`.
- `azy-agent-harness`: a leitura de anexo é integrada ao transcript como dado delimitado e não confiável, com limites explícitos de tamanho e a prévia de proposta citando o arquivo de origem.
- `official-agent-skill`: a skill oficial documenta a leitura de anexos, os formatos suportados, os limites e a regra de não interpretar formatos incompatíveis.

## Impact

- **Contratos compartilhados**: `packages/tool-registry/src/{fields,policies,registry}.ts` (nova ferramenta, classificação, descrição e schema de resposta), `packages/assistant-contracts` (limites de leitura por chamada) e `packages/ui-contracts` (eventual contrato de leitura, se necessário).
- **API**: `apps/api/src/routes/attachments.ts` (reaproveitar autorização/ancoragem e o acesso ao `StorageAdapter` via `storageAdapterForTenant`) e um novo serviço de extração de conteúdo em `apps/api/src/services/`; sem tocar o caminho de download existente.
- **MCP**: `apps/mcp/src/tools.ts` (adaptador `toolReadAttachment`) e `apps/mcp/src/registry.ts` (dispatch); README gerado.
- **Harness do agente**: `apps/api/src/services/assistantHarness.ts` (delimitação de conteúdo não confiável, limites de transcript e prévia com referência ao anexo); `apps/api/src/services/assistantTools.ts` (reexport).
- **Skill**: `skills/azyboard/SKILL.md` e `skills/azyboard/references/mcp-operations.md`, com espelho em `.opencode/skills/azyboard/`.
- **Testes**: contrato do catálogo (`registry-contract`), autorização/isolamento da leitura, extração por formato, limites/truncamento, não interpretação de formatos incompatíveis, prévia com referência ao arquivo e `bun run test:agent-skill`; verificação final com `bun run check` e `bun run test:smoke`.
