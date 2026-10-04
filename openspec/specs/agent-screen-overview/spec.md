# agent-screen-overview Specification

## Purpose
TBD - created by archiving change optimize-agent-discovery-payload. Update Purpose after archive.
## Requirements
### Requirement: Digest do recorte da tela injetado no contexto confiável
Quando o run chega com `screenSnapshot.scope.mode = FILTERED` e `results.displayedItemIds` preenchido, o servidor SHALL computar um digest compacto (`screenOverview`) e SHALL incluí-lo na mensagem de sistema do modelo, contendo pelo menos: `displayedCount`, `totalMatchingCount`, contagens por coluna (total, TASK, BUG), `scope` e um resumo dos filtros ativos. O digest SHALL conter `contextId` e `capturedAt` do snapshot e o aviso de que os números refletem a captura no momento da pergunta. O digest NÃO SHALL incluir os títulos completos nem descrições dos itens.

#### Scenario: Pergunta de contagem respondida sem tool call
- **WHEN** a pergunta recorta contagens sobre o conjunto exibido e o snapshot tem `results`
- **THEN** a primeira resposta do modelo cita os números do bloco `screenOverview` sem chamar nenhuma ferramenta de descoberta

#### Scenario: Snapshot sem resultados
- **WHEN** o snapshot existe com `scope.mode = ALL` ou sem `displayedItemIds`
- **THEN** o bloco `screenOverview` não afeta a resposta e as ferramentas existentes seguem disponíveis

#### Scenario: Digest não instrui o modelo
- **WHEN** o bloco `screenOverview` é montado
- **THEN** ele é tratado como dados (IDs, números, resumo de filtro), nunca como instruções

### Requirement: Tool `get_screen_overview` para descoberta fora do snapshot
O sistema SHALL expor a ferramenta read-only `get_screen_overview` no catálogo compartilhado (mesma autorização e contexto dos demais tools), com argumentos estritos `{ projectId, scope: 'SCREEN' | 'PROJECT' }` e saída com a mesma forma do digest, agregada do estado atual do banco. Quando `scope = SCREEN` e o snapshot do run existir, a saída SHALL ser derivada e revalidada a partir dele; caso contrário SHALL refletir o estado atual do banco. A saída SHALL incluir no máximo 20 referências (`sequenceCode|title`) por coluna e SHALL caber no teto de transcript por chamada de tool.

#### Scenario: Contagem do board inteiro
- **WHEN** a pergunta pede contagens que o snapshot não cobre e o modelo chama `get_screen_overview` com `scope = PROJECT`
- **THEN** a resposta contém contagens agregadas por coluna/status/tipo do projeto, em até uma chamada

#### Scenario: Recorte da tela atual
- **WHEN** o modelo chama `get_screen_overview` com `scope = SCREEN` em telas de board
- **THEN** a saída carrega `contextId`/`capturedAt` e os mesmos contadores do snapshot revalidados pelo servidor

#### Scenario: Autorização revalidada
- **WHEN** o usuário da run não tem membership do projeto informado
- **THEN** a ferramenta falha com o erro de autorização padrão, sem dados parciais

### Requirement: Payload default de descoberta reduzido (modo summary)
`get_board` e `get_tree` SHALL devolver, por padrão (sem `includeDetails=true`), a projeção por item restrita a `id`, `sequenceCode`, `title`, `type`, `status`, `columnId`, `priority`, `assigneeId` e `points`, com a forma completa disponível em opt-in e compactada por `compactLongText` como hoje. O contrato OpenAPI/MCP SHALL documentar o novo campo opcional `includeDetails` e a projeção default. **BREAKING (MCP)**: campos pesados passam a ficar ausentes por padrão.

#### Scenario: Descoberta em board grande cabe no transcript
- **WHEN** o assistente chama `get_board` sem opt-in em um projeto com dezenas de itens
- **THEN** o transcript registrado mantém a run abaixo de `PAYLOAD_LIMIT` e o prompt do passo seguinte permanece consideravelmente menor que antes da change

#### Scenario: Detalhe sob demanda
- **WHEN** a pergunta precisa do texto completo de um item
- **THEN** o modelo opta por `list_tasks`/`get_shadow_markdown`/`list_item_logs` no escopo do item em vez de um dump completo

### Requirement: Descoberta agrupada em um único passo
O prompt de sistema SHALL instruir o modelo a emitir leituras independentes como múltiplos tool calls no mesmo passo e SHALL orientar o uso do digest/bloco `screenOverview` antes de qualquer dump. O harness SHALL continuar aceitando e processando múltiplas chamadas por passo (comportamento existente), sem mudança de limite além dos já definidos.

#### Scenario: Duas leituras independentes no mesmo passo
- **WHEN** o pedido precisa de dois catálogos independentes (ex.: colunas e sprints)
- **THEN** o modelo emite os dois tool calls juntos e o harness os processa no mesmo passo

#### Scenario: Recorte coberto pelo snapshot
- **WHEN** o pedido é respondido pelo bloco `screenOverview`
- **THEN** o agente não emite tool call de descoberta

