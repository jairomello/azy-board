# Proposal

## Why

O PR #7 adicionou à Tree View as colunas de datas realizadas, responsável externo e chave externa, mas a spec `tree-view` continua listando apenas as colunas originais. O comportamento publicado ficou sem contrato.

## What Changes

- Documentar as colunas opcionais de rastreio do tracker na Tree View: datas realizadas de início e fim, responsável externo e chave externa.
- Definir que essas colunas nascem ocultas, podem ser exibidas pelo seletor de colunas e, quando editáveis, salvam pela mesma API de edição inline.
- Definir a exibição da chave externa como referência somente leitura derivada de `externalSource`/`externalRef`.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `tree-view`: amplia as colunas de dados com as colunas de rastreio do tracker.

## Impact

- Frontend: `apps/web/src/pages/TreeViewPage.tsx` e i18n.
- API: mesmos campos já aceitos pelo `PATCH` de item.
- Testes: colunas de dependências e layout da grade.
