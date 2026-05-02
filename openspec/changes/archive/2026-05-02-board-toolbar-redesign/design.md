## Context

A toolbar atual é uma linha horizontal contínua sem agrupamento semântico. Todos os controles usam texto, tornando difícil a distinção visual entre toggles de estado, filtros de conteúdo e ações. A adição do filtro por squad (change `board-squad-filter`) agravará o problema de espaço. O redesign deve ser puramente visual/estrutural — zero mudança em lógica de filtros ou criação de cards.

**Layout atual (da esquerda para direita):**
```
[Mostrar subtasks] [Histórias no board] | [Expandir tudo] [Recolher tudo] | Módulo▼ Responsável▼ [Tarefa][Bug] [Ocultar épicos vazios] [Arquivados]   [Novo Épico][Nova História][Nova Task][Novo Bug]
```

**Layout proposto:**
```
[👁][📖] | [⬇][⬆] | Squad▼ Módulo▼ Responsável▼ [Tarefa][Bug] | [🚫][🗄]   [+Épico][+História][+Task][+Bug]
```

## Goals / Non-Goals

**Goals:**
- Liberar ~480px na toolbar sem remover funcionalidades
- Estabelecer 3 zonas visuais com separadores: Visualização / Filtros / Ações de conteúdo
- Padronizar tooltip de 500ms para todos os botões ícone
- Preparar espaço para filtro de squad e futuras adições

**Non-Goals:**
- Mover a toolbar para duas linhas ou menu colapsável
- Alterar lógica de filtros, toggles ou criação de cards
- Criar um sistema de tooltip de terceiros (usar implementação CSS simples)

## Decisions

**Tooltip via `title` nativo vs componente custom**
`title` nativo tem delay não controlável e aparência inconsistente entre OS. Decisão: implementar um componente `<Tooltip>` leve com `group-hover` do Tailwind e `delay-500`, inline no arquivo de `BoardFilters` ou como componente separado em `components/ui/Tooltip.tsx`. Sem dependência nova.

**Separadores visuais**
Usar `<div className="w-px h-5 bg-border mx-1 flex-shrink-0" />` — simples, consistente com o resto da UI.

**Ícones escolhidos (todos do lucide-react já instalado)**
| Controle | Ícone |
|---|---|
| Mostrar subtasks | `Layers` |
| Histórias no board | `LayoutList` |
| Expandir tudo | `ChevronsDown` |
| Recolher tudo | `ChevronsUp` |
| Ocultar épicos vazios | `EyeOff` / `Eye` (toggle) |
| Arquivados | `Archive` (já existente) |

**Botões de criação**
Labels encurtadas para caber melhor: `+ Épico`, `+ História`, `+ Task`, `+ Bug`. Cores e ícones mantidos.

**Estado ativo dos toggles ícone**
Quando ativo: `bg-primary/10 text-primary border-primary/30`. Quando inativo: `text-muted-foreground hover:text-foreground`. Consistente com o padrão de pills de filtro existente.

## Risks / Trade-offs

- [Risco] Ícones sem label podem não ser auto-explicativos para usuários novos.  
  **Mitigação**: tooltip com delay 500ms e texto descritivo resolve o problema de discoverability sem poluir visualmente.

- [Trade-off] Usuários familiarizados com os labels atuais precisarão de adaptação.  
  **Decisão aceita**: a densidade de informação e a escalabilidade justificam o custo de curva de aprendizado mínima.
