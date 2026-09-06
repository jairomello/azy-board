## Purpose

Definir a interação, o estado e os resumos dos accordions nas modais de detalhe.

## Requirements

### Requirement: Seções em accordion
As modais de detalhe e criação de Épico, História, Task, Bug e Subtask SHALL organizar seus grupos de campos em seções de accordion recolhíveis.

#### Scenario: Modal inicia focada
- **WHEN** usuário abre uma modal de item
- **THEN** a primeira seção inicia expandida e as demais iniciam recolhidas

#### Scenario: Alternar seção
- **WHEN** usuário ativa o cabeçalho de uma seção
- **THEN** somente o estado daquela seção é alternado e os valores editados permanecem intactos

### Requirement: Controle global de accordions
Cada formulário SHALL oferecer ações "Expandir tudo" e "Recolher tudo" para controlar suas seções.

#### Scenario: Expandir tudo
- **WHEN** usuário ativa "Expandir tudo"
- **THEN** todas as seções disponíveis da modal ficam abertas

#### Scenario: Recolher tudo
- **WHEN** usuário ativa "Recolher tudo"
- **THEN** todas as seções ficam fechadas sem perder dados digitados

### Requirement: Resumo de seção
Cada cabeçalho de accordion SHALL exibir um resumo curto quando houver informação útil, incluindo progresso de checklists com contagem e barra visual.

#### Scenario: Checklist com progresso
- **WHEN** um checklist possui itens concluídos e pendentes
- **THEN** sua seção exibe `X/Y concluídos` e uma barra de progresso, além do título

#### Scenario: Seção sem conteúdo
- **WHEN** uma seção não possui dados opcionais preenchidos
- **THEN** ela permanece disponível com título e resumo neutro, sem inventar conteúdo

### Requirement: Acessibilidade e modais empilhadas
Os accordions SHALL ser acessíveis por teclado e não SHALL quebrar a pilha de modais ou a edição rich text expandida.

#### Scenario: Navegação por teclado
- **WHEN** usuário navega até o cabeçalho com teclado
- **THEN** o trigger possui foco visível, `aria-expanded`, `aria-controls` e pode ser aberto com Enter ou Espaço

#### Scenario: Subtask e editor expandido
- **WHEN** usuário abre uma Subtask ou expande um campo rich text dentro de uma modal
- **THEN** a nova modal fica sobre a anterior; ao fechar, o usuário retorna à modal anterior com os valores preservados

### Requirement: Tradução e responsividade
Os títulos, controles, resumos e estados dos accordions SHALL respeitar PT-BR, EN e ES e permanecer utilizáveis em telas estreitas.

#### Scenario: Idioma ativo
- **WHEN** usuário troca o idioma da interface
- **THEN** controles e textos do accordion aparecem no idioma selecionado

#### Scenario: Tela pequena
- **WHEN** a modal é aberta em viewport móvel
- **THEN** os cabeçalhos continuam acionáveis, os resumos não quebram o formulário e o conteúdo usa o scroll interno existente
