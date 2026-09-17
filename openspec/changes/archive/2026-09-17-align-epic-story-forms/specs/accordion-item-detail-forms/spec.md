## MODIFIED Requirements

### Requirement: Acessibilidade e modais empilhadas
As áreas das modais de detalhe SHALL ser acessíveis por teclado e não SHALL quebrar a pilha de modais ou a edição rich text expandida.

#### Scenario: Navegação por teclado
- **WHEN** usuário navega até a navegação de áreas com teclado
- **THEN** cada área possui foco visível, `aria-selected`, `aria-controls` e pode ser ativada com Enter ou Espaço

#### Scenario: Subtask e editor expandido
- **WHEN** usuário abre uma Subtask ou expande um campo rich text dentro de uma modal
- **THEN** a nova modal fica sobre a anterior; ao fechar, o usuário retorna à modal anterior com os valores preservados

### Requirement: Tradução e responsividade
Os títulos, controles, resumos e estados das áreas SHALL respeitar PT-BR, EN e ES e permanecer utilizáveis em telas estreitas.

#### Scenario: Idioma ativo
- **WHEN** usuário troca o idioma da interface
- **THEN** controles e textos das áreas aparecem no idioma selecionado

#### Scenario: Tela pequena
- **WHEN** a modal é aberta em viewport móvel
- **THEN** a navegação de áreas continua acionável, os resumos não quebram o formulário e o conteúdo usa o scroll interno existente

## ADDED Requirements

### Requirement: Organização por áreas nas modais de detalhe
As modais de detalhe e criação de Épico, História, Task, Bug e Subtask SHALL organizar seus grupos de campos em áreas navegáveis, com uma área inicial, em vez de accordions recolhíveis.

#### Scenario: Modal inicia na primeira área
- **WHEN** usuário abre uma modal de item
- **THEN** a área Detalhes inicia ativa e as demais áreas ficam acessíveis pela navegação, sem estado expandido/recolhido por seção

#### Scenario: Alternar área
- **WHEN** usuário ativa outra área na navegação
- **THEN** somente a área selecionada é exibida e os valores editados nas demais permanecem intactos

### Requirement: Resumo e contagem por área
Cada área SHALL exibir contagem ou resumo curto quando houver informação útil, incluindo progresso de checklists com contagem.

#### Scenario: Área com contagem
- **WHEN** um item possui subtasks, checklists ou eventos de histórico
- **THEN** a navegação exibe a contagem correspondente na área, sem inventar conteúdo quando não houver dados

#### Scenario: Área sem conteúdo
- **WHEN** uma área não possui dados
- **THEN** a área permanece disponível e mostra um estado vazio explícito

## REMOVED Requirements

### Requirement: Seções em accordion
**Reason**: As modais de Task, Bug e Subtask já foram migradas para navegação por áreas e as de Épico e História passam a usar o mesmo padrão; accordions recolhíveis deixam de ser o modelo de organização desses formulários.
**Migration**: Usar a navegação por áreas definida em "Organização por áreas nas modais de detalhe" e os resumos definidos em "Resumo e contagem por área". Os componentes `AccordionSection`/`AccordionToolbar` deixam de ser obrigatórios nas modais de item.

### Requirement: Controle global de accordions
**Reason**: A navegação por áreas não possui seções recolhíveis, portanto as ações "Expandir tudo" e "Recolher tudo" não se aplicam aos formulários de item.
**Migration**: Nenhuma ação equivalente é necessária; cada área é acessada diretamente pela navegação.

### Requirement: Resumo de seção
**Reason**: Substituído pelo resumo e contagem por área.
**Migration**: Usar "Resumo e contagem por área" para exibir contagens e progresso na navegação.
