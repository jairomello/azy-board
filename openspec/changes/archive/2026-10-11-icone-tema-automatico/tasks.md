# Tasks

## 1. Botão de tema do header no modo automático

- [x] 1.1 Em `apps/web/src/components/ThemeToggle.tsx`, ler `user?.autoThemeByTime` e, quando verdadeiro, aplicar `disabled` ao botão e exibir o ícone `SunMoon` (lucide-react), mantendo `Moon`/`Sun` no modo manual; verificar com teste de componente que o botão fica desabilitado e mostra o ícone combinado quando `autoThemeByTime` é `true`
- [x] 1.2 Envolver o botão no primitivo `apps/web/src/components/ui/Tooltip.tsx` com a dica localizada, garantindo que o hover funcione mesmo com o botão desabilitado; verificar com teste de componente que a dica é exibida no modo automático
- [x] 1.3 Ajustar o rótulo acessível (`aria-label`) para comunicar o motivo da indisponibilidade no modo automático, sem descrever uma alternância inexistente; verificar com teste de componente que o rótulo muda conforme o estado
- [x] 1.4 Garantir que, com o modo automático desligado, o botão permaneça habilitado e clique ainda alterne o tema; verificar com teste de componente que `updatePreferences` é chamado no clique em modo manual
- [x] 1.5 Ajustar estilos de desabilitado coerentes com o app (`disabled:opacity-50 disabled:cursor-not-allowed`) e conferir contraste do ícone/dica no header sob os overrides de shell; verificar visualmente no tema claro e escuro

## 2. i18n

- [x] 2.1 Adicionar a chave da dica de modo automático (ex.: `themeAutoToggleDisabled`) em `apps/web/src/i18n/locales/{pt-BR,en,es}/settings.json`, com o texto pt-BR "Desabilitado - modo automático selecionado." e traduções equivalentes; verificar com `bun run check:i18n`

## 3. Verificação de integração

- [x] 3.1 Rodar `bun run check` (typecheck + lint + testes + build) e corrigir regressões
- [x] 3.2 Rodar `bun run check:frontend-tests` confirmando que testes que leem fonte carregam `[CONTRATO-ESTRUTURAL]`
- [ ] 3.3 Rodar `bun run test:smoke` para o fluxo web/API
- [x] 3.4 Rodar `openspec validate icone-tema-automatico --strict` e ajustar o que for apontado

## Workflow follow-up

- Registrar `Board ref: 4b98bada-daff-4985-9478-8296bde51fc5` nos artefatos e, ao concluir a implementação, fechar o card T56 com `complete_task`, confirmando no board que o status é `DONE`.
- Arquivar a change após a implementação e a revisão do projeto.
