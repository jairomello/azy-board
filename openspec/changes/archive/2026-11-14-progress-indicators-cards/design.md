# Design

## Context

Ver `proposal.md` — Why. O Board já calcula o avanço no fluxo em `@azy-board/domain` (`resolveColumnProgressWeights`, `itemsAdvance`, `computeAdvance`). O Dashboard usa o mesmo indicador. A listagem `GET /projects` hoje devolve apenas dados do projeto, sem agregados de itens.

## Goals / Non-Goals

**Goals**
- Um componente visual único para barras compactas (cards) e rotuladas (projetos).
- Progresso de projeto igual ao do Dashboard/Board, calculado no servidor.
- Cores 100% derivadas dos tokens do tema, com contraste nos dois modos.
- Sem N+1 ao abrir a tela de projetos.

**Non-Goals**
- Alterar a semântica de avanço, pesos de coluna ou checklists.
- Adicionar saúde/cronograma aos cards de projeto nesta change.
- Criar um endpoint novo: o resumo vai no parâmetro `includeProgress` de `GET /projects`.
- Migrar schema ou recalcular dados históricos.

## Decisions

- **Componente compartilhado `ProgressBar`.** Recebe `value` (0–100), variante `compact`/`labeled`, rótulo acessível e contagem opcional. O estilo fica em classes utilitárias + variáveis CSS, sem hex no componente.
- **Trilho com marcas e preenchimento em gradiente.** O trilho usa `--muted`/`--foreground` com marcas a 25/50/75%; o preenchimento usa `--primary` → `--status-review` e, em 100%, `--status-done`. O brilho é `color-mix` do token de avanço, não uma cor fixa.
- **Movimento discreto.** A largura transita uma vez ao montar/atualizar; `prefers-reduced-motion` remove transição e brilho animado. Não há shimmer contínuo.
- **`includeProgress=true` explícito em `GET /projects`.** Evita custo para consumidores que não precisam do dado. A UI da tela de projetos sempre envia o parâmetro.
- **Agregação em massa por projeto.** Um novo método de persistência agrupa folhas por projeto/coluna/status em uma consulta (SQLite e PostgreSQL), e o cálculo do avanço reutiliza as funções de domínio. Isso evita uma consulta de Dashboard por projeto.
- **Escopo de progresso igual ao Dashboard.** Folhas `TASK`/`BUG` não arquivadas, excluindo `CANCELLED` e `EXTERNAL`; `advance` é a média ponderada; `done`/`total` são contagens de folhas.
- **Falha de agregação não derruba a lista.** Projetos sem resumo recebem `progress: null` e o card mostra “progresso indisponível”, sem percentual inventado.

## Risks / Trade-offs

- [Custo da agregação em massa na listagem] → parâmetro opt-in, consulta agrupada e cache de UI por identidade/recorte.
- [Divergência entre Board, Dashboard e lista] → todos usam as mesmas funções de domínio e um teste de consistência.
- [Barra chamativa demais em cards densos] → variante compacta de 6 px, sem rótulo numérico no card; percentual fica no tooltip/aria.
- [Contraste insuficiente no tema escuro] → testes visuais e de contrato com tokens dos dois temas.

## Migration Plan

Sem migração de dados. Deploy é compatível: clientes antigos ignoram o parâmetro e o campo novo. Rollback remove o parâmetro e a UI.
