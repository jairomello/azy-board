## MODIFIED Requirements

### Requirement: Criar projeto
O sistema SHALL permitir que um usuário autenticado crie um novo projeto informando nome, descrição opcional e modo de board opcional (`HIERARCHICAL` ou `SIMPLE`). Quando o modo não for informado, SHALL usar `HIERARCHICAL`.

#### Scenario: Criação hierárquica por padrão
- **WHEN** usuário envia nome do projeto sem informar o modo
- **THEN** sistema cria o projeto com `boardMode = HIERARCHICAL`, associa o criador como administrador, cria o módulo padrão "Geral" e provisiona automaticamente 6 colunas em ordem de fluxo: Backlog (NOT_STARTED), A Fazer (NOT_STARTED), Fazendo (IN_PROGRESS), A Testar (IN_PROGRESS), Testando (IN_PROGRESS), Concluídas (DONE)

#### Scenario: Criação de projeto simples
- **WHEN** usuário envia nome do projeto com `boardMode = SIMPLE`
- **THEN** sistema cria o projeto com uma STORY fixa, sem criar módulo ou EPIC para a apresentação do board, associa o criador como administrador e provisiona automaticamente as 6 colunas padrão

#### Scenario: Board simples pronto para uso imediato
- **WHEN** usuário acessa um projeto simples recém-criado
- **THEN** a STORY fixa e as 6 colunas padrão estão presentes, e o board aceita criação e movimentação de TASKs/BUGs sem configuração adicional

#### Scenario: Nome duplicado no mesmo workspace
- **WHEN** usuário tenta criar projeto com nome já existente no workspace
- **THEN** sistema retorna erro 409 com mensagem indicando duplicidade

### Requirement: Configurar modo do board nas configurações
O sistema SHALL permitir que um usuário ADMIN altere o modo do board nas configurações do projeto, exibindo o modo atual e uma confirmação específica quando a conversão remover a estrutura de módulos e EPICs.

#### Scenario: ADMIN visualiza o modo atual
- **WHEN** ADMIN acessa as configurações do projeto
- **THEN** sistema exibe o modo atual (`HIERARCHICAL` ou `SIMPLE`) e a opção de alterá-lo

#### Scenario: MEMBER ou VIEWER não altera o modo
- **WHEN** MEMBER ou VIEWER acessa as configurações
- **THEN** sistema exibe o modo atual sem permitir sua alteração
