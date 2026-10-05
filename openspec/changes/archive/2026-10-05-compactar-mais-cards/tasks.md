## 1. Preparação

- [x] 1.1 Medir as regiões do card em Compacta (topo, breadcrumb, título, etiquetas, progresso, rodapé, padding/gaps) e confirmar a meta de redução
- [x] 1.2 Definir os ganchos de classe (`kanban-card-title`, `kanban-card-breadcrumb`) e as regras escopadas em `.density-compact`

## 2. Compactação dos cards no estado Compacta

- [x] 2.1 Adicionar os ganchos de classe e `title={card.title}` no `KanbanCard.tsx`, sem alterar o estado Confortável
- [x] 2.2 Atualizar `styles/globals.css` sob `.density-compact`: ocultar o breadcrumb, limitar o título a 1 linha e reduzir gap (~0,25 rem) e padding vertical (~0,3 rem)
- [x] 2.3 Confirmar que topo, etiquetas, progresso e rodapé permanecem visíveis e que ações/edição/arraste seguem funcionando

## 3. Testes e verificação

- [x] 3.1 Contrato estrutural `[CONTRATO-ESTRUTURAL]`: `.density-compact` oculta o breadcrumb e limita o título a 1 linha, mirando ganchos presentes no `KanbanCard`
- [x] 3.2 Medir no navegador (Confortável inalterado; Compacta ~142 px) e validar claro/escuro
- [x] 3.3 Rodar `bun run check` (typecheck + lint + testes + build) e corrigir apontamentos
- [x] 3.4 Rodar `bun run test:smoke` e conferir `check:bundle` (chunk `BoardPage`)

## 4. Encerramento

- [x] 4.1 Registrar o resultado no card T34 do Azy Board (Board ref: `8a640c8f-ce9e-416b-aad6-8708d970321f`) com `create_item_log`
- [x] 4.2 Mover o card T34 para `Concluídas` com `complete_task` e confirmar `status = DONE` no board real
