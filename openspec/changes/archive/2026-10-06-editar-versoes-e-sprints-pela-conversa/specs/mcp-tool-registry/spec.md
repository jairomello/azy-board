## ADDED Requirements

### Requirement: Descritores de edição de sprint e versão no catálogo

O catálogo compartilhado SHALL declarar as ferramentas `update_sprint` e `update_version` como fonte única de campos, schema, validação, routing, classificação e policy. Cada uma SHALL receber `projectId`, o identificador da entidade (`sprintId`/`versionId`) e `changes`, um array de alterações `{ field, operation, value }` com operação `SET` ou `CLEAR`. O schema de `changes` SHALL ser próprio de cada ferramenta: `update_sprint` aceita `name`, `startDate` e `endDate`; `update_version` aceita `name`, `releaseDate`, `description` e `status`. A classificação SHALL ser domínio `planning`, escopo `project`, operação `update` e a policy `ADMIN`, coerente com as rotas de edição. A validação SHALL rejeitar `changes` vazio, `operation` desconhecida, `CLEAR` em campo não anulável e `status` fora do enum, sem persistência parcial.

#### Scenario: Ferramenta de edição exposta com forma mínima

- **WHEN** o schema exposto de `update_sprint` ou `update_version` é inspecionado
- **THEN** `projectId`, o identificador da entidade e `changes` aparecem como obrigatórios, e cada item de `changes` exige `field` e `operation`

#### Scenario: Campos permitidos por ferramenta

- **WHEN** `update_version` recebe `changes` com `field` igual a `releaseDate` e `update_sprint` recebe `field` igual a `endDate`
- **THEN** a validação aceita as alterações e o schema declarado reflete exatamente esses campos por ferramenta

#### Scenario: CLEAR em campo não anulável é rejeitado

- **WHEN** `update_sprint` recebe `changes` com `operation: CLEAR` para `name`, `startDate` ou `endDate`
- **THEN** a validação rejeita com erro acionável citando o campo e a operação aceita, sem alterar a sprint

#### Scenario: Alteração vazia é rejeitada

- **WHEN** `update_sprint` ou `update_version` é chamada com `changes` vazio
- **THEN** a validação rejeita a chamada informando a forma mínima aceita, sem executar a edição

#### Scenario: Paridade entre schema, validação e executor

- **WHEN** `bun test packages/tool-registry` e `bun run test:mcp-catalog` executam
- **THEN** schema exposto, validação, campos declarados e dispatcher concordam sobre `update_sprint` e `update_version`

### Requirement: Criação de versão com campos completos no catálogo

O descritor de `create_version` SHALL aceitar, além de `name` obrigatório, os campos opcionais `releaseDate`, `description` e `status`, alinhado ao que `POST /projects/:id/versions` já aceita. `status` SHALL ser restrito ao enum `PLANNED`, `IN_DEV`, `RELEASED` e `CANCELLED`. A criação informando apenas `name` SHALL continuar válida e inalterada.

#### Scenario: Campos opcionais de criação expostos

- **WHEN** o schema exposto de `create_version` é inspecionado
- **THEN** `releaseDate`, `description` e `status` aparecem como opcionais e a forma mínima continua exigindo apenas `projectId` e `name`

#### Scenario: Criação só com nome permanece válida

- **WHEN** `create_version` é chamada apenas com `projectId` e `name`
- **THEN** a validação aceita a chamada e a versão é criada com os defaults da API
