## Context

O EasyBoard é um Kanban board multi-tenant com hierarquia de itens (EPIC → STORY → TASK/BUG → subtasks). Hoje não há como excluir um item pela interface do board — a única forma é via banco de dados diretamente. Os cards também carecem de indicadores de filhos e feedback sobre por que cards pai não são arrastáveis. Os botões de ação têm apenas contorno colorido, o que reduz o destaque visual das ações. Lucide React (v0.460.0) já está instalado no projeto, eliminando a necessidade de novas dependências para ícones.

## Goals / Non-Goals

**Goals:**
- Adicionar botão excluir nos cards com diálogo de confirmação e exclusão em cascata no backend.
- Exibir box informativa na modal de items com filhos explicando a Leaf Rule.
- Exibir indicador de filhos diretos no footer dos cards que possuem subtasks.
- Adicionar ícones Lucide em todos os botões de ação existentes.
- Converter todos os botões de contorno para preenchidos com cores modernas e variadas.

**Non-Goals:**
- Exclusão em lote de múltiplos cards simultaneamente.
- Desfazer (undo) após exclusão.
- Soft-delete ou lixeira de itens.
- Alteração do modelo de dados `ancestry_path` ou da Leaf Rule.
- Suporte a exportação ou auditoria de exclusões.

## Decisions

### D1 — Exclusão em cascata via SQL recursivo no backend

**Decisão:** implementar exclusão com CTE recursiva no SQLite (`WITH RECURSIVE`) para obter todos os descendentes do item e excluí-los em uma única transação, incluindo seus checklists e checklist-items.

**Alternativa considerada:** exclusão em cascata configurada no schema do Drizzle (`onDelete: 'cascade'`). Descartada porque exigiria alterar o schema e gerar nova migration, e o cascade do SQLite só funciona com foreign keys habilitadas explicitamente — configuração que pode não estar ativa em todos os ambientes.

**Rationale:** a CTE recursiva é explícita, testável e não depende de configuração de runtime do SQLite.

---

### D2 — `childrenCount` calculado no momento da query de listagem

**Decisão:** adicionar `childrenCount` como campo calculado na query de listagem de itens do board, usando subquery `COUNT(*)` agrupada por `parentId`, sem persistência no banco.

**Alternativa considerada:** calcular `childrenCount` client-side da mesma forma que `isLeaf` (a partir do conjunto de `parentId`s). Descartada porque requer passar todos os itens para o componente card, aumentando o acoplamento. A subquery é mais direta e performática para o volume típico.

**Rationale:** consistente com a abordagem de `isLeaf` (calculado), mas feito no backend para não inflar o estado client-side.

---

### D3 — Botão excluir visível no hover, com diálogo de confirmação nativo do browser

**Decisão:** o botão excluir (ícone Trash2 do Lucide) aparece no canto superior direito do card ao fazer hover, e ao clicar abre `window.confirm()` antes de executar.

**Alternativa considerada:** diálogo customizado com componente Radix Dialog. Descartada para minimizar escopo — o `window.confirm` já bloqueia a ação acidental sem adicionar componentes novos. Pode ser evoluído depois.

**Rationale:** menor superfície de mudança, sem novos componentes, funcional em todos os contextos.

---

### D4 — Ícones Lucide React (já instalado), sem nova dependência

**Decisão:** usar exclusivamente Lucide React para todos os ícones novos e nos botões existentes. Nenhuma dependência externa nova será adicionada.

**Alternativa considerada:** Font Awesome (pacote npm de ícones baixados). Descartada porque Lucide já está instalado, é tree-shakeable por padrão e tem licença MIT.

---

### D5 — Estilo de botões preenchidos via classes Tailwind, sem criar novo componente

**Decisão:** atualizar as classes Tailwind dos botões existentes nos arquivos afetados diretamente, substituindo variantes de contorno por variantes preenchidas. Paleta: azul primário para ações principais, vermelho para destrutivo, cinza neutro para secundário, verde para confirmar/salvar.

**Alternativa considerada:** criar um componente `<Button variant="filled">` reutilizável. Descartada para não extrapolar o escopo — o projeto não usa shadcn Button de forma centralizada.

## Risks / Trade-offs

- **Exclusão acidental** → Mitigação: diálogo de confirmação (`window.confirm`) obrigatório antes de qualquer exclusão.
- **Cascata silenciosa** → Mitigação: a mensagem de confirmação informa explicitamente que subtasks, checklists e outros filhos serão excluídos.
- **Performance da CTE recursiva em hierarquias profundas** → Mitigação: hierarquia do EasyBoard tem profundidade máxima conhecida (EPIC→STORY→TASK/BUG→subtask); o risco é baixo para o volume esperado.
- **`childrenCount` desatualizado após exclusão** → Mitigação: ao excluir um item, o frontend recarrega a listagem do board (padrão já adotado em outras mutações).
- **Ícones Lucide aumentam bundle** → Mitigação: Lucide é tree-shakeable; apenas os ícones importados explicitamente são incluídos no bundle.
