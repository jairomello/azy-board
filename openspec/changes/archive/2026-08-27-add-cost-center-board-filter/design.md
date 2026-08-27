## Context

O modelo de itens já possui `costCenterId` opcional, validado contra o projeto e tenant, e o Board carrega os itens e seus atributos em memória. O `BoardFilters` ainda não possui esse campo, embora já filtre por outras dimensões de projeto. Centros de Custo são entidades do projeto com código, descrição e ordenação.

## Goals / Non-Goals

**Goals:**

- Exibir um filtro de Centro de Custo no painel de filtros do Board.
- Derivar as opções do conjunto de Centros de Custo do projeto atual.
- Aplicar o filtro client-side em `costCenterId`, combinando-o com as demais dimensões por AND.
- Manter o controle visível sem centros cadastrados e persistir a seleção por projeto.

**Non-Goals:**

- Criar ou editar Centros de Custo no painel de filtros.
- Alterar a associação automática ou a API de Centros de Custo.
- Criar uma opção filtrável especial para itens sem Centro de Custo.

## Decisions

- **Seleção única:** usar o mesmo padrão de selects de módulo, sprint e versão; vazio significa todos os Centros de Custo.
- **Opções do projeto:** passar a coleção já carregada de Centros de Custo ao `BoardFilters`, sempre filtrada pela API com tenant/projeto. Sem opções, renderizar estado informativo desabilitado.
- **Aplicação em memória:** comparar `item.costCenterId` com o valor selecionado antes do agrupamento em lanes, sem nova requisição ao mudar o filtro.
- **Persistência:** adicionar `costCenterId` ao estado `board-filters:<projectId>`, normalizando estados antigos e limpando a seleção quando o Centro for removido.
- **Compatibilidade de modos:** manter o filtro em `SIMPLE` e `HIERARCHICAL`, pois a associação pertence ao item e não à apresentação hierárquica.
- **Segurança:** não aceitar IDs de Centro de Custo do cliente para buscar dados adicionais; o filtro atua apenas sobre dados já autorizados e carregados do projeto.

## Risks / Trade-offs

- [Centro removido deixa filtro persistido inválido] -> validar a seleção contra a lista atual e limpá-la sem alterar outros filtros.
- [Projeto sem Centros de Custo mostra controle sem opções] -> exibir `Nenhum centro de custo cadastrado` e manter `Todos os centros` como estado vazio.
- [Itens sem associação não aparecem com filtro ativo] -> documentar a semântica e deixar o estado vazio como forma de visualizar todos.

## Migration Plan

1. Adicionar `costCenterId` ao estado e ao componente de filtros.
2. Passar Centros de Custo e aplicar a comparação nos cards/lanes.
3. Persistir, restaurar e invalidar a seleção.
4. Adicionar testes de contrato, combinação, modos e estado vazio.
5. Atualizar documentação e executar as verificações do monorepo.

## Open Questions

- Uma opção explícita para filtrar itens sem Centro de Custo poderá ser avaliada em uma mudança futura.
