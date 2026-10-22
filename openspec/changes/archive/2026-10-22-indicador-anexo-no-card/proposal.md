# Proposal

## Why

O card do Kanban é o resumo operacional do item e já exibe os outros agregados — subtarefas, dependências, checklist, tokens e pontos — mas não tem nenhum indicador de anexo. Quem olha o board não sabe que o card tem arquivos sem abrir o modal do item, e o padrão "clipe + contador" já existe no produto (aba "Todos os anexos" do Planejamento do projeto), só não onde ele mais serve.

## What Changes

- O card do board passa a exibir um **clipe com o contador de anexos**, ao lado dos indicadores de subtarefa e dependência, **apenas quando o card tem pelo menos um anexo** (omitido quando zero, como os demais indicadores do rodapé).
- A projeção do board (`GET /projects/:projectId/items`) passa a expor a contagem de anexos por item, derivada de uma única leitura por projeto já existente (`listAttachmentsByProject`), sem consulta por item.
- A contagem **não é exposta quando os anexos estão desabilitados no tenant** — o indicador simplesmente não aparece, sem que o cliente precise consultar o toggle.
- A aba "Anexos" do modal do item **não muda** (continua com o clipe sem contador): pôr número ali exigiria subir para o `ItemModal` a lista que hoje é carregada dentro do `AttachmentsArea`.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `file-attachments`: novo requisito de indicador de anexos no card do board, com o contador e a condição de exibição (só quando houver anexo e apenas com a capacidade habilitada no tenant).

## Impact

- Código: `apps/api/src/routes/items.ts` (projeção do board), `apps/web/src/components/KanbanCard.tsx` (contrato `CardData` e indicador no rodapé), `apps/web/src/i18n/locales/{pt-BR,en,es}/board.json`.
- Consumidores do card: `apps/web/src/features/board/components/BoardColumns.tsx` e `BoardScreen.tsx` (pré-visualização do card) herdam o indicador sem alteração.
- Sem migração de banco, sem mudança de contrato HTTP incompatível (campo novo e aditivo) e sem nova dependência.
- `Board ref: 34e8d51f-a541-4853-a91e-9873d47c31a4` (card T84 no Azy Board).
