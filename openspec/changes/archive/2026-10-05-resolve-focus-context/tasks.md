## 1. Contrato e validação

- [x] 1.1 Estender `AssistantScreenSnapshot.focus` em `packages/assistant-contracts/src/index.ts` com `modalPath?: Array<{ itemId; type }>`, `activeEntity?: { kind: 'checklist'|'checklist_item'|'link'|'work_log'|'attachment'; id; parentId? } | null`; documentar `activeItemId` (topo) e `activeTab` (área ativa); manter `schemaVersion = 1`
- [x] 1.2 Atualizar `assistantScreenSnapshotSchema.focus` em `apps/api/src/validation.ts` (strict) com os novos campos opcionais — evitar drift contrato×schema (como no T18)
- [x] 1.3 Definir tipo compartilhado da área do item (alinhado ao `ItemArea` do `ItemModal`) em `packages/ui-contracts` se necessário

## 2. Publicação do foco (web)

- [x] 2.1 Criar store de foco por aba em memória (`apps/web/src/lib/assistantFocusStore.ts`), no padrão do `assistantViewStore`: publicar/limpar/empilhar e assinar mudanças
- [x] 2.2 Em `apps/web/src/components/ItemModal.tsx`, publicar `{ modalPath, activeItemId, activeTab }` a partir de `childStack`/`activeArea`; limpar o nível no unmount
- [x] 2.3 Publicar `activeEntity` a partir dos controles internos (`ChecklistSection`, `ItemLinksArea`, `WorkLogPanel`/`ActivityLogPanel`) quando houver seleção explícita
- [x] 2.4 Publicar o foco no `AssistantPageContext`/`AppShell` e enviá-lo na fotografia

## 3. Fotografia da tela

- [x] 3.1 Estender `SnapshotCaptureInput` e `buildScreenSnapshot` em `apps/web/src/lib/assistantSnapshot.ts` para preencher `focus` (pilha, item em primeiro plano, aba, entidade) em vez do valor fixo
- [x] 3.2 Ajustar `BoardScreen.tsx` para derivar o item em primeiro plano do topo da pilha de modais (não apenas `itemModalId`)

## 4. Resolução no servidor

- [x] 4.1 Incluir `focus` no `compactScreenSnapshot`/`AssistantPromptContext` (`apps/api/src/routes/assistant.ts`), com limites de payload
- [x] 4.2 Fazer `resolveSelectedItem` usar `focus.activeItemId` (topo) com fallback para o `itemId` da mensagem e a modal principal
- [x] 4.3 Expor o alvo resolvido (item + aba + entidade) no contexto do harness para as ferramentas de recurso interno (consumido por T21/T22)
- [x] 4.4 Validar projeto/tenant/acesso do item e do objeto interno do foco antes de usar (referências, nunca permissões)
- [x] 4.5 Instruir o modelo no `AZY_AGENT_SYSTEM_PROMPT` a resolver “este card”/“aqui” pelo foco e a perguntar em ambiguidade

## 5. Ambiguidade e i18n

- [x] 5.1 Implementar a pergunta de ambiguidade quando houver múltiplos candidatos sem seleção explícita (nunca escolher arbitrariamente)
- [x] 5.2 Adicionar rótulos/pergunta em `apps/web/src/i18n/locales/{pt-BR,en,es}/assistant.json`

## 6. Testes

- [x] 6.1 Teste de contrato do snapshot com `focus` (aceita foco, aceita ausência, rejeita foco inválido) em `apps/api/src/validation.screen-snapshot.test.ts`
- [x] 6.2 Teste da resolução do item em primeiro plano: subtarefa aberta sobre o pai → alvo é a subtarefa; sem foco → item da mensagem
- [x] 6.3 Teste de publicação/restauração do foco (empilhar/desempilhar modal) e isolamento por aba
- [x] 6.4 Teste de ambiguidade (múltiplos candidatos → pergunta)

## 7. Verificação e encerramento

- [x] 7.1 Rodar `bun run check` (typecheck + lint + testes + build) e corrigir regressões
- [x] 7.2 Rodar `bun run test:smoke` (fluxo web/API)
- [x] 7.3 Registrar `Board ref: ff23c795-5d92-4218-bdac-0ed3484a5568` nos artefatos da change e confirmar que o card T19 termina em coluna com `baseStatus = DONE` (`complete_task`)
