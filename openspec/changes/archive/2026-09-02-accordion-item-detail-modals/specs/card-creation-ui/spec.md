## MODIFIED Requirements

### Requirement: Botões de criação na toolbar com Módulo incluído
O sistema SHALL exibir botões de criação de Módulo, Épico, História, Task e Bug na toolbar com labels encurtadas (`+ Módulo`, `+ Épico`, `+ História`, `+ Task`, `+ Bug`), mantendo cores e ícones identificadores de cada tipo. Os formulários de Épico e História SHALL usar accordions nas seções extensas, com primeira seção aberta e controles globais de expansão/recolhimento.

#### Scenario: Funcionalidade de criação preservada com accordions
- **WHEN** o usuário clica em qualquer botão de criação da toolbar
- **THEN** o modal correspondente é aberto com os campos existentes, e Épico/História exibem o padrão de accordion quando houver mais de uma seção

#### Scenario: Cancelar criação em seção recolhida
- **WHEN** usuário recolhe ou expande seções e cancela o formulário
- **THEN** nenhuma entidade é criada e nenhum valor é persistido
