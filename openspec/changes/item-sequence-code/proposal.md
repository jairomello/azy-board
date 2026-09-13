## Why

Items no Azy Board são identificados apenas pelo UUID (id), que é ilegível e difícil de referenciar em conversas da equipe. "O card a1b2c3d4..." não é amigável. Precisamos de um identificador visual curto e humano (ex: T1, B3, S2) que facilite a comunicação e a referência rápida a cards e itens dentro de um projeto.

## What Changes

- Adicionar coluna `sequence_code` na tabela `items` (string, nullable)
- Criar índice único composto `(tenant_id, project_id, sequence_code)` para garantir unicidade
- Gerar automaticamente o próximo código disponível na criação de itens (prefixo por tipo + sequencial: E1, S1, T1, B1)
- Permitir edição manual do código via API (com validação de unicidade)
- Exibir o código no card do Kanban (substituindo o UUID truncado)
- Adicionar campo editável no formulário de item (ItemModal, StoryModal, EpicModal)
- Retornar `sequenceCode` em todas as respostas da API de itens

## Capabilities

### New Capabilities

- `item-sequence-code`: Identificador visual sequencial por tipo e projeto, gerado automaticamente, editável pelo usuário, único por projeto

### Modified Capabilities

- `unified-item-model`: Novo campo `sequence_code` no schema de items, novo índice único
- `card-creation-ui`: Campo de código no formulário de criação/edição de itens
- `card-management`: Exibição do código no card do Kanban

## Impact

- **Backend**: Schema Drizzle (`schema.ts`), rotas de items (`items.ts`), validação Zod (`validation.ts`), migration SQLite
- **Frontend**: `ItemModal.tsx`, `StoryModal.tsx`, `EpicModal.tsx`, `KanbanCard.tsx`, tipos compartilhados (`packages/types/`)
- **MCP**: Sem mudança necessária (geração automática no backend)
- **Banco**: Nova coluna nullable + índice único (migration sem dados existentes afetados)
- **Breaking**: Nenhum. Campo nullable, items existentes continuam funcionando sem código
