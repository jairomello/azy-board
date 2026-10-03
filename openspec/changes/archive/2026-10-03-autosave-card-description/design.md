## Context

A `ItemModal` (`apps/web/src/components/ItemModal.tsx`) mantém a descrição em estado local (`useState(item.description ?? '')`, L179) sincronizado com o item via `useEffect` em `item.id` (L263). O rich text (`RichTextEditor`) entrega Markdown por `onChange` (L393) e nada é persistido até o usuário clicar em **Salvar** (`handleSave`, L315-342), que chama `onSave(...)` → `BoardScreen.handleModalSave` (L555) → `PATCH /projects/:projectId/items/:itemId`. Um fechamento acidental, refresh, perda de conexão ou crash descarta todo o texto digitado.

Não existe helper genérico de `localStorage` nem hook de debounce no frontend; o padrão vigente é leitura/escrita direta e defensiva em `useState`/`useEffect`, com chaves no formato `<domínio>:<escopo>` (ex.: `board-filters:<projectId>`). O único debounce existente é um `setTimeout` de 800 ms em `GeneralSettingsSections.tsx` (L129).

A descrição de item é validada na API com limite de 20 000 caracteres (`validation.ts`, `optionalText(20_000)`), o que cabe folgado em uma chave de `localStorage`.

## Goals / Non-Goals

**Goals:**
- Gravar automaticamente a descrição em `localStorage` durante a digitação, sem depender de rede ou do clique em Salvar.
- Restaurar o rascunho ao reabrir a mesma modal do mesmo item, com aviso não bloqueante e ação de descartar.
- Limpar o rascunho após salvamento confirmado pelo servidor e garantir que falha de save (incluindo conflito 409) preserve o rascunho.
- Isolar rascunhos por projeto e item, e tratar `localStorage` indisponível/corrompido sem erro visível.
- Desenhar o mecanismo como utilitário reutilizável, testável isoladamente.

**Non-Goals:**
- Não alterar backend, schema de banco, API ou ferramentas MCP — o rascunho é 100% client-side.
- Não aplicar, nesta change, a `StoryModal`/`EpicModal` (persona/goal/benefit/critérios/notas) nem às notas de `ChecklistSection`; o utilitário é desenhado para extensão futura.
- Não rascunhar itens novos (`item.id === '__new__'`), que ainda não têm identidade estável.
- Não sincronizar rascunho entre abas/usuários em tempo real nem versionar conflito de rascunho com edição remota.
- Não substituir o botão Salvar nem tornar a edição "auto-persistida" no servidor.

## Decisions

### Decisão 1: Armazenamento em `localStorage` com chave escopada por projeto e item

**Escolha:** chave `item-draft:${projectId}:${itemId}:description`, valor JSON `{ value: string, base: string, updatedAt: string }`, em que `value` é o Markdown do rascunho, `base` é a descrição do servidor no momento da gravação e `updatedAt` é o ISO timestamp da última edição. `base` permite decidir se o rascunho é redundante (igual ao servidor) sem consultar nada extra.

**Alternativas consideradas:**
- **`sessionStorage`:** descartado — não sobrevive a fechar/reabrir o navegador, que é justamente um dos cenários de perda citados.
- **IndexedDB:** overkill para um único campo textual e sem precedente no projeto.
- **Chave global `item-draft:${itemId}`:** descartado — o escopo por projeto combina com a convenção existente e evita qualquer colisão entre tenants/projetos.
- **Persistir no servidor automaticamente:** exigiria endpoint, validação e concorrência; contraria o "sem mudança de backend" e amplia o risco.

### Decisão 2: Utilitário puro + integração local na `ItemModal`

**Escolha:** criar `apps/web/src/lib/itemDraft.ts` com funções puras `itemDraftKey`, `readItemDraft`, `writeItemDraft` e `clearItemDraft`, todas defensivas (`try/catch`, `JSON.parse` guardado, tratamento de `QuotaExceededError`). A `ItemModal` importa essas funções e coordena o ciclo com `useEffect`/refs. Um hook dedicado só se justificar se mais de uma modal reutilizar o mecanismo, o que fica fora desta change.

**Alternativas consideradas:**
- **Hook `useLocalStorage` genérico:** descartado por ora — o projeto não tem o helper, e um utilitário específico com semântica de rascunho (base, descarte, limpeza) é mais simples de testar e entender.
- **Estado global (Zustand/context):** não há store de UI consolidada; adiciona dependência conceitual sem ganho.

### Decisão 3: Debounce trailing de 800 ms e marca de hidratação

**Escolha:** gravar o rascunho em `useEffect` sobre `description`, com debounce trailing de 800 ms (mesmo valor do precedente em `GeneralSettingsSections.tsx`) usando `setTimeout`+`clearTimeout` em ref. Uma flag `draftHydratedRef` é marcada como `true` somente depois de aplicar a restauração/estado inicial, para que a montagem e o reset por `item.id` não gravem o valor do servidor como rascunho.

**Rationale:** evita escritas a cada tecla e evita criar um "rascunho" idêntico ao servidor logo ao abrir um item limpo (o que dispararia o banner indevidamente).

### Decisão 4: Semântica de restauração e descarte

Na sincronização por `item.id`, a modal lê o rascunho:
- Se não existe → usa `item.description`.
- Se existe e `draft.value === item.description` → rascunho redundante, remove silenciosamente e usa `item.description`.
- Se existe e difere → carrega `draft.value` no editor e exibe um banner não bloqueante ("Rascunho não salvo recuperado") com a ação **Descartar rascunho**, que remove a chave e volta para `item.description`.

**Alternativas consideradas:**
- **Sempre perguntar em diálogo modal:** interrompe o fluxo; o banner inline é suficiente e menos intrusivo.
- **Sobrescrever direto sem aviso:** o usuário pode não perceber que está vendo um rascunho antigo.

### Decisão 5: Limpeza no salvamento confirmado e preservação em falha

`handleSave` limpa o rascunho logo após `await onSave(...)` resolver com sucesso e antes de `onClose()`. Como a implementação atual engole o erro no `catch` sem re-lançar, a limpeza fica estritamente no caminho de sucesso; falha de save (validação ou conflito `409` tratado em `BoardScreen.handleModalSave`) mantém o rascunho intacto para nova tentativa. Fechar por Cancelar/Escape mantém o rascunho.

### Decisão 6: Fallback resiliente e privacidade

Todas as operações de storage são envolvidas em `try/catch`; `localStorage` indisponível (modo privado, `SecurityError`) ou JSON inválido resultam em "sem rascunho", sem erro visível e sem bloquear a edição. Como o produto é multi-tenant e a descrição pode conter conteúdo sensível, as chaves de rascunho (`item-draft:`) são purgadas no logout do usuário para não deixar texto de trabalho no navegador de máquina compartilhada.

## Risks / Trade-offs

- **[Risco] Rascunho local divergir de edição remota** (agente/outro usuário altera a descrição enquanto há rascunho) → o rascunho é sempre restaurado com banner explícito; ao salvar, a concorrência otimista (`expectedUpdatedAt`) pode retornar `409`, e nesse caso o rascunho é preservado. Resolução visual do conflito fica fora do escopo.
- **[Risco] Texto sensível retido em `localStorage`** → limpeza no logout e no salvamento; escopo por projeto/item reduz exposição. Risco residual: máquina compartilhada sem logout.
- **[Risco] `QuotaExceededError`** → cada rascunho é limitado pelo teto de 20 000 caracteres da descrição; falha de escrita é silenciosa e não quebra a edição. Se houver muitos rascunhos acumulados, podem ser adicionados TTL/limpeza oportunista em iteração futura.
- **[Trade-off] Só a descrição da `ItemModal`** → atende o card (Task/Bug/Subtask) e mantém a mudança pequena; campos de `StoryModal`/`EpicModal` e notas de checklist ficam para mudança futura usando o mesmo utilitário.
- **[Trade-off] Sem sincronização entre abas** → duas abas no mesmo item podem sobrescrever o mesmo rascunho; aceitável nesta iteração (não há requisito de edição concorrente entre abas).

## Migration Plan

- Sem migração de dados: as chaves `item-draft:` são novas e ausentes em instalações existentes; estado antigo não é afetado.
- Rollback: reverter o código remove a leitura/escrita; chaves residuais são inertes (podem ser limpas manualmente ou por uma futura rotina de expurgo).

## Open Questions

- Estender o utilitário para `StoryModal`/`EpicModal` e notas de checklist na sequência (fora do escopo atual).
- Adicionar TTL/limpeza automática de rascunhos órfãos de itens excluídos — decidir em iteração futura.
