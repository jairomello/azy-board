## ADDED Requirements

### Requirement: Espaçamento consistente entre campos
As modais de Task, Bug e Subtask SHALL usar espaçamento vertical consistente entre grupos de label e controle, incluindo Datas, História Pai e Tags.

#### Scenario: Fluxo de campos da Task
- **WHEN** usuário abre o accordion de campos de uma Task ou Bug
- **THEN** Autor, Pontos, Datas, História Pai e Tags aparecem separados por espaçamento visual uniforme

#### Scenario: História Pai e Tags
- **WHEN** usuário visualiza o trecho após as datas
- **THEN** História Pai e Tags não ficam colados aos campos superiores nem entre si, mantendo a mesma hierarquia dos demais grupos

### Requirement: Preservar comportamento do formulário
O ajuste visual SHALL preservar ordem, edição, validação, accordions, rich text, salvamento e cancelamento existentes.

#### Scenario: Salvamento sem regressão
- **WHEN** usuário edita campos após o ajuste de espaçamento e salva
- **THEN** o mesmo payload existente é enviado e os valores persistem normalmente

#### Scenario: Accordion e modal expandida
- **WHEN** usuário recolhe/expande a seção ou abre o editor rich text expandido
- **THEN** o espaçamento permanece correto e nenhum valor ou modal é perdido

### Requirement: Responsividade
O espaçamento SHALL permanecer legível sem criar overflow horizontal ou sobreposição em viewport móvel.

#### Scenario: Modal em tela estreita
- **WHEN** usuário abre uma Task em viewport móvel
- **THEN** labels e controles mantêm separação, a modal usa seu scroll interno e nenhum campo fica cortado horizontalmente
