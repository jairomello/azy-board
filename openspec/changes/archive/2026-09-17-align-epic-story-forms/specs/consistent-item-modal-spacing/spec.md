## MODIFIED Requirements

### Requirement: Espaçamento consistente entre campos
As modais de Task, Bug, Subtask, Épico e História SHALL usar espaçamento vertical consistente entre grupos de label e controle, incluindo o painel de propriedades e os campos de relacionamento (Datas, História Pai, Tags, Módulo, Épico pai e Versão).

#### Scenario: Fluxo de campos da Task
- **WHEN** usuário abre a área de campos de uma Task ou Bug
- **THEN** Autor, Pontos, Datas, História Pai e Tags aparecem separados por espaçamento visual uniforme

#### Scenario: História Pai e Tags
- **WHEN** usuário visualiza o trecho após as datas
- **THEN** História Pai e Tags não ficam colados aos campos superiores nem entre si, mantendo a mesma hierarquia dos demais grupos

#### Scenario: Painel de propriedades de Épico e História
- **WHEN** usuário abre o painel de propriedades de um Épico ou de uma História
- **THEN** Módulo ou Épico pai, Versão e Código seguem os mesmos agrupamentos e espaçamentos usados pelas demais modais de item

#### Scenario: Áreas e conteúdo rico
- **WHEN** usuário alterna entre Detalhes, Subtasks, Checklists e Histórico de um Épico ou História
- **THEN** os blocos de conteúdo mantêm separação uniforme e nenhum valor ou modal é perdido
