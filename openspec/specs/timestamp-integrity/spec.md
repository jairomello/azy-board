# timestamp-integrity Specification

## Purpose
TBD - created by archiving change fix-timestamp-defaults. Update Purpose after archive.
## Requirements
### Requirement: Defaults temporais são avaliados por inserção

O sistema SHALL avaliar defaults de `created_at` e `updated_at` no momento de cada inserção, nunca no carregamento do módulo ou na geração do schema.

#### Scenario: Inserções separadas recebem instantes atuais

- **WHEN** duas linhas são inseridas em momentos distintos omitindo uma coluna temporal com default
- **THEN** cada linha recebe um timestamp correspondente ao seu próprio momento de inserção, sem reutilizar um literal criado durante o build ou carregamento do processo

#### Scenario: Inserção SQL direta usa default dinâmico

- **WHEN** um script insere uma linha diretamente no SQLite sem informar uma coluna temporal com default
- **THEN** o banco preenche a coluna com o instante atual no formato UTC ISO adotado pelo sistema

### Requirement: Defaults temporais mantêm o formato do sistema

O sistema SHALL armazenar novos timestamps default em UTC no formato ISO compatível com os timestamps atuais, incluindo separador `T`, fração de segundo e sufixo `Z`.

#### Scenario: Novo registro mantém formato ISO UTC

- **WHEN** uma entidade é criada sem informar seu `created_at` defaultado
- **THEN** o valor persistido corresponde ao formato `YYYY-MM-DDTHH:MM:SS.SSSZ` e pode ser consumido pelas ordenações, analytics e respostas existentes

#### Scenario: Timestamps históricos são preservados

- **WHEN** a migration de correção é aplicada a uma base já populada
- **THEN** os valores temporais existentes permanecem inalterados e somente o default usado por novas linhas é substituído

### Requirement: Migration preserva integridade do schema

A migration SHALL corrigir os defaults físicos das tabelas afetadas sem remover FKs, índices, unicidades, checks ou dados válidos existentes.

#### Scenario: Migration é aplicada a uma base populada

- **WHEN** a migration é executada sobre uma base com dados e constraints da migration 0021
- **THEN** as contagens e valores existentes são preservados, as constraints continuam ativas e `PRAGMA foreign_key_check` não reporta violações

#### Scenario: Migration é reaplicada pelo fluxo de migrations

- **WHEN** o processo de migrations é executado novamente após a correção já estar registrada
- **THEN** nenhuma tabela é reconstruída novamente e a execução termina sem erro ou alteração adicional

### Requirement: Colunas sem default continuam explícitas

O sistema MUST continuar rejeitando inserções que omitam timestamps definidos como obrigatórios sem default, preservando a distinção entre defaults automáticos e campos preenchidos pelo caso de uso.

#### Scenario: Timestamp obrigatório sem default é omitido

- **WHEN** uma inserção direta omite uma coluna temporal `NOT NULL` que não possui default
- **THEN** o banco rejeita a inserção em vez de inventar um valor silenciosamente

