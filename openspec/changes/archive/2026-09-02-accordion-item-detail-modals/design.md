## Context

As modais atuais têm campos operacionais, rich text, subtasks, checklists, histórico e ações no mesmo fluxo vertical. `ItemModal` já suporta modais filhas empilhadas e checklists com progresso; `StoryModal` usa dois editores ricos; `EpicModal` possui formulário menor. O novo padrão deve ser compartilhado, mas permitir seções específicas por tipo.

## Goals / Non-Goals

**Goals:**

- Reduzir densidade visual sem esconder a existência dos campos.
- Dar acesso imediato ao primeiro grupo de informações e controle global de expansão.
- Preservar valores em edição ao alternar seções ou abrir o editor rico expandido.
- Exibir resumos acionáveis nas barras, principalmente progresso de checklist.

**Non-Goals:**

- Alterar a ordem ou semântica dos campos de domínio.
- Persistir estado de accordion no backend ou no `localStorage` nesta etapa.
- Mudar contratos de API, regras de validação ou ações de salvamento.

## Decisions

### Componente compartilhado

Criar `AccordionSection` e `AccordionToolbar` compartilhados. Cada seção recebe `id`, título, resumo opcional, conteúdo e estado aberto. O estado ficará local à modal; modais novas iniciam com apenas o primeiro painel aberto.

### Estado de expansão

Usar um `Set<string>` de IDs abertos e atualizações funcionais. `Expandir tudo` abre todos os IDs disponíveis; `Recolher tudo` limpa o conjunto. Seções adicionadas dinamicamente, como checklists carregados, entram fechadas sem alterar as seções que o usuário já abriu.

### Resumos

O cabeçalho mostra informação compacta e não editável: quantidade de campos preenchidos, status, contagem de subtasks e, para cada checklist, `X/Y concluídos` com barra de progresso. O resumo não substitui o conteúdo e não depende apenas de cor.

### Acessibilidade e modais empilhadas

Cada trigger será um `button` com `aria-expanded`, `aria-controls` e foco visível. O conteúdo usará `role=region` e label associada. A expansão de rich text continuará abrindo em z-index superior; fechar retorna à modal de origem com valores preservados. Escape deve fechar o nível superior primeiro.

## Risks / Trade-offs

- **Usuário pode não perceber campos recolhidos** → título, ícone, chevron e resumo permanecem sempre visíveis.
- **Muitos accordions aumentam navegação** → toolbar global e primeira seção aberta reduzem esforço.
- **Resumo pode ficar desatualizado** → derivar do mesmo estado controlado do formulário e dos checklists.
- **Modal filha perder foco** → preservar stack atual e aplicar foco ao trigger/fechamento do nível superior.

## Migration Plan

1. Criar componentes e testes isolados.
2. Integrar em `ItemModal`, cobrindo Task, Bug e Subtask.
3. Integrar em `StoryModal` e `EpicModal`.
4. Adicionar resumos, traduções e validação de acessibilidade.
5. Rollback: remover a camada de accordion, mantendo campos e payloads anteriores.

## Open Questions

Nenhuma questão bloqueante. O estado aberto não será persistido entre aberturas; cada nova modal seguirá o padrão de primeira seção aberta.
