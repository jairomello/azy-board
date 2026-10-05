## 1. Preparação

- [x] 1.1 Confirmar a regressão (`.density-compact .kanban-card-content` não casa mais com o `KanbanCard` atual) e mapear os pontos: `KanbanCard.tsx`, `styles/globals.css`, `BoardCommandBar.tsx`, `BoardContext.tsx`, `ActiveFilterChips.tsx`, `BoardScreen.tsx`, `AppShell.tsx`
- [x] 1.2 Definir os rótulos i18n do resumo de filtros nos três locales (a densidade já é traduzida)

## 2. Correção da densidade dos cards

- [x] 2.1 Reintroduzir o gancho de densidade (`kanban-card-content`) na estrutura atual do `KanbanCard.tsx`, sem alterar as regiões do card
- [x] 2.2 Atualizar as regras `.density-compact` em `styles/globals.css` para a estrutura nova (padding vertical e espaçamento entre regiões via `> * + *`), tornando o efeito visível
- [x] 2.3 Validar que o estado Compacta reduz a altura por card sem esconder ícone, código, breadcrumb, título, etiquetas, progresso e rodapé

## 3. Cabeçalho super compacto no estado Compacta

- [x] 3.1 Reduzir altura e margem da barra de controles no estado Compacta (`BoardCommandBar.tsx` / wrapper do `AppShell.tsx`)
- [x] 3.2 Substituir o painel de progresso por um indicador fino (percentual e contagem) e ocultar a faixa do `BoardContextHeader` no estado Compacta
- [x] 3.3 Resumir a linha de filtros ativos em um controle na barra, abrindo a lista completa com remoção individual (reutilizando `ActiveFilterChips`)
- [x] 3.4 Reduzir os gaps do conteúdo no estado Compacta (`BoardScreen.tsx`)
- [x] 3.5 Garantir quebra de linha dos controles sem corte e sem rolagem horizontal em larguras pequenas

## 4. Testes e verificação

- [x] 4.1 Contrato estrutural `[CONTRATO-ESTRUTURAL]`: o CSS `.density-compact` mira um gancho presente no `KanbanCard` atual; o estado Compacta altera barra/progresso/resumo; paridade i18n do resumo
- [x] 4.2 Rodar `bun run check` (typecheck + lint + testes + build) e corrigir apontamentos
- [x] 4.3 Rodar `bun run test:smoke` e validar visualmente (claro/escuro, larguras pequenas) alternando Confortável/Compacta — cards e cabeçalho
- [x] 4.4 Conferir `check:bundle` (orçamento do chunk `BoardPage`)

## 5. Encerramento

- [x] 5.1 Registrar o resultado no card T33 do Azy Board (Board ref: `4741c2c8-e3bb-4a10-8327-aab11f9baf1d`) com `create_item_log`
- [x] 5.2 Mover o card T33 para `Concluídas` com `complete_task` e confirmar `status = DONE` no board real
