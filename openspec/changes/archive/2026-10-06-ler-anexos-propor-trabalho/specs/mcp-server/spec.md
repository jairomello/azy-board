## ADDED Requirements

### Requirement: Ferramenta MCP read_attachment

O servidor MCP SHALL expor a ferramenta `read_attachment`, que lê o conteúdo autorizado de um anexo por `{ projectId, itemId, attachmentId }` através da API, reaproveitando a definição única do catálogo, e SHALL devolver o texto extraído com os metadados do arquivo e a indicação explícita de limites (`truncated`/`reason`) e de formato não suportado. A ferramenta NÃO SHALL expor caminho físico, credenciais de armazenamento nem conteúdo fora do escopo autorizado.

#### Scenario: Ler anexo textual pelo MCP

- **WHEN** um agente invoca `read_attachment` com `{ projectId, itemId, attachmentId }` de um anexo textual autorizado
- **THEN** o servidor lê o conteúdo pela rota autorizada e retorna o texto extraído, o formato e os metadados de leitura

#### Scenario: Formato não suportado retorna declaração explícita

- **WHEN** o agente lê um anexo cujo formato o sistema não interpreta
- **THEN** a ferramenta retorna `format: unsupported` com o motivo, sem texto e sem afirmar leitura

#### Scenario: Leitura não autorizada

- **WHEN** o agente invoca `read_attachment` para um anexo de projeto sem membership ou de outro tenant
- **THEN** o servidor retorna 403/404 normalizado sem conteúdo nem caminho físico

#### Scenario: Limite de leitura comunicado

- **WHEN** o conteúdo excede o teto de caracteres por chamada
- **THEN** a resposta MCP informa `truncated: true`, o motivo e `nextOffset`, permitindo uma leitura segmentada

#### Scenario: Catálogo e limites em sincronia

- **WHEN** `bun run test:mcp-catalog` é executado após a mudança
- **THEN** `read_attachment` está documentada no README gerado, com schema completo, `case` no dispatcher e limites coerentes com o catálogo
