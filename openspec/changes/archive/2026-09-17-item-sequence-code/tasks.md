## 1. Database — Migration e Schema

- [x] 1.1 Criar migration `apps/api/src/db/migrations/0020_item-sequence-code.sql` com `ALTER TABLE items ADD COLUMN sequence_code text` e `CREATE UNIQUE INDEX idx_items_sequence_code ON items(tenant_id, project_id, sequence_code)`
- [x] 1.2 Adicionar coluna `sequenceCode: text('sequence_code')` na tabela `items` do schema Drizzle (`apps/api/src/db/schema.ts`, após a coluna `type`)
- [x] 1.3 Executar `bun run --cwd apps/api migrate` e verificar que a migration aplica sem erros

## 2. Backend — Validação Zod

- [x] 2.1 Adicionar campo `sequenceCode` ao `createItemSchema` (`apps/api/src/validation.ts`): `z.string().regex(/^[ESTB]\d+$/).max(20).nullable().optional()`
- [x] 2.2 Adicionar campo `sequenceCode` ao `updateItemSchema` (`apps/api/src/validation.ts`): mesmo schema do create

## 3. Backend — Lógica de criação e atualização

- [x] 3.1 Criar função auxiliar `nextSequenceCode(db, tenantId, projectId, type)` em `apps/api/src/routes/items.ts` que busca o maior número para o prefixo do tipo no projeto e retorna o próximo código (ex: `T3`)
- [x] 3.2 No handler POST create (`items.ts`, linha ~588): gerar `sequenceCode` automaticamente se não vier no body; validar formato e unicidade se vier; incluir no insert
- [x] 3.3 No handler PATCH update (`items.ts`, linha ~776): adicionar `'sequenceCode'` ao whitelist de campos editáveis; validar formato e unicidade (excluindo o item atual) se mudou
- [x] 3.4 Incluir `sequenceCode` na resposta do POST create (linha ~628)
- [x] 3.5 Incluir `sequenceCode` na resposta do GET single item (linha ~438)
- [x] 3.6 Incluir `sequenceCode` na resposta do GET list items (linha ~256)
- [x] 3.7 Incluir `sequenceCode` na resposta do PATCH update (linha ~929)

## 4. Frontend — Types compartilhados

- [x] 4.1 Adicionar `sequenceCode: string | null` à interface `Card` (`packages/types/src/index.ts`, linha ~83)
- [x] 4.2 Mapear `sequenceCode: item.sequenceCode ?? null` na função `toCard()` (`packages/types/src/index.ts`, linha ~121)

## 5. Frontend — KanbanCard

- [x] 5.1 Em `apps/web/src/components/KanbanCard.tsx` (linha ~216): substituir `#{card.id.slice(0, 8)}` por exibição condicional de `card.sequenceCode` (com fallback para UUID truncado se null)

## 6. Frontend — Formulários de item

- [x] 6.1 Em `apps/web/src/components/ItemModal.tsx`: adicionar state `sequenceCode`, sincronizar com item, adicionar campo "Código" no formulário (antes do grid type/status), incluir no payload de save
- [x] 6.2 Em `apps/web/src/components/StoryModal.tsx`: mesma lógica — state, campo, save
- [x] 6.3 Em `apps/web/src/components/EpicModal.tsx`: mesma lógica — state, campo, save

## 7. Validação final

- [x] 7.1 Executar `bun run --cwd apps/mcp typecheck && bun run --cwd apps/api typecheck && bun run --cwd apps/web typecheck` e garantir zero erros
- [x] 7.2 Criar item via API sem `sequenceCode` e verificar que o código é gerado automaticamente
- [x] 7.3 Criar item via API com `sequenceCode` duplicado e verificar erro 409
- [x] 7.4 Editar `sequenceCode` via PATCH e verificar persistência
- [x] 7.5 Verificar que o card no Kanban exibe o código corretamente
