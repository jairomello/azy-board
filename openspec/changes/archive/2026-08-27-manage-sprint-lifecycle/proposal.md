## Why

O Azy Board já possui uma estrutura inicial de sprints, mas seus estados e regras ainda não representam um ciclo de vida claro: datas são opcionais, o cadastro não está completo nas configurações e uma sprint fechada ainda pode receber cards. Isso pode gerar planejamento inconsistente e permitir alterações em períodos encerrados.

## What Changes

- Disponibilizar nas configurações do projeto o cadastro de N sprints com nome, data de início, data de fim e status.
- Padronizar os estados para `PROPOSED` (inicial), `OPEN` e `CLOSED`.
- Permitir editar dados da sprint e transicionar uma sprint proposta para aberta e aberta para fechada, respeitando as regras do projeto.
- Exibir o campo **Sprint** no formulário de criação de task/bug, sempre visível mesmo sem sprints cadastradas.
- Oferecer para vínculo somente sprints `PROPOSED` ou `OPEN`; sprints `CLOSED` não devem aparecer como opção.
- Bloquear server-side qualquer inclusão de item em sprint fechada, mesmo por chamada direta à API.
- Adicionar o filtro **Sprint** na barra de filtros do Board, sempre visível mesmo sem sprints cadastradas.
- Permitir filtrar por sprints fechadas para consulta histórica, sem permitir novos vínculos.
- Atualizar testes, documentação e migração dos estados legados.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `sprint-management`: completar CRUD, datas obrigatórias, ciclo de vida e bloqueio de inclusão em sprint fechada.
- `card-creation-ui`: incluir campo opcional de sprint na criação rápida de task/bug.
- `board-filters`: manter o filtro Sprint sempre visível e permitir consulta por qualquer sprint do projeto.
- `board-filters-persistence`: persistir e restaurar o filtro Sprint vazio ou selecionado por projeto.

## Impact

- Schema/migração de `sprints.status`, datas e endpoints de sprint.
- Associação `item_sprints`, criação de itens e validação server-side de sprint fechada.
- `SettingsPage`, `AddCardForm`, `BoardPage` e `BoardFilters`.
- Testes de ciclo de vida, vínculo, filtro, isolamento multi-tenant e regressão de sprints existentes.
