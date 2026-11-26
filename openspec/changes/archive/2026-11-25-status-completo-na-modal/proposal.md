# Proposal

## Why

O seletor de status da modal de card listava apenas cinco valores (`NOT_STARTED`,
`IN_PROGRESS`, `BLOCKED`, `DONE` e `CANCELLED`), embora o domínio e o board já
trabalhem com sete (`PLANNED` e `IN_HOMOLOGATION` inclusive). Em projetos com
coluna de homologação — como `Em Homologação` — o usuário não conseguia escolher
o status que a própria coluna representa.

O mesmo recorte incompleto aparecia no chip do cabeçalho: o ternário só conhecia
cinco status, então `PLANNED` e `IN_HOMOLOGATION` eram exibidos como
**Cancelada**. Em subtasks, o painel de filhos mostrava o código cru
(`IN_HOMOLOGATION`) em vez do rótulo.

A lista duplicada em três lugares (`ItemModal`, `CardChildrenSection` e um mapa
morto em `features/board/model/types`) era a origem da divergência.

## What Changes

- Um catálogo único no web (`lib/taskStatus.ts`) deriva os status editáveis do
  domínio e centraliza o rótulo em `common:status.*`, com os sete valores na
  ordem do fluxo e sem `ARCHIVED`.
- O seletor da modal, o chip do cabeçalho e o painel de subtasks passam a usar o
  mesmo catálogo e o mesmo rótulo.
- O mapa parcial morto de `features/board/model/types.ts` é removido.
- Testes de catálogo, de modal e de subtasks cobrem os sete rótulos em pt-BR,
  en e es, e impedem regressão para “Cancelada” em Planejada/Homologação.
- A documentação do produto passa a listar os sete estados no guia de edição de
  tasks e bugs.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `card-management`: novo requisito de catálogo completo de status na edição do
  card e de rótulo consistente nas superfícies que exibem o status.

## Impact

- `apps/web/src/lib/taskStatus.ts` (novo) e `lib/taskStatus.test.ts` (novo).
- `apps/web/src/components/ItemModal.tsx` e `CardChildrenSection.tsx`.
- `apps/web/src/features/board/model/types.ts` (remoção do mapa morto).
- `apps/web/src/components/item-modal-status-options.test.tsx` e
  `card-children-status.test.tsx` (novos), `i18n.test.ts` e o contrato de
  accordion (paridade de status).
- `docs/azyboard-wiki/06 - Tasks Bugs e Subtasks/Criar e Editar Tasks e Bugs.md`.
- Sem mudança de contrato REST, MCP, banco ou migration: a API já aceita os sete
  status.
