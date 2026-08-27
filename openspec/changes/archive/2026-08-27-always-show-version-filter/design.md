## Context

O `BoardFilters` já possui o estado `versionId` e um select de versões, mas condiciona sua renderização à existência de versões no projeto. Como resultado, projetos sem versões não deixam visível que esse critério está disponível. A alteração é exclusivamente de apresentação e estado vazio; a filtragem e o modelo `items.version_id` já estão implementados.

## Goals / Non-Goals

**Goals:**

- Manter o controle **Versão** visível em qualquer projeto.
- Exibir `Sem versão` como valor padrão e `Nenhuma versão cadastrada` quando a lista estiver vazia.
- Preservar filtragem, persistência, acessibilidade e compatibilidade com os modos do Board.

**Non-Goals:**

- Criar versões dentro do painel de filtros.
- Alterar a API, o banco ou o vínculo entre item e versão.
- Criar um filtro para itens sem versão nesta etapa.

## Decisions

- **Select sempre renderizado:** remover a condição `versions.length > 0` do controle de versão. Isso mantém o layout previsível e permite que o usuário descubra a funcionalidade.
- **Estado vazio explícito:** manter `Sem versão` como opção selecionável e adicionar uma opção desabilitada `Nenhuma versão cadastrada` somente quando não houver versões. O filtro vazio continua significando "todas as versões".
- **Sem chamada adicional:** o componente continua recebendo `versions` do Board; nenhum fetch será disparado pelo filtro.
- **Persistência inalterada:** `versionId: ''` continua sendo o default e a limpeza; estados persistidos seguem compatíveis.
- **Mesmo comportamento nos modos:** o controle aparece tanto em `SIMPLE` quanto em `HIERARCHICAL`, pois versão é atributo de item e não depende de módulo/épico.

## Risks / Trade-offs

- [O usuário pode esperar cadastrar uma versão no filtro] -> exibir `Nenhuma versão cadastrada` e manter o cadastro em Configurações do projeto.
- [Mais um controle em projetos sem versões] -> usar um select compacto e não contar `Sem versão` como filtro ativo.

## Migration Plan

1. Alterar o componente de filtro para sempre renderizar o select.
2. Adicionar teste de contrato para projeto sem versões e preservar testes de seleção existente.
3. Validar typecheck, testes, lint e build; não há migração nem rollback de dados.

## Open Questions

- Nenhuma para esta alteração.
