## MODIFIED Requirements

### Requirement: Botões de criação na toolbar com Módulo incluído
O sistema SHALL exibir botões de criação de Módulo, Épico, História, Task e Bug na toolbar com labels encurtadas (`+ Módulo`, `+ Épico`, `+ História`, `+ Task`, `+ Bug`), mantendo cores e ícones identificadores de cada tipo.

#### Scenario: Botão de criação de Módulo com label compacta
- **WHEN** a toolbar do board é renderizada
- **THEN** o primeiro botão de criação exibe label `+ Módulo` com ícone de módulo/pacote

#### Scenario: Funcionalidade de criação de Módulo preservada
- **WHEN** o usuário clica no botão `+ Módulo` da toolbar
- **THEN** a modal de criação de módulo é aberta com campos Nome e Descrição

#### Scenario: Botão de criação com label compacta para demais tipos
- **WHEN** a toolbar do board é renderizada
- **THEN** os botões de criação exibem labels no formato `+ Tipo` (ex.: `+ Épico`, `+ História`, `+ Task`, `+ Bug`) em vez do formato anterior `Novo Épico`, `Nova Task`

#### Scenario: Funcionalidade de criação preservada para demais tipos
- **WHEN** o usuário clica em qualquer botão de criação da toolbar (exceto Módulo)
- **THEN** o modal de criação do tipo correspondente é aberto, com o mesmo comportamento anterior
