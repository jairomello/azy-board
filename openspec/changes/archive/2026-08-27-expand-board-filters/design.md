## Context

O componente `BoardFilters` já aplica filtros client-side sobre os itens carregados pelo Board e persiste parte do estado por projeto. Atualmente possui squad, módulo, sprint, responsável, tipo e tag. O modelo unificado de itens já fornece `priority`, `status`, `authorId`, `versionId` e a relação N:N com tags; versões são entidades do projeto relacionadas opcionalmente a qualquer item por `items.version_id`.

## Goals / Non-Goals

**Goals:**

- Expor no painel Filtros os critérios de tag, versão, prioridade, status e autor.
- Reutilizar os dados já carregados pelo Board, sem re-fetch a cada alteração.
- Combinar dimensões diferentes com AND e tags selecionadas com OR.
- Persistir e restaurar os novos filtros de forma independente por projeto.
- Manter o comportamento correto nos modos `HIERARCHICAL` e `SIMPLE`.
- Permitir que uma task/bug seja criado já associado a uma versão, pela UI ou MCP.

**Non-Goals:**

- Alterar a modelagem de versões ou criar uma tabela de associação nova.
- Criar busca textual, filtros salvos compartilhados ou filtros no backend nesta etapa.
- Alterar o significado do vínculo de versão: um item continua podendo ter no máximo uma versão.

## Decisions

- **Filtragem client-side:** ampliar `BoardFilterState` e a função de derivação de itens, usando os objetos carregados pelo Board. Uma chamada por filtro foi descartada para preservar a resposta imediata e o contrato atual.
- **Opções derivadas do projeto:** versões, autores, prioridades e status serão derivados dos dados disponíveis no projeto; tags continuarão vindo da coleção de tags do projeto. Isso evita opções de outro tenant e mantém o filtro alinhado ao conteúdo visível.
- **Seleção:** preservar o padrão atual de seleção única para versão, prioridade, status e autor; manter seleção múltipla para tags. O estado vazio significa "todos" em cada dimensão.
- **Semântica de combinação:** critérios diferentes usam AND (`version AND priority AND status AND author AND tags`); várias tags usam OR, de modo que um item com qualquer tag selecionada seja aceito.
- **Versão como vínculo direto:** filtrar por `item.versionId`, incluindo somente itens associados à versão escolhida. A versão é aplicável a EPIC, STORY, TASK e BUG, não apenas a tasks.
- **Valores ausentes:** itens sem versão, autor ou tag não aparecem quando o respectivo filtro está ativo; itens sem prioridade/status válidos são excluídos do critério correspondente. Nenhum valor especial "Sem versão" será introduzido nesta etapa.
- **Persistência compatível:** adicionar os campos ao JSON `board-filters:<projectId>` com defaults vazios. Leituras de estados antigos devem preencher os campos ausentes sem invalidar filtros existentes; limpar filtros deve removê-los e preservar opções visuais.
- **Modo simples:** esconder/desabilitar somente o filtro de módulo quando o Board simples já não o utiliza; os novos filtros permanecem disponíveis e operam sobre o mesmo conjunto de cards.
- **Criação com versão:** o formulário rápido recebe as versões do projeto e envia `versionId` opcional. O MCP expõe o mesmo campo no `create_task`; a API valida projeto e tenant e aceita ausência como `null`.

## Risks / Trade-offs

- [Autores e versões podem não estar disponíveis em todos os payloads] -> enriquecer o carregamento do Board com esses campos/relações antes de renderizar as opções e tratar ausência como lista vazia.
- [Muitos autores/tags tornam o painel extenso] -> usar controles compactos, rolagem e layout responsivo sem mudar o contrato de filtragem.
- [Estado persistido antigo possui formato parcial ou inválido] -> normalizar cada campo individualmente e aplicar defaults seguros.
- [Itens pais e cards são derivados em etapas diferentes] -> aplicar filtros ao conjunto base antes dos agrupamentos, mantendo progresso e lanes coerentes.
- [Versão excluída deixa `versionId` nulo] -> ao restaurar filtros, remover automaticamente uma versão que não esteja mais presente no projeto.

## Migration Plan

1. Atualizar tipos e normalização do estado de filtros sem migração de banco.
2. Enriquecer os dados já carregados pelo Board com versão e autor quando necessário.
3. Adicionar os controles e aplicar os critérios na derivação client-side.
4. Persistir/restaurar os novos campos e atualizar o estado vazio quando entidades forem removidas.
5. Executar testes de filtros isolados, combinações, persistência e ambos os modos de Board.
6. Testar criação rápida e via MCP com versão, sem versão e com versão de outro projeto.

## Open Questions

- Se a lista de versões/autores crescer significativamente, poderá ser necessário trocar os selects por busca/autocomplete em uma mudança futura.
