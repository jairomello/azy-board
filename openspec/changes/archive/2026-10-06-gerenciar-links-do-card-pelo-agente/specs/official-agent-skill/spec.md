## ADDED Requirements

### Requirement: Documentação de gerenciamento de links

A skill oficial SHALL documentar como listar, criar, editar e remover links do item pelo agente, com exemplos mínimos de `list_item_links`, `create_item_link`, `update_item_link` e `delete_item_link`, incluindo os campos obrigatórios e que `name`/`url` identificam o link na confirmação. A skill SHALL orientar que a edição/remoção exige o `linkId` obtido pela listagem, de modo que o usuário não precise copiar IDs, e SHALL deixar explícito que cadastrar uma URL não implica ler nem acessar seu conteúdo. A skill canônica e o espelho `.opencode/skills/azyboard/` SHALL permanecer sincronizados.

#### Scenario: Exemplo mínimo de criação de link

- **WHEN** o agente consulta a skill sobre como adicionar um link ao card
- **THEN** encontra um exemplo de `create_item_link` com `projectId`, `itemId`, `name` e `url`, e a regra de confirmação do resultado

#### Scenario: Descoberta do link sem copiar IDs

- **WHEN** a skill descreve editar ou remover um link
- **THEN** orienta listar os links com `list_item_links` e usar o `linkId` correspondente ao nome/URL desejado

#### Scenario: Limite de conteúdo externo documentado

- **WHEN** a skill trata do cadastro de uma URL
- **THEN** informa que a ferramenta apenas persiste os metadados e não lê nem acessa o serviço externo

#### Scenario: Verificação de sincronização da skill

- **WHEN** `bun run test:agent-skill` executa após a mudança
- **THEN** a skill canônica e o espelho permanecem sincronizados e o verificador passa
