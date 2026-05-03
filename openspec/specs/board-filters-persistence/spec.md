## ADDED Requirements

### Requirement: Persistência de filtros no localStorage
O sistema SHALL armazenar o estado atual de filtros do board no `localStorage` do navegador sob a chave `board-filters:<projectId>`, onde `<projectId>` é o identificador do projeto aberto. A gravação SHALL ocorrer sempre que qualquer filtro for alterado.

#### Scenario: Filtros persistidos ao alterar qualquer filtro
- **WHEN** o usuário altera qualquer filtro do board (squad, módulo, sprint, responsável, tipos, tags, toggles)
- **THEN** o novo estado completo de filtros é gravado no `localStorage` sob a chave `board-filters:<projectId>`

#### Scenario: Filtros restaurados ao abrir o board
- **WHEN** o usuário navega para o board de um projeto
- **THEN** o sistema lê `board-filters:<projectId>` do `localStorage` e inicializa os filtros com o estado persistido, sem flash de estado padrão

#### Scenario: Estado padrão quando não há filtros persistidos
- **WHEN** o usuário abre o board de um projeto sem entrada no `localStorage`
- **THEN** os filtros são inicializados com os valores padrão (todos em branco/desativado), igual ao comportamento atual

#### Scenario: Filtros independentes por projeto
- **WHEN** o usuário alterna entre projetos distintos
- **THEN** cada projeto restaura seus próprios filtros do `localStorage`, sem interferência entre projetos

#### Scenario: Fallback para estado padrão em caso de dado corrompido
- **WHEN** o valor em `localStorage` para `board-filters:<projectId>` não é um JSON válido ou está corrompido
- **THEN** o sistema ignora o valor inválido e usa o estado padrão de filtros, sem lançar erro visível ao usuário

#### Scenario: localStorage indisponível
- **WHEN** o `localStorage` lança `SecurityError` (ex.: modo privativo agressivo)
- **THEN** o sistema usa o estado padrão de filtros e o board funciona normalmente, sem persistência
