# board-card-search Specification

## Purpose
TBD - created by archiving change busca-cards-board. Update Purpose after archive.

## Requirements

### Requirement: Campo de busca no header do board

O sistema SHALL exibir um campo de busca no topo direito do header do board, disponível nas visualizações `Board`, `Unificado` e `Árvore`. O campo SHALL ter rótulo acessível, placeholder que descreva os campos pesquisáveis, ação de limpar quando houver consulta e atalho `Ctrl/Cmd+K` para receber foco. Em telas pequenas, um botão de busca no header SHALL abrir o mesmo campo em um painel sobre o conteúdo.

#### Scenario: Campo visível nas três visões

- **WHEN** a pessoa abre o Board, o Unificado ou a Árvore
- **THEN** o campo de busca está disponível no topo direito do header

#### Scenario: Consulta preservada ao trocar de visão

- **WHEN** a pessoa digita uma consulta e alterna entre Board, Unificado e Árvore
- **THEN** o termo permanece no campo e o recorte correspondente é aplicado na nova visão

#### Scenario: Atalho de teclado

- **WHEN** a pessoa pressiona `Ctrl+K` ou `Cmd+K` sem uma modal aberta
- **THEN** o campo de busca recebe foco e o texto existente fica selecionado

#### Scenario: Versão mobile

- **WHEN** a viewport é menor que o breakpoint de desktop
- **THEN** um botão de busca no header abre o campo e os resultados em um painel sobre o conteúdo

---

### Requirement: Busca local sem nova requisição

A busca SHALL ser aplicada no cliente sobre os itens já carregados do projeto. Digitar ou alterar a consulta SHALL NOT disparar nova consulta de itens.

#### Scenario: Sem requisição ao digitar

- **WHEN** a pessoa digita ou altera a consulta
- **THEN** o recorte e os resultados são recalculados a partir dos itens já carregados, sem nova consulta de itens

---

### Requirement: Correspondência por título e responsável

A busca SHALL considerar o título e o responsável (usuário atribuído ou label externo), ignorando acentos e diferenças de maiúsculas/minúsculas. Consultas com múltiplos termos SHALL exigir todos os termos (AND), podendo cada termo aparecer em um campo diferente.

#### Scenario: Busca por título sem acento e sem caixa

- **WHEN** a pessoa digita `acao` ou `ACAO`
- **THEN** cards com “Ação” no título são encontrados

#### Scenario: Busca por responsável

- **WHEN** a pessoa digita o nome do responsável ou o label de um responsável externo
- **THEN** os cards atribuídos a esse responsável são encontrados

#### Scenario: Múltiplos termos

- **WHEN** a pessoa digita `busca cards`
- **THEN** são encontrados cards cujo título, código ou responsável contenham ambos os termos

---

### Requirement: Correspondência por código sequencial

A busca SHALL considerar o `sequenceCode` do item, aceitando igualdade ou prefixo e `#`/espaços (`#T92`, `T 92`). O código exato SHALL ter prioridade sobre prefixos.

#### Scenario: Busca por código exato e por prefixo

- **WHEN** a pessoa digita `T92`
- **THEN** o card T92 é encontrado
- **AND** quando digita `T9`, cards T9, T90 e T91 podem ser encontrados, com o código exato primeiro

---

### Requirement: Escopo de tipos e itens arquivados

A busca SHALL considerar TASK e BUG, inclusive subtasks, e SHALL excluir itens arquivados.

#### Scenario: Subtask encontrada com “Mostrar subtasks” desligado

- **WHEN** a pessoa busca o título de uma subtask com a preferência de subtasks desligada
- **THEN** a subtask é encontrada e pode ser aberta

#### Scenario: Item arquivado fora da busca

- **WHEN** um card está arquivado e a pessoa busca seu título
- **THEN** o card não aparece nos resultados da busca

---

### Requirement: Recorte combinado com filtros ativos

A busca SHALL compor o recorte do Board e do Unificado por AND com os filtros ativos, sem alterar o estado desses filtros. Épicos, módulos e histórias sem card visível SHALL ser ocultados e ramos recolhidos SHALL ser expandidos enquanto a busca estiver ativa. Abas de módulo SHALL NOT esconder resultados de outro módulo.

#### Scenario: Busca combinada com filtro de status

- **WHEN** o filtro de status “Em andamento” está ativo e a pessoa busca `busca`
- **THEN** apenas cards em andamento que também casam com a busca são exibidos

#### Scenario: Card em lane recolhida

- **WHEN** a busca encontra um card em um épico, módulo ou história recolhida
- **THEN** o ramo é expandido temporariamente para exibir o resultado

#### Scenario: Resultado em outro módulo com abas ativas

- **WHEN** o modo de módulos em abas está ativo e a busca encontra um card em outro módulo
- **THEN** as abas não escondem o resultado enquanto a busca estiver ativa

---

### Requirement: Busca na Árvore preserva ancestrais

Na Árvore, a busca SHALL filtrar a grade mantendo os ancestrais dos TASK/BUG encontrados e abrindo os ramos com resultado. Ramos sem card encontrado SHALL NOT ser exibidos.

#### Scenario: Árvore mantém ancestrais

- **WHEN** a busca encontra um TASK/BUG na Árvore
- **THEN** a grade exibe o card e os ancestrais necessários para chegar até ele
- **AND** ramos sem nenhum card encontrado não são exibidos

---

### Requirement: Limpar a busca restaura a visão filtrada

Limpar a busca SHALL restaurar a visão filtrada anterior sem alterar os filtros ativos.

#### Scenario: Limpar a busca restaura a visão filtrada

- **WHEN** a pessoa limpa a busca
- **THEN** a visão volta a exibir exatamente o recorte dos filtros ativos, sem que os filtros sejam alterados

---

### Requirement: Resultados navegáveis e abertura do card

O sistema SHALL exibir até oito resultados ordenados por relevância em um dropdown, com código, título, status, responsável e breadcrumb. Selecionar um resultado SHALL abrir o detalhe do card, inclusive quando ele estiver fora do recorte visível ou em um ramo recolhido. A navegação por setas SHALL mover a seleção ativa, `Enter` SHALL abrir o resultado ativo e `Escape` SHALL fechar o dropdown sem apagar a consulta. A abertura SHALL usar o fluxo existente de detalhe do card, sem novo endpoint.

#### Scenario: Abrir resultado com clique

- **WHEN** a pessoa clica em um resultado
- **THEN** o detalhe do card é aberto

#### Scenario: Abrir resultado com Enter

- **WHEN** a pessoa navega até um resultado com as setas e pressiona `Enter`
- **THEN** o detalhe do card ativo é aberto

#### Scenario: Resultado fora do recorte visível

- **WHEN** a pessoa seleciona um resultado que não está visível no board por causa de filtros, lane recolhida ou preferência de subtasks
- **THEN** o detalhe do card é aberto mesmo assim

#### Scenario: Fechar sem apagar a consulta

- **WHEN** a pessoa pressiona `Escape` com o dropdown aberto
- **THEN** o dropdown fecha e a consulta permanece no campo

---

### Requirement: Independência entre busca e filtros

A busca SHALL NOT fazer parte do estado persistido de filtros, SHALL NOT contar no indicador de filtros ativos e SHALL NOT ser limpa pela ação “Limpar filtros”. Limpar os filtros SHALL preservar a consulta e seu recorte.

#### Scenario: Limpar filtros preserva a busca

- **WHEN** a pessoa aciona “Limpar filtros” com uma busca ativa
- **THEN** os filtros são removidos, a consulta permanece e o recorte da busca continua aplicado

#### Scenario: Busca não conta como filtro ativo

- **WHEN** a pessoa digita uma consulta sem nenhum filtro ativo
- **THEN** o indicador de filtros ativos continua sem contagem

---

### Requirement: Estados vazios, carregamento e limpeza

O sistema SHALL exibir um estado vazio explícito com a consulta e uma ação de limpar quando a busca não encontrar cards. Enquanto os itens do projeto estiverem carregando, o dropdown SHALL indicar carregamento em vez de afirmar que não há resultados. A ação de limpar SHALL apagar a consulta, fechar o dropdown e restaurar a visão filtrada.

#### Scenario: Nenhum resultado

- **WHEN** a pessoa busca um termo sem correspondência
- **THEN** o sistema exibe “Nenhum card encontrado” com o termo pesquisado e a ação de limpar

#### Scenario: Carregamento

- **WHEN** a base do projeto ainda não terminou de carregar e a pessoa digita
- **THEN** o dropdown mostra o estado de carregamento, não o estado vazio

#### Scenario: Limpar pelo campo

- **WHEN** a pessoa aciona o botão de limpar do campo
- **THEN** a consulta é apagada, o dropdown fecha e a visão filtrada é restaurada

---

### Requirement: Acessibilidade do combobox

O campo SHALL seguir o padrão combobox/listbox: `aria-expanded`, `aria-controls`, `aria-activedescendant`, `aria-autocomplete`, opções com `role="option"` e `aria-selected`, além de anúncio da quantidade de resultados ou do estado vazio via região viva. O foco SHALL permanecer no campo durante a navegação por setas.

#### Scenario: Atributos do combobox

- **WHEN** a consulta tem resultados e o dropdown está aberto
- **THEN** o campo expõe `aria-expanded="true"`, aponta para o listbox e para a opção ativa

#### Scenario: Navegação mantém o foco

- **WHEN** a pessoa usa as setas para percorrer resultados
- **THEN** o foco continua no campo e a opção ativa é atualizada por `aria-activedescendant`

#### Scenario: Contagem anunciada

- **WHEN** os resultados são atualizados
- **THEN** a quantidade de resultados ou o estado vazio é anunciado em uma região viva
