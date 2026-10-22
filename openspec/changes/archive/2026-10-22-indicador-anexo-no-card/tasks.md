# Tasks

## 1. Projeção do board (API)

- [x] 1.1 Expor `attachmentCount` por item em `GET /projects/:projectId/items` (`apps/api/src/routes/items.ts`), derivado de `persistence.files.listAttachmentsByProject` agrupada por `itemId` no mesmo padrão do `childrenCountMap`, com o comentário `// [TENANT]` no ponto de resolução de tenant — verificado por teste de integração: card com 2 anexos retorna `attachmentCount: 2`
- [x] 1.2 Não expor a contagem quando `persistence.attachmentSettings.get(tenantId)` indicar capacidade desabilitada, com `// [TENANT]` no ponto de leitura do habilitador — verificado por teste de integração: tenant com anexos desabilitados não traz o campo em nenhum card
- [x] 1.3 Garantir que a contagem não introduz consulta por item — verificado por teste que conta as chamadas ao port de arquivos no carregamento do board (uma por request, independente da quantidade de cards)

## 2. Indicador no card (web)

- [x] 2.1 Adicionar `attachmentCount?: number | null` ao `CardData` em `apps/web/src/components/KanbanCard.tsx` — verificado por `bun run --cwd apps/web typecheck`
- [x] 2.2 Renderizar `Paperclip` + contador no rodapé do card, ao lado dos indicadores de subtarefa e dependência e **omitido quando zero ou ausente**, no mesmo formato do bloco de `dependencyCount` — verificado por teste de componente: mostra o número com anexos e não renderiza nada sem anexos
- [x] 2.3 Traduzir os rótulos em pt-BR/en/es com `title` e `aria-label` informando a quantidade de anexos — verificado por `bun run check:i18n` e por asserção de acessibilidade no teste de componente

## 3. Verificação integrada

- [x] 3.1 Rodar `bun run check` (typecheck + lint + testes + build) e `bun run check:bundle` para confirmar que o ícone acrescentado ao `KanbanCard` não estourou o orçamento de bundle do board
- [x] 3.2 Conferir no board em execução que o card com anexos mostra clipe + contador, que o card sem anexos não mostra indicador e que a aba "Anexos" do modal do item permanece inalterada

## Workflow follow-up

- Ao iniciar a implementação, mover o card **T84** para `Fazendo` e reivindicá-lo se estiver sem responsável (`claim_task`).
- Fechar o card **T84** com `complete_task` e confirmar no board real que ele está em coluna com `baseStatus = DONE` — encerrar a change não encerra o card.
- Arquivar a change após o sync da delta para `openspec/specs/file-attachments/` e conferir o resultado em `openspec/changes/archive/`.
