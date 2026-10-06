## ADDED Requirements

### Requirement: Descritor da ferramenta read_attachment

O catálogo compartilhado SHALL declarar a ferramenta `read_attachment` no mesmo descritor único usado por schema, validação, routing, policy e executor, exigindo `projectId`, `itemId` e `attachmentId`, com policy de leitura (`VIEWER`) e classificação `{ domain: 'evidence', scope: 'item', operation: 'read' }`. A descrição SHALL deixar explícitos os formatos textuais suportados, a existência de limites de leitura e a regra de que formatos não interpretáveis são declarados como não suportados.

#### Scenario: Campos e obrigatoriedade coerentes

- **WHEN** o schema exposto e a validação de `read_attachment` são inspecionados
- **THEN** `projectId`, `itemId` e `attachmentId` aparecem como obrigatórios e não há campos paralelos fora do descritor

#### Scenario: Classificação de leitura

- **WHEN** o routing consulta `read_attachment`
- **THEN** obtém domínio Evidence, escopo item, operação read e risco derivado de leitura, sem exigir aprovação de mutação

#### Scenario: Formato não suportado é declarado

- **WHEN** a descrição e o schema de resposta de `read_attachment` são documentados no catálogo
- **THEN** fica explícito que formatos não interpretáveis retornam `unsupported` e que a leitura é limitada, sem prometer OCR ou leitura de qualquer arquivo

### Requirement: Schema de resposta da leitura de anexo

O descritor de `read_attachment` SHALL declarar a forma da resposta de leitura, contendo a identificação do anexo, `format`, `text`, `encoding`, `totalBytes`, `readBytes`, `charCount`, `truncated`, `reason` e `nextOffset` quando aplicável, e SHALL ser verificado pelo contrato do catálogo junto das demais ferramentas.

#### Scenario: Contrato do catálogo cobre a nova ferramenta

- **WHEN** `bun test packages/tool-registry` e `bun run test:mcp-catalog` executam
- **THEN** `read_attachment` possui descritor, policy, routing, campos e shape de resposta consistentes, sem descritor órfão nem executor sem definição

#### Scenario: Forma mínima aceita

- **WHEN** o teste de paridade monta o payload mínimo de `read_attachment`
- **THEN** a validação aceita exatamente `projectId`, `itemId` e `attachmentId` e o schema marca apenas esses três como obrigatórios
