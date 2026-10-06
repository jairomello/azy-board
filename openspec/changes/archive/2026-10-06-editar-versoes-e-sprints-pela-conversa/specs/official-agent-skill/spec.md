## ADDED Requirements

### Requirement: Documentação de edição de sprint e versão na skill

A skill oficial SHALL documentar as ferramentas `update_sprint` e `update_version`, incluindo o formato `changes` com `{ field, operation, value }` e as operações `SET`/`CLEAR`, os campos permitidos por entidade e a exigência de perfil `ADMIN`. A skill SHALL apresentar exemplos mínimos (adiar o fim de uma sprint, marcar uma versão como liberada, limpar a data de lançamento) e SHALL informar que a edição não transiciona o status de sprint, que continua em `activate_sprint`/`close_sprint`.

#### Scenario: Exemplo de edição de sprint

- **WHEN** o agente consulta a skill sobre como adiar o fim de uma sprint
- **THEN** encontra um exemplo de `update_sprint` com `changes` e a observação de que o status não é alterado

#### Scenario: Exemplo de edição de versão

- **WHEN** o agente consulta a skill sobre como editar uma versão
- **THEN** encontra exemplos de `SET` (situação/data) e de `CLEAR` (remover data ou descrição) em `update_version`

#### Scenario: Criação de versão com campos completos documentada

- **WHEN** a skill descreve `create_version`
- **THEN** informa que, além de `name`, a ferramenta aceita `releaseDate`, `description` e `status`

#### Scenario: Verificação de sincronização da skill

- **WHEN** `bun run test:agent-skill` executa após a mudança
- **THEN** a skill canônica e o espelho permanecem sincronizados e o verificador passa
