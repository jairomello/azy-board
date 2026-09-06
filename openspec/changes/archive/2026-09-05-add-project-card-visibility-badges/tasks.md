## 1. Pré-requisito

- [x] 1.1 Confirmar que `add-project-visibility-toggles` foi implementada e arquivada — `GET /projects` devolve `isRestricted` e `isHidden` e a preferência "mostrar projetos ocultos" existe
- [x] 1.2 Registrar que esta change SHALL ser arquivada depois da anterior, pois acrescenta requisitos à capacidade `project-visibility`

## 2. Componente de badges

- [x] 2.1 Criar `apps/web/src/components/ProjectVisibilityBadges.tsx` com a função interna `VisibilityBadge` (ícone, texto, classes e `Tooltip`)
- [x] 2.2 Definir as props `{ isRestricted: boolean; isHidden: boolean }` e retornar `null` quando ambos forem falsos
- [x] 2.3 Implementar o badge "Restrito" com ícone `Lock` e tom âmbar (`bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800`)
- [x] 2.4 Implementar o badge "Oculto" com ícone `EyeOff` e tom neutro (`bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700`)
- [x] 2.5 Envolver cada badge no `Tooltip` de `src/components/ui/Tooltip.tsx` e marcar o ícone com `aria-hidden="true"`
- [x] 2.6 Normalizar as props com `Boolean(...)` para tolerar payload sem os campos

## 3. Integração no card de projeto

- [x] 3.1 Atualizar o tipo `Project` em `ProjectsPage.tsx` com `isRestricted` e `isHidden`
- [x] 3.2 Renomear o grupo do card de `group` para `group/card` e atualizar `group-hover:bg-primary/20` e `group-hover:text-primary` para `group-hover/card:*`
- [x] 3.3 Aplicar `border-dashed opacity-70 hover:opacity-100 focus-visible:opacity-100` no card quando `p.isHidden`
- [x] 3.4 Reorganizar o rodapé em `mt-4 flex items-center gap-2 flex-wrap`, mantendo o texto "Abrir board"
- [x] 3.5 Renderizar `<ProjectVisibilityBadges isRestricted={p.isRestricted} isHidden={p.isHidden} />` no rodapé, depois de "Abrir board"
- [x] 3.6 Conferir que a faixa de gradiente do topo permanece inalterada nos cards ocultos

## 4. Internacionalização

- [x] 4.1 Adicionar `projectVisibility.restricted` e `projectVisibility.hidden` em `common.json` de `pt-BR`, `en` e `es`
- [x] 4.2 Adicionar `projectVisibility.restrictedTooltip` e `projectVisibility.hiddenTooltip` nos três idiomas
- [x] 4.3 Usar `useTranslation` no componente de badges, sem texto hardcoded

## 5. Qualidade

- [x] 5.1 Criar `apps/web/src/project-visibility-badges-contract.test.ts` no padrão de leitura de fonte, cobrindo: presença/ausência de cada badge, ícones `Lock` e `EyeOff`, classes de cor nos dois temas, `border-dashed` e `opacity-70` no card oculto, e o grupo nomeado `group/card`
- [x] 5.2 Testar o componente de badges por props (restrito, oculto, ambos, nenhum, campos ausentes) em `apps/web/src/projectVisibilityBadges.test.ts`
- [x] 5.3 Rodar `bun run typecheck` e `bun test` sem erros
- [x] 5.4 Conferir manualmente o hover do card, o tooltip isolado e o contraste nos temas claro e escuro
