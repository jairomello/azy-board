## ADDED Requirements

### Requirement: Ferramentas de links do item no catálogo

O catálogo compartilhado SHALL declarar as ferramentas `list_item_links`, `create_item_link`, `update_item_link` e `delete_item_link` como fonte única de campos, schema, validação, policy, classificação e descrição. `list_item_links` e `delete_item_link` SHALL exigir `projectId` e `itemId` (e `linkId` em delete); `create_item_link` SHALL exigir `name` e `url` e aceitar `description` opcional; `update_item_link` SHALL exigir `linkId` e pelo menos um de `name`/`url`/`description`. A validação SHALL aceitar apenas URL `http`/`https` sem credenciais embutidas, com nome ≤ 200, URL ≤ 2048 e descrição ≤ 20000, e SHALL rejeitar `linkId` vazio. As ferramentas SHALL ser classificadas como `domain: 'evidence'`, `scope: 'item'`, com operação `read`/`create`/`update`/`delete`, e `list_item_links` SHALL integrar o conjunto de descoberta. A documentação gerada SHALL listar as quatro ferramentas.

#### Scenario: Campos obrigatórios e opcionais declarados

- **WHEN** os schemas expostos das quatro ferramentas de link são inspecionados
- **THEN** a forma mínima exige exatamente `projectId`/`itemId` em `list_item_links` e `delete_item_link`, `projectId`/`itemId`/`name`/`url` em `create_item_link` e `projectId`/`itemId`/`linkId` em `update_item_link`, com `description`, `name` e `url` opcionais onde aplicável

#### Scenario: URL válida é aceita e inválida é rejeitada de forma acionável

- **WHEN** `create_item_link` recebe uma URL `http`/`https` sem usuário/senha
- **THEN** a validação aceita a chamada; quando a URL é inválida, usa outro esquema ou contém credenciais, a validação rejeita citando valor recebido e formato aceito, sem executar a mutação

#### Scenario: Edição sem nenhum campo é rejeitada

- **WHEN** `update_item_link` é chamado apenas com `projectId`, `itemId` e `linkId`
- **THEN** a validação rejeita exigindo ao menos um de `name`, `url` ou `description`

#### Scenario: `linkId` inválido é rejeitado

- **WHEN** `update_item_link` ou `delete_item_link` recebe `linkId` vazio ou não textual
- **THEN** a validação rejeita antes da execução

#### Scenario: Classificação e policy coerentes

- **WHEN** as quatro ferramentas são carregadas do registry
- **THEN** `list_item_links` é leitura com policy `read`, as demais são escrita com policy `write`, e todas têm domínio `evidence`, escopo `item` e operação correspondente

#### Scenario: Paridade entre schema, validação e dispatcher

- **WHEN** `bun test packages/tool-registry` e `bun run test:mcp-catalog` executam
- **THEN** schema exposto, validação, campos declarados, classificação e dispatcher concordam sobre as quatro ferramentas de link, e o README gerado as documenta
