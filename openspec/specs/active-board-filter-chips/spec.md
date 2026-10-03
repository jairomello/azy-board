## Purpose

Definir a visualização e a remoção individual dos filtros ativos no Board.
## Requirements
### Requirement: Exibir filtros ativos
O Board SHALL exibir uma linha de tags compactas entre a barra de controles e o conteúdo do Board quando houver filtros ativos que alterem a visualização.

#### Scenario: Nenhum filtro ativo
- **WHEN** todos os filtros estão no estado padrão
- **THEN** a linha de filtros ativos não é renderizada e o espaçamento/visual do Board permanece como antes

#### Scenario: Filtros ativos
- **WHEN** um ou mais filtros de conteúdo estão aplicados
- **THEN** a linha exibe uma tag para cada filtro ativo com nome legível e indicação do valor vigente

### Requirement: Remover filtro individual
Cada tag SHALL ter um botão acessível para remover somente o filtro representado, sem limpar filtros ou opções restantes.

#### Scenario: Remover uma tag
- **WHEN** usuário ativa o botão `x` de uma tag
- **THEN** somente o filtro daquela tag é limpo, o Board é recalculado e as demais tags continuam visíveis

#### Scenario: Remover último filtro
- **WHEN** usuário remove a última tag ativa
- **THEN** a linha desaparece e o Board retorna ao estado sem filtros

### Requirement: Catálogos, persistência e idiomas
As tags SHALL usar nomes dos catálogos disponíveis, refletir a persistência por projeto e possuir textos traduzidos em PT-BR, EN e ES.

#### Scenario: Filtro de catálogo
- **WHEN** usuário filtra por módulo, sprint, versão, squad, responsável, autor, tag ou centro de custo
- **THEN** a tag mostra o nome legível do catálogo e a remoção limpa apenas esse valor

#### Scenario: Remoção persistida
- **WHEN** usuário remove uma tag e sai do projeto
- **THEN** ao retornar o filtro removido continua limpo e os demais filtros são restaurados

#### Scenario: Navegação por teclado
- **WHEN** usuário navega pela linha usando teclado
- **THEN** cada botão `x` possui foco visível e rótulo acessível com filtro e valor que serão removidos

### Requirement: Chip para filtro por valor vazio
A linha de filtros ativos SHALL exibir um chip para cada filtro de valor vazio aplicado (Sprint, Versão, Responsável, Autor ou Centro de Custo), com rótulo legível do estado vazio (`Sem sprint`, `Sem versão`, `Não atribuído`, `Sem autor`, `Sem centro de custo`). O estado neutro (sem filtro) SHALL NOT gerar chip.

#### Scenario: Chip de sprint vazia
- **WHEN** o filtro de Sprint está no estado de valor vazio
- **THEN** a linha exibe um chip com o rótulo `Sem sprint` e botão acessível de remoção

#### Scenario: Remover chip de valor vazio
- **WHEN** o usuário remove o chip de valor vazio de um campo
- **THEN** somente esse campo volta ao estado neutro, o Board é recalculado e os demais chips permanecem

#### Scenario: Estado neutro sem chip
- **WHEN** o filtro de um campo está no estado neutro
- **THEN** nenhum chip é exibido para esse campo

#### Scenario: Múltiplos filtros de valor vazio
- **WHEN** mais de um campo está no estado de valor vazio
- **THEN** a linha exibe um chip para cada campo, cada um removível independentemente

