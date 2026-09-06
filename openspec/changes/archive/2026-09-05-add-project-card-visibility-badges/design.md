## Context

A tela de projetos (`apps/web/src/pages/ProjectsPage.tsx`) renderiza cada projeto como um card com: faixa de gradiente no topo, bloco com a inicial do nome, ações de editar/excluir (somente `ADMIN`), nome, descrição (`line-clamp-2 min-h-8`) e o link "Abrir board". Não existe hoje nenhum componente de badge no projeto — o único elemento visual parecido é um `<span>` com `rounded-full bg-muted` na lista de sprints da `SettingsPage`. O único componente de UI disponível em `src/components/ui/` é `Tooltip.tsx`.

Com a change `add-project-visibility-toggles`, o payload de `GET /projects` passa a trazer `isRestricted` e `isHidden`, e o usuário pode receber cards ocultos quando liga a preferência "mostrar projetos ocultos". Esta change é puramente de apresentação: consome esses dois campos e não altera contrato de API nem schema.

## Goals / Non-Goals

**Goals:**

- Tornar imediatamente identificável, no card, que um projeto é restrito ou oculto.
- Explicar o significado de cada sinalizador sem exigir navegação para as configurações do projeto.
- Reforçar que o card oculto está fora da listagem padrão por meio de tratamento visual do próprio card.
- Funcionar nos temas claro e escuro e preservar o layout dos cards sem sinalização.

**Non-Goals:**

- Sinalizar visibilidade em outras superfícies (header do board, breadcrumb, listas suspensas de projeto).
- Criar tokens de cor novos em `globals.css` ou alterar a spec `theming`.
- Alterar backend, schema ou contrato de `GET /projects`.
- Reordenar ou agrupar cards ocultos no grid.

## Decisions

### Componente dedicado `ProjectVisibilityBadges`

Criar `apps/web/src/components/ProjectVisibilityBadges.tsx` exportando `ProjectVisibilityBadges` (que decide quais badges renderizar) e a função interna `VisibilityBadge` (que renderiza um badge). O componente recebe `{ isRestricted, isHidden }` e retorna `null` quando ambos são falsos.

*Alternativa considerada:* escrever os `<span>` inline no `map` de `ProjectsPage`. Rejeitada porque o card já tem 60 linhas de JSX e a regra do projeto é preferir funções pequenas e nomeadas a blocos inline longos.

*Alternativa considerada:* criar um `Badge` genérico em `src/components/ui/`. Rejeitada por enquanto: não há segundo consumidor, e um componente genérico exigiria API de variantes sem necessidade.

### Dois badges independentes e ortogonais

| Sinalização | Ícone (lucide) | Texto | Tom |
|---|---|---|---|
| Restrito | `Lock` | "Restrito" | âmbar: `bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800` |
| Oculto | `EyeOff` | "Oculto" | neutro: `bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700` |

Ambos compartilham a estrutura `inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium`. O ícone recebe `aria-hidden="true"` e o texto é conteúdo visível — portanto a informação nunca depende só de ícone ou só de cor.

*Alternativa considerada:* reutilizar os tokens semânticos `status-*` (`--status-review`, `--status-blocked`, etc.). Rejeitada porque eles já carregam o significado de **situação de item** (progresso/revisão/concluído/bloqueado) e reaproveitá-los para visibilidade criaria ambiguidade. O padrão do projeto para cores pontuais é o par explícito claro/escuro da paleta do Tailwind — mesmo padrão de `TreeViewPage`.

*Alternativa considerada:* badge apenas com ícone e tooltip. Rejeitada porque ícone puro é ambíguo em densidade alta e não é legível por leitor de tela sem texto.

### Tooltip existente, com grupo nomeado no card

Cada badge é envolvido pelo `Tooltip` de `src/components/ui/Tooltip.tsx`, com rótulos vindos do i18n ("Somente membros da equipe e o gerente visualizam este projeto" / "Este projeto não aparece na listagem por padrão").

O card usa `group` para o hover da inicial e da seta. Como o `Tooltip` também declara `group` e revela seu conteúdo com `group-hover:opacity-100`, e o seletor `.group:hover` do Tailwind casa com **qualquer** ancestral com a classe, passar o mouse no card revelaria todos os tooltips dos cards simultaneamente.

Correção: renomear o grupo do card para `group/card` e atualizar as duas dependências internas (`group-hover:bg-primary/20`, `group-hover:text-primary`) para `group-hover/card:*`. O Tailwind 3.4 suporta grupos nomeados, e assim o `group` do `Tooltip` volta a casar apenas com o seu próprio wrapper.

*Alternativa considerada:* usar o atributo nativo `title` em vez do `Tooltip`. Rejeitada por inconsistência visual com o resto da aplicação e por `title` não ser anunciado de forma confiável.

*Alternativa considerada:* revelar o tooltip por `focus-visible` também. Deixado de fora porque o badge não é focável (não é interativo) — a explicação completa fica disponível na seção "Visibilidade do projeto" das configurações.

### Badges na linha de rodapé, não em linha própria

Os badges são renderizados dentro do rodapé do card, ao lado do texto "Abrir board", em um `div.mt-4.flex.items-center.gap-2.flex-wrap`. Assim o card **não muda de altura** quando passa a exibir sinalização, evitando que o grid fique irregular entre cards com e sem badge. A ordem é sempre Restrito e depois Oculto.

*Alternativa considerada:* linha exclusiva entre a descrição e o rodapé. Rejeitada porque aumentaria ~20px a altura apenas dos cards sinalizados.

### Tratamento do card oculto

O card de projeto oculto recebe `border-dashed` (no lugar de `border` sólido) e `opacity-70`, restaurada integralmente em `hover:opacity-100` e `focus-visible:opacity-100`. A faixa de gradiente do topo permanece inalterada, para o card continuar reconhecível como card de projeto.

*Alternativa considerada:* aplicar o mesmo tratamento ao card restrito. Rejeitada para não haver dois significados visuais concorrentes: o tracejado passa a significar especificamente "fora da listagem padrão".

### Tolerância a payload sem os campos

O componente converte com `Boolean(p.isRestricted)` / `Boolean(p.isHidden)`. Um card vindo de cache antigo ou de um resultado de mutação do assistente sem os campos simplesmente não exibe badge, em vez de quebrar a renderização.

## Risks / Trade-offs

- **Tooltip vazando para outros cards** → mitigado com o grupo nomeado `group/card` no card.
- **Dois badges juntos poluírem cards pequenos** → aceito: é um caso raro (restrito **e** oculto) e o `flex-wrap` garante quebra de linha em telas estreitas.
- **Contraste do âmbar no modo claro** → usar `text-amber-700` sobre `bg-amber-100`, combinando claro/escuro suficiente para AA; conferir nos dois temas antes de fechar.
- **Divergência de nomenclatura entre i18n e labels do backend** → os rótulos são todos do frontend, em PT-BR/EN/ES, sem impacto em API.
- **Dependência de ordem de arquivamento** → esta change acrescenta requisitos à capacidade `project-visibility`; se for arquivada antes de `add-project-visibility-toggles`, o arquivo de spec ainda não existirá. Mitigação: registrar a ordem no `proposal.md` e no `tasks.md`.

## Migration Plan

1. Criar `ProjectVisibilityBadges.tsx` com `VisibilityBadge` e os dois `Tooltip`.
2. Ajustar `ProjectsPage`: tipo `Project`, grupo nomeado, classes condicionais do card oculto e rodapé com os badges.
3. Adicionar as quatro chaves de i18n em `pt-BR`, `en` e `es`.
4. Criar o contrato de UI e rodar `bun run typecheck` + `bun test`.
5. Conferir manualmente o contraste e o hover nos temas claro e escuro.
6. **Rollback:** remover o uso do componente no card; como nada no backend depende dele, a reversão é integral e sem resíduos de dados.

## Open Questions

Nenhuma questão bloqueante. Fica registrado que sinalizar visibilidade fora da tela de projetos (header do board, breadcrumb, seletor de projeto) não faz parte desta change e pode ser proposto depois.
