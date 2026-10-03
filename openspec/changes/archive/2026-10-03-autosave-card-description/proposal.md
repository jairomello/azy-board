## Why

As descrições de cards (Task, Bug, Subtask) podem ser textos longos e complexos, mas hoje só existem no estado local da `ItemModal` até o usuário clicar em **Salvar**. Um fechamento acidental, refresh, queda de conexão ou crash do navegador descarta todo o texto digitado, sem qualquer recuperação.

## What Changes

- Gravar automaticamente um rascunho da descrição em `localStorage` enquanto o usuário digita na `ItemModal`, com debounce, sem depender de rede nem do clique em Salvar.
- Restaurar o rascunho ao reabrir a mesma modal do mesmo item, exibindo um aviso não bloqueante de "rascunho não salvo recuperado" com ação de descartar.
- Limpar o rascunho do item quando o salvamento é confirmado pelo servidor (incluindo o caminho de conflito otimista tratado).
- Manter as alterações não salvas recuperáveis ao fechar a modal por Cancelar/Escape: o item continua sem persistência no servidor, mas o rascunho local permanece.
- Isolar rascunhos por `itemId` e escopo de projeto/tenant para evitar colisão entre projetos e vazamento de texto entre itens.
- Tratar `localStorage` indisponível ou corrompido de forma defensiva, sem erro visível e sem quebrar a edição.

## Capabilities

### New Capabilities

- `item-description-draft`: rascunho local (localStorage) da descrição de cards, com gravação automática durante a digitação, restauração ao reabrir, descarte manual, limpeza após salvar e fallback resiliente.

### Modified Capabilities

- `card-edit-ui`: o fechamento da modal sem salvar passa a preservar um rascunho local recuperável, e o salvamento bem-sucedido passa a limpar esse rascunho.

## Impact

- **Frontend**: `apps/web/src/components/ItemModal.tsx` (estado `description` e integração do rascunho), novo hook/utilitário de rascunho em `apps/web/src/lib/` ou `apps/web/src/hooks/`, reuso do debounce via `setTimeout` no padrão já existente em `GeneralSettingsSections.tsx`.
- **i18n**: novas chaves de aviso/restauração em `apps/web/src/i18n/locales/{pt-BR,en,es}/common.json` (ou `board.json`).
- **Testes**: testes unitários do utilitário de rascunho (gravação/restauração/limpeza/fallback) e teste de componente da `ItemModal` cobrindo restauração e limpeza.
- **Sem mudança de backend/API**: nenhum endpoint, schema de banco ou ferramenta MCP é alterado; o rascunho é 100% client-side.
- **Fora de escopo**: campos rich text de `StoryModal`/`EpicModal` e notas de checklist (`ChecklistSection`) — a mecanismo é desenhado reutilizável, mas a aplicação inicial cobre a descrição da `ItemModal`.
- **Board ref**: T15 — Salvar automaticamente descrição cards em localstorage (`37b047fe-f33a-4bf2-a618-8de297f2857f`)
