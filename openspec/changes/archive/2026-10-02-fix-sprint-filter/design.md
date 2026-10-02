## Context

O Board (kanban) do Azy Board exibe cards filtráveis por sprint. O filtro é client-side: o frontend carrega todos os itens do projeto via `GET /projects/:projectId/items` e aplica filtros localmente. Porém, o endpoint de resposta remove o campo `itemSprints` na projeção (linha 367 de `items.ts`), enquanto o `BoardScreen` tenta usar esse campo para filtrar (linha 251). O resultado é que o filtro de sprint nunca encontra correspondência e o board fica vazio.

**Estado atual:**
- Backend: `listItemsWithRelations` carrega `itemSprints` corretamente do banco (Drizzle ORM)
- Backend: projeção de resposta faz `delete flat.itemSprints` e achata para um único `sprintId`
- Frontend: `BoardScreen` filtra por `i.itemSprints?.some(...)` — campo que não existe na resposta
- TreeViewPage funciona corretamente porque filtra server-side via query param `sprintId`

## Goals / Non-Goals

**Goals:**
- Garantir que `itemSprints` esteja presente na resposta da API para que o filtro client-side funcione
- Manter o campo achatado `sprintId` para compatibilidade com código existente
- Validar com testes que o filtro por sprint funciona no Board

**Non-Goals:**
- Migrar o filtro de sprint para server-side (seria refatoração maior, não é necessário agora)
- Alterar o comportamento do TreeViewPage (já funciona corretamente)
- Suportar migração de dados entre sprints

## Decisions

### Decisão 1: Preservar `itemSprints` na resposta da API (Opção A)

**Escolha:** Remover o `delete flat.itemSprints` da projeção de resposta em `items.ts`, mantendo o array completo de sprints vinculadas ao item.

**Alternativas consideradas:**
- **Opção B (frontend only):** Mudar o filtro para usar `sprintId` achatado — rejeitado porque `sprintId` só contém a primeira sprint; itens com múltiplas sprints não seriam filtrados corretamente.
- **Opção C (server-side):** Enviar `sprintId` como query param e filtrar no backend — funcional, mas exigiria mudanças em `useBoardData.ts` e no endpoint, e perderia a reatividade do filtro client-side (precisaria de refetch a cada troca de filtro).

**Rationale:** A Opção A é a correção mínima e correta. O array `itemSprints` já é carregado do banco; basta não deletá-lo na serialização. Mantém o campo achatado `sprintId` para compatibilidade.

### Decisão 2: Manter filtro client-side

O filtro por sprint continua client-side no `BoardScreen`. Isso é adequado porque:
- O número de itens por projeto é gerenciável (dezenas a baixas centenas)
- O filtro é instantâneo (sem refetch)
- O padrão já é usado para outros filtros (coluna, tag, responsável)

## Risks / Trade-offs

- **[Risco] Payload maior:** Preservar `itemSprints` adiciona ~20-40 bytes por item por sprint vinculada. Para projetos típicos (< 200 items, < 10 sprints), o impacto é desprezível.
- **[Risco] Quebra de contrato:** Clientes que dependem da ausência de `itemSprints` podem se comportar diferente. Mitigação: o campo já está declarado no tipo `ItemData` como opcional; consumidores que não o usam não são afetados.
- **[Trade-off] Não otimizar para N+1:** A correção não muda a query de persistência, que já carrega `itemSprints` via include. Sem impacto adicional.

## Migration Plan

1. Alterar a projeção de resposta em `apps/api/src/routes/items.ts` (remover `delete flat.itemSprints`)
2. Verificar que o Board filtra corretamente
3. Executar `bun run check` (typecheck + lint + testes)
4. Executar `bun run test:smoke` para validar o fluxo web/API
5. Rollback: re-adicionar `delete flat.itemSprints` se necessário (mudança de 1 linha)

## Open Questions

_(nenhuma — a correção é direta)_