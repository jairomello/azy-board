## ADDED Requirements

### Requirement: Persistir preferências visuais por projeto
O sistema SHALL armazenar modo de visualização, densidade e módulo ativo do Board em estado separado por `projectId`, sem compartilhar preferências entre projetos ou gravar dados de domínio.

#### Scenario: Alteração de visualização
- **WHEN** usuário alterna entre Kanban e Árvore, muda densidade ou seleciona módulo
- **THEN** o estado correspondente é gravado para o projeto atual no `localStorage`

#### Scenario: Projetos independentes
- **WHEN** usuário alterna entre dois projetos com preferências diferentes
- **THEN** cada projeto restaura seu próprio modo, densidade e módulo ativo

### Requirement: Restaurar estado sem flash
O sistema SHALL hidratar filtros e preferências visuais do projeto antes da primeira renderização útil do Board.

#### Scenario: Retorno ao projeto
- **WHEN** usuário sai e retorna a um projeto
- **THEN** o Board inicia com o último estado válido salvo para aquele projeto, sem exibir brevemente os defaults

#### Scenario: Navegação direta
- **WHEN** usuário abre diretamente a URL do Board
- **THEN** o estado salvo do `projectId` da URL é restaurado

### Requirement: Estado inválido ou entidade removida
O sistema SHALL validar o estado persistido e limpar somente valores inválidos ou referências que não existem mais no projeto.

#### Scenario: JSON corrompido
- **WHEN** uma chave persistida não contém JSON válido ou possui tipo inesperado
- **THEN** o sistema ignora o campo inválido, preserva campos válidos e usa o default correspondente sem erro visível

#### Scenario: Módulo removido
- **WHEN** `activeModuleId` persistido não existe mais no projeto
- **THEN** o sistema seleciona um módulo válido ou nenhum módulo e mantém as demais preferências

### Requirement: Compatibilidade e indisponibilidade
O sistema SHALL ler formatos legados compatíveis e continuar funcionando quando `localStorage` estiver indisponível.

#### Scenario: Densidade legada
- **WHEN** existe apenas `board-density` global e não existe preferência de densidade do projeto
- **THEN** o sistema usa esse valor como fallback e grava novas alterações no escopo do projeto

#### Scenario: Storage indisponível
- **WHEN** ler ou gravar `localStorage` lança `SecurityError`
- **THEN** o Board usa defaults e continua funcional sem exibir erro
