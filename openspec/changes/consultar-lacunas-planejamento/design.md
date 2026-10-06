Board ref: 5f3152ad-3d27-4a12-8c49-db79d0f631e2

## Context

`list_tasks` e `itemFiltersSchema` não representam ausência de planejamento como predicado estruturado. O board usa ausência de todos os vínculos para sprint em `packages/ui-contracts/src/visibility.ts`. `assistantUiTools.ts` já entrega filtros/voltar por aba, porém sem prazo/pontos ou OR. T17/T18 entregaram essa base; o documento de sugestões é anterior a essas entregas. Conforme `proposal.md`, o resultado deve ser completo, contável e reaproveitável.

## Goals / Non-Goals

**Goals:** consultar lacunas combináveis, contar sem duplicação, abrir recorte fiel e corrigir IDs aprovados.

**Non-Goals:** atribuir estimativas por inferência, rotina automática, modificar todos os cards do projeto ou reconstruir o framework de comandos de UI.

## Decisions

1. **Consulta dedicada.** `query_planning_gaps` recebe projeto, escopo tipado, `where` com grupos ALL/ANY e condições allowlisted. Profundidade máxima 3, até 20 condições; `limit` 1–100, padrão 50. Campos de lacuna: dueDate, points, sprint, version, assignee. Operadores IS_EMPTY/IS_NOT_EMPTY e EQ para campos compatíveis; datas aceitam LT/LTE/GT/GTE em YYYY-MM-DD. Sem SQL/texto livre. Omitir filtro ou receber null no envelope significa não filtrar; operandos ausentes não equivalem a IS_EMPTY. Alternativa de estender filtros genéricos de mutação foi rejeitada para separar descoberta de execução.
2. **Semântica precisa.** Prazo/pontos/versão ausentes são NULL; zero pontos é estimativa válida. Sprint ausente exige nenhum vínculo, mesmo histórico; responsável ausente exige nenhum usuário nem API key atribuída. `me` resolve ator autenticado. Padrão: TASK/BUG folhas ativos não arquivados, excluindo DONE/CANCELLED; alteração desse padrão deve ser explícita e retornada. Agregadores não recebem pontos diretos.
3. **Resultado fixado.** Resolver IDs, revisões e valores relevantes num snapshot consistente do banco. Retornar `resultId`, expressão normalizada, total distinto, captura, grupos por lacuna, histogramas de combinações exclusivas e cursor vinculado ao resultado. Contagens de lacuna podem se sobrepor e são rotuladas como tal; total não é soma de grupos. Snapshot dura 30 minutos, vinculado a tenant/projeto/ator; até 10.000 IDs, excesso gera erro e solicita estreitar consulta, sem truncar silenciosamente. Paginação ordenada por código/ID não muda a população.
4. **UI por referência.** Acrescentar comando somente do assistente `open_planning_result` reaproveitando transporte, dedup e checkpoints existentes. O servidor valida acesso e entrega o resultado paginado. Board aplica camada de recorte por IDs, inclusive OR e prazo/pontos, e mostra título/contagem; árvore mantém ancestrais apenas para navegação, fora da população. Não traduzir OR em filtros AND do toolbar. Kanban informa quantos itens não são apresentáveis e oferece árvore, sem ocultar a diferença. Voltar restaura visão anterior.
5. **Correção separada.** Propor plano de alterações sobre grupo fixado; usar `update_items` com IDs explícitos e pré-condições de revisão/valores. Não reexecutar o filtro depois da aprovação. Campos desconhecidos geram pedido de decisão, não default. Grupos sobrepostos são deduplicados; alterações contraditórias para o mesmo campo/item exigem nova prévia. Zero IDs nunca usa matchAll.
6. **Dependências.** T17/T18 para comandos/contexto; T38 para reserva e resultado de correção e efeitos pós-commit. Persistência de snapshot de leitura é dado da consulta, não uma segunda infraestrutura de idempotência. Usar ports e os dois adapters em `apps/api/src/db/{sqlite,postgres}/adapter.ts`.

## Risks / Trade-offs

- [Snapshot ficou obsoleto] → exibir captura, invalidar execução por conflito; recalcular apenas com nova aprovação.
- [Página confundida com total] → retornar total exato e cursor; nunca inferir total da amostra.
- [Revogação de acesso] → revalidar cada leitura/abertura/correção, sem devolver IDs de outro tenant.
- [Explosão combinatória] → limites na expressão e grupos exclusivos apenas para cinco lacunas (até 32 combinações).

## Migration Plan

Adicionar contratos/consulta e armazenamento de resultado com expiração pelos ports, validar paridade SQLite/PostgreSQL; integrar comando de UI e correção. Manter `list_tasks` compatível. Rollback desabilita consulta/comando, expira snapshots e não desfaz correções já confirmadas.

## Open Questions

Sem decisão pendente; adaptar apenas nomes de pré-condições/resultados ao contrato T38 na implementação.
