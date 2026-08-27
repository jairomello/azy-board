## Why

O filtro de versão atualmente só aparece quando o projeto possui versões cadastradas. Isso torna o painel inconsistente e impede que o usuário saiba que existe esse critério antes de configurar uma versão. O controle deve permanecer visível em qualquer projeto, sem tornar o vínculo de versão obrigatório.

## What Changes

- Exibir sempre o controle **Versão** no painel **Filtros** do Board.
- Mostrar `Sem versão` como estado vazio e padrão do filtro.
- Quando o projeto não tiver versões, manter o controle visível com indicação `Nenhuma versão cadastrada`.
- Preservar a filtragem atual quando houver versões e não alterar a persistência do estado vazio.
- Manter o comportamento consistente nos modos `HIERARCHICAL` e `SIMPLE`.
- Atualizar testes e documentação para cobrir projetos sem versões.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `board-filters`: tornar o filtro de versão sempre visível, mesmo sem opções cadastradas.
- `board-filters-persistence`: preservar o estado vazio do filtro de versão em projetos sem versões.

## Impact

- Componente `BoardFilters` e contratos de UI do Board.
- Estados vazios, acessibilidade e textos exibidos no painel.
- Testes de filtro e documentação do Board.
- Nenhuma alteração de banco, API ou modelagem de versões.
