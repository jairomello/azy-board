# Design

## Context

Ver `proposal.md` — Why. A Tree View e o board compartilham o mesmo estado de filtros (`BoardFilterState`) e a grade da árvore tem cache por filtro.

## Goals / Non-Goals

**Goals**
- Aplicar filtros sem sair da grade e sem duplicar o estado do board.
- Manter limpar filtros previsível e reversível.
- Criar item no contexto da linha sem modal.

**Non-Goals**
- Novos campos de filtro ou mudanças de API.
- Reordenar colunas por arraste.
- Arquivamento assíncrono ou lixeira permanente.

## Decisions

- **Filtro de coluna reutiliza `BoardFilterState`.** Cada coluna mapeia para uma chave existente do estado; aplicar na grade também reflete no painel de filtros e vice-versa.
- **Limpar separa população de exibição.** A função zera filtros e ocultações de lanes vazias, mas preserva `showSubtasks`, `storyDisplay`, `moduleViewMode` e o modo de visualização atual.
- **Criação inline usa a rota existente.** A linha minimalista coleta o mínimo e delega ao fluxo de criação; a hierarquia é validada no cliente e no servidor.
- **Desfazer é uma ação do toast.** O arquivamento mantém o toast por uma janela curta e oferece "Desfazer", que chama a restauração e invalida os caches do board e da árvore.

## Risks / Trade-offs

- [Toast expira antes do usuário reagir] → janela de 7 segundos e restauração também disponível na modal de arquivados.
- [Cache da árvore desatualizado após criar/arquivar] → invalidação explícita do cache da árvore por filtro.
- [Filtro de coluna divergir do painel] → ambos derivam do mesmo estado e da mesma fonte de visibilidade.

## Migration Plan

Sem migração de dados ou schema.
