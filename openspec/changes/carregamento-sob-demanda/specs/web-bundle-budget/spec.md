## ADDED Requirements

### Requirement: Visão Árvore do board carregada sob demanda

O web SHALL carregar o código da visão Árvore do board apenas quando essa visão for exibida, de modo que o chunk do board usado pelo Kanban e pelo Unificado não contenha a Árvore. O chunk da Árvore SHALL ter teto próprio no orçamento de bundle.

#### Scenario: Kanban e Unificado sem o código da Árvore

- **WHEN** o usuário abre o board na visão Kanban ou Unificado
- **THEN** o chunk do board carregado não inclui o código da visão Árvore

#### Scenario: Árvore carregada ao trocar de visão

- **WHEN** o usuário troca para a visão Árvore
- **THEN** o código da Árvore é carregado sob demanda, o canvas mostra um indicador de carregamento até ele chegar e, em seguida, a Árvore é exibida com o mesmo comportamento de antes

#### Scenario: Chunk da Árvore acima do teto

- **WHEN** o chunk da visão Árvore ultrapassa o teto definido para ele
- **THEN** a verificação de orçamento falha e informa o chunk, o limite e o valor medido

### Requirement: Diálogos das Configurações carregados sob demanda

O web SHALL carregar o diálogo de membro (adicionar e editar) e o detalhe da versão das Configurações do projeto apenas quando forem abertos, de modo que o chunk das Configurações não os contenha. Cada um SHALL ter teto próprio no orçamento de bundle.

#### Scenario: Configurações sem os diálogos

- **WHEN** o usuário abre as Configurações do projeto
- **THEN** o chunk das Configurações carregado não inclui o código do diálogo de membro nem do detalhe da versão

#### Scenario: Diálogo baixado ao abrir

- **WHEN** o usuário clica em adicionar ou editar membro, ou abre o detalhe de uma versão
- **THEN** o código do diálogo é carregado sob demanda e o diálogo abre com o mesmo comportamento de antes
