## Context

O Board já possui filtros persistidos por projeto e controles de visualização distribuídos entre `BoardFilters`, `BoardCommandBar` e `BoardPage`. A nova linha deve ficar entre os controles e as lanes, sem alterar o layout quando nenhum filtro estiver ativo.

## Goals / Non-Goals

**Goals:**

- Dar visibilidade imediata ao estado filtrado do Board.
- Permitir remoção individual com atualização instantânea do Board e do `localStorage`.
- Mostrar valores legíveis de catálogos e manter acessibilidade/responsividade.

**Non-Goals:**

- Alterar a semântica ou combinação AND/OR dos filtros existentes.
- Criar um segundo estado de filtros ou persistência no backend.
- Exibir chips para defaults que não restringem a visualização.

## Decisions

### Componente dedicado

Criar um componente `ActiveFilterChips` que recebe o estado de filtros e catálogos, produz chips normalizados e emite uma remoção por chave/valor. Isso mantém `BoardPage` responsável pelo estado e evita duplicar regras na barra de filtros.

### Chips e rótulos

Filtros simples (`moduleId`, `sprintId`, `versionId`, `squadId`, `assigneeId`, `authorId`, `priority`, `status`, `costCenterId`) terão um chip por seleção. Arrays de tags e tipos terão um chip por valor. O rótulo exibirá nome do catálogo quando disponível e fallback curto/seguro quando não estiver carregado. Togg les de visualização só serão exibidos se representarem uma escolha não padrão que altera o Board.

### Remoção

Cada chip terá botão com `aria-label` incluindo o nome do filtro. Ao remover, o componente chamará um callback funcional que limpa apenas aquele campo; o efeito já existente de persistência gravará o novo estado no projeto. O foco retornará a um elemento estável da linha quando o chip desaparecer.

### Layout

A linha usará `flex-wrap`, tags pequenas e rolagem apenas interna se necessário em telas muito estreitas. Sem chips, o componente retornará `null`, preservando exatamente o espaçamento atual.

## Risks / Trade-offs

- **Catálogo ainda carregando** → não esconder o filtro; usar fallback temporário e atualizar o rótulo quando o catálogo chegar.
- **Muitos chips** → permitir quebra de linha e manter cada botão acionável por teclado.
- **Filtros visuais confundidos com filtros de conteúdo** → separar visualmente ou usar rótulos explícitos.
- **Persistência sobrescrita por estado inicial** → reutilizar o estado único já existente no `BoardPage`.

## Migration Plan

1. Criar normalizador e componente de chips.
2. Inserir a linha no ponto definido sem chips por padrão.
3. Conectar remoção ao estado atual e validar persistência por projeto.
4. Adicionar traduções, testes e validação visual.
5. Rollback: remover o componente; nenhum dado ou contrato persistente é alterado.

## Open Questions

Nenhuma questão bloqueante. A primeira versão exibirá filtros que restringem conteúdo; opções visuais não restritivas permanecerão fora da linha.
