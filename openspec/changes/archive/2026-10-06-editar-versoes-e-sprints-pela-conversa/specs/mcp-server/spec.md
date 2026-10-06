## ADDED Requirements

### Requirement: Ferramentas MCP de edição de sprint e versão

O servidor MCP SHALL expor as ferramentas `update_sprint` e `update_version`, traduzindo `changes` para o corpo plano das rotas `PATCH /projects/:id/sprints/:sprintId` e `PATCH /projects/:id/versions/:versionId`. Em `update_version`, a operação `CLEAR` SHALL ser traduzida para `null` no campo correspondente. As ferramentas SHALL reutilizar o mesmo catálogo, validação e policy das demais, exigindo `ADMIN`, e SHALL repassar erros normalizados da API sem conversão semântica própria. As edições SHALL emitir os mesmos eventos de atualização das rotas, de modo que a tela reflita a mudança em tempo real.

#### Scenario: Editar datas de sprint pela ferramenta

- **WHEN** agente invoca `update_sprint` com `{ projectId, sprintId, changes: [{ field: "endDate", operation: "SET", value: "2026-11-14" }] }`
- **THEN** a rota de edição é chamada com `endDate` atualizado, o status e os ciclos da sprint são preservados e o evento de atualização é emitido

#### Scenario: Marcar versão como liberada

- **WHEN** agente invoca `update_version` com `{ projectId, versionId, changes: [{ field: "status", operation: "SET", value: "RELEASED" }] }`
- **THEN** a versão passa a `RELEASED` via API e a resposta permite confirmar o novo estado

#### Scenario: Limpar data de lançamento da versão

- **WHEN** agente invoca `update_version` com `changes` contendo `{ field: "releaseDate", operation: "CLEAR" }`
- **THEN** o executor envia `releaseDate: null` à API e a versão fica sem data de lançamento

#### Scenario: Edição inválida não persiste

- **WHEN** a API rejeita a edição por data de sprint invertida ou recurso inexistente
- **THEN** o servidor retorna o erro normalizado correspondente e nenhuma alteração é persistida

#### Scenario: Paridade schema-validator-executor

- **WHEN** o gate de paridade do catálogo monta o payload mínimo de `update_sprint` e `update_version`
- **THEN** a validação aceita o payload e o schema expõe exatamente os campos exigidos

### Requirement: Criação de versão com campos completos via MCP

A ferramenta `create_version` SHALL repassar à API os campos opcionais `releaseDate`, `description` e `status` quando informados, mantendo `name` obrigatório e o comportamento anterior quando apenas `name` é enviado.

#### Scenario: Criar versão com data e situação

- **WHEN** agente invoca `create_version` com `{ projectId, name: "v1.0.0", releaseDate: "2026-12-01", status: "IN_DEV" }`
- **THEN** a API cria a versão com os campos informados e a resposta permite confirmar nome e situação

#### Scenario: Criar versão só com nome

- **WHEN** agente invoca `create_version` com `{ projectId, name: "v1.0.0" }`
- **THEN** a versão é criada com os defaults da API, como antes
