## MODIFIED Requirements

### Requirement: Criar projeto
O sistema SHALL permitir que um usuário autenticado crie um novo projeto informando nome, descrição opcional, modo de board opcional (`HIERARCHICAL` ou `SIMPLE`), os sinalizadores opcionais de visibilidade `isRestricted` e `isHidden`, e os campos opcionais de planejamento `startDate`, `plannedEndDate`, `plannedPoints`, `plannedHours` e `scope`. Quando o modo não for informado, SHALL usar `HIERARCHICAL`. Quando os sinalizadores de visibilidade não forem informados, SHALL usar `false` para ambos. Quando os campos de planejamento não forem informados, SHALL persisti-los como `null`.

#### Scenario: Criação bem-sucedida com colunas padrão
- **WHEN** usuário envia nome do projeto
- **THEN** sistema cria o projeto, associa o criador como administrador, cria o módulo padrão "Geral" e provisiona automaticamente 6 colunas em ordem de fluxo: Backlog (NOT_STARTED), A Fazer (NOT_STARTED), Fazendo (IN_PROGRESS), A Testar (IN_PROGRESS), Testando (IN_PROGRESS), Concluídas (DONE)

#### Scenario: Criação de projeto simples
- **WHEN** usuário envia nome do projeto com `boardMode = SIMPLE`
- **THEN** sistema cria o projeto com uma STORY fixa, sem criar módulo ou EPIC para a apresentação do board, associa o criador como administrador e provisiona as 6 colunas padrão

#### Scenario: Board simples pronto para uso imediato
- **WHEN** usuário acessa um projeto simples recém-criado
- **THEN** a STORY fixa e as 6 colunas padrão estão presentes e o board aceita criação e movimentação de TASKs/BUGs

#### Scenario: Board pronto para uso imediato
- **WHEN** usuário acessa o board de um projeto recém-criado
- **THEN** as 6 colunas padrão já estão presentes e o board aceita criação de cards sem configuração adicional

#### Scenario: Nome duplicado no mesmo workspace
- **WHEN** usuário tenta criar projeto com nome já existente no workspace
- **THEN** sistema retorna erro 409 com mensagem indicando duplicidade

#### Scenario: Projeto criado sem sinalizadores de visibilidade
- **WHEN** usuário cria projeto sem informar `isRestricted` nem `isHidden`
- **THEN** sistema persiste ambos como `false` e os devolve na resposta

#### Scenario: Projeto criado restrito
- **WHEN** usuário cria projeto informando `isRestricted = true`
- **THEN** sistema persiste o projeto como restrito e o criador, por ser membro, continua visualizando-o na listagem

#### Scenario: Projeto criado com campos de planejamento
- **WHEN** usuário cria projeto informando `startDate`, `plannedEndDate`, `plannedPoints`, `plannedHours` e/ou `scope`
- **THEN** sistema persiste os campos de planejamento informados e os retorna na resposta
