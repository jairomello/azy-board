# item-change-tracking Specification

## Purpose
Mantém um marcador confiável de "última alteração" por item, atualizado a cada mutação do card ou de seus registros dependentes, para alimentar filtros por janela de tempo no board, na API, no MCP e no Azy Agent.

## Requirements

### Requirement: Alteração do próprio item atualiza o marcador

O sistema SHALL atualizar `updated_at` de um item sempre que qualquer campo do próprio registro for criado ou alterado.

#### Scenario: Edição de campo do card

- **WHEN** usuário ou agente altera título, descrição, prioridade, status, responsável, datas, tags, sprint, versão ou qualquer campo do item
- **THEN** o `updated_at` do item passa a ser o instante da alteração

#### Scenario: Movimentação e reordenação

- **WHEN** o card é movido de coluna, reordenado, arquivado, desarquivado, recebe responsável ou tem tags substituídas
- **THEN** o `updated_at` do card é atualizado na mesma operação

### Requirement: Mutação em registro dependente atualiza o card dono

O sistema SHALL atualizar `updated_at` do item dono quando um registro dependente dele for criado, alterado ou removido: passos e checklists, subtasks, links externos, anexos, dependências e histórico/apontamentos.

#### Scenario: Alteração de checklist

- **WHEN** um passo de checklist do card é marcado, desmarcado, editado, criado ou removido
- **THEN** o `updated_at` do card dono é atualizado

#### Scenario: Alteração de link, anexo ou dependência

- **WHEN** um link externo, um anexo ou uma dependência é criado, alterado ou removido no card
- **THEN** o `updated_at` do card dono é atualizado

#### Scenario: Registro de trabalho ou auditoria

- **WHEN** um apontamento de trabalho ou um evento automático de auditoria é gravado no card
- **THEN** o `updated_at` do card dono é atualizado

#### Scenario: Alteração de subtask

- **WHEN** uma subtask (filha do card) é criada, alterada, movida ou removida
- **THEN** o `updated_at` do item dono é atualizado

### Requirement: Propagação do marcador para os ancestrais

O sistema SHALL propagar o instante da alteração para todos os ancestrais do item alterado (subtask → task → story → épico), em uma única operação em lote, sem recursão, sem laço e sem uma consulta por nível.

#### Scenario: Alteração em folha propaga até o épico

- **WHEN** um registro dependente de uma task folha é alterado
- **THEN** o `updated_at` da task, da story e do épico ancestral são atualizados no mesmo instante

#### Scenario: Profundidade não aumenta o número de consultas

- **WHEN** o item alterado possui qualquer profundidade de ancestralidade
- **THEN** a propagação usa os identificadores de ancestral já disponíveis no caminho desnormalizado do item e é resolvida em uma única sentença

### Requirement: Isolamento do marcador por tenant e projeto

A atualização do marcador SHALL ocorrer apenas dentro do tenant e do projeto do item alterado, sem alcançar itens de outro tenant ou projeto.

#### Scenario: Ancestral de outro tenant não é tocado

- **WHEN** ocorre a propagação de um item
- **THEN** apenas itens do mesmo tenant e projeto do item alterado têm o marcador atualizado

### Requirement: Marcador legível pelas consultas

O sistema SHALL expor `updatedAt` de cada item nas respostas de leitura em UTC no formato ISO do sistema, para consumo por filtros, listagens e agentes.

#### Scenario: Marcador presente na listagem

- **WHEN** o board, a API ou o agente consulta itens do projeto
- **THEN** cada item retorna `updatedAt` com o instante da sua última alteração, incluindo as propagadas
