## Context

O modo de densidade **Compacta** (T33, `board-compact-density`) compacta o cabeçalho e reduz padding/gap dos cards via `.density-compact .kanban-card-content`. Medição de um card real em Compacta: **188 px**, com regiões de **26 px** (topo), **16 px** (breadcrumb), **39 px** (título 2 linhas), **20 px** (etiquetas), **20 px** (progresso) e **29 px** (rodapé), mais ~12,8 px de padding e ~24 px de gaps.

O `KanbanCard` atual expõe o conteúdo em `.kanban-card-content` (coluna flex com `gap`); o título é renderizado por `InlineEdit` (parágrafo com `line-clamp-2`) e o breadcrumb é uma `div` própria. A spec `board-compact-density` hoje exige manter breadcrumb e título visíveis; esta change **amplia** a compactação no estado Compacta, mantendo o Confortável intacto.

Restrições: sem dependências novas; i18n; `bun run check`, `test:smoke`, `check:bundle`.

**Board ref:** `8a640c8f-ce9e-416b-aad6-8708d970321f` (T34).

## Goals / Non-Goals

**Goals:**

- Compactar mais os cards **apenas no estado Compacta**: título 1 linha (com tooltip), breadcrumb oculto, gap/padding menores.
- Manter o **Confortável inalterado** e preservar topo, etiquetas, progresso, rodapé, ações, edição, arraste e acessibilidade.
- Reduzir o card de exemplo de ~188 px para ~142 px (−25%).

**Non-Goals:**

- Criar novo controle ou novo estado de densidade.
- Alterar o cabeçalho do Board (já entregue no T33).
- Alterar densidade da árvore ou das modais.
- Backend/API ou migração de dados.

## Decisions

### D1 — Só o estado Compacta muda

As regras novas vivem sob `.density-compact`; o estado Confortável permanece exatamente como está.

- *Por quê:* o usuário quer compactar mais no modo denso, mantendo o padrão atual.

### D2 — Implementação por CSS escopado + ganchos de classe no card

Adicionar ganchos `kanban-card-title` (wrapper do título) e `kanban-card-breadcrumb` (linha do breadcrumb) no `KanbanCard` e, em `globals.css`:

```css
.density-compact .kanban-card-breadcrumb { display: none; }
.density-compact .kanban-card-title p { -webkit-line-clamp: 1; line-clamp: 1; }
.density-compact .kanban-card-content { padding-top/bottom: 0.3rem; gap: 0.25rem; }
```

- *Por quê:* centraliza a densidade no CSS escopado (padrão já usado) e evita threading de prop pela árvore de componentes; o Confortável não é tocado.
- *Alternativa considerada:* prop `compact` em `KanbanCard`. Mais explícita, porém espalha a densidade por mais arquivos; mantida a convenção por classe.
- *Alternativa considerada:* esconder também etiquetas/progresso. Rejeitada: removeria informação relevante.

### D3 — Título completo acessível

No estado Compacta o título é truncado em 1 linha, mas o wrapper recebe `title={card.title}` para exibir o texto completo no hover; a edição inline continua funcionando.

- *Por quê:* compensa o truncamento sem esconder o dado de forma definitiva.

### D4 — Preservar as demais regiões e controles

Topo, etiquetas, progresso, rodapé, ações (hover/foco), arraste e clique para abrir detalhes permanecem. O breadcrumb é a única região ocultada no modo Compacta (contexto recuperável ao voltar a Confortável).

### D5 — Verificação

Contrato estrutural `[CONTRATO-ESTRUTURAL]` de que `.density-compact` oculta o breadcrumb e limita o título a 1 linha, mirando ganchos presentes no `KanbanCard`; medição no navegador (meta ~142 px); `bun run check`, `test:smoke`, `check:bundle`.

## Risks / Trade-offs

- **[Perda do breadcrumb no modo denso] →** é contextual e volta ao alternar para Confortável; a referência curta (código) permanece no topo.
- **[Truncamento do título] →** tooltip com o texto completo e edição inline preservada.
- **[Especificidade do `line-clamp-2` do Tailwind] →** aplicar a regra no `p` interno do título sob `.density-compact` (classe gancho), que vence a utilidade.
- **[Regressão silenciosa se a estrutura do card mudar] →** teste estrutural amarrando CSS e ganchos do componente.
- **[Bundle do BoardPage] →** mudanças mínimas; medir com `check:bundle`.

## Migration Plan

Aditivo e reversível: sem migração de dados; o estado Confortável é o padrão. Rollback: remover as regras/ganchos restaura o comportamento anterior.

## Open Questions

- Reexibir o breadcrumb em telas largas no modo Compacta? Proposta: não nesta change (manter simples).
