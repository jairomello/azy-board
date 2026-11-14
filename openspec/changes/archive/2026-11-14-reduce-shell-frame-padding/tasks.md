# Tasks

## 1. Moldura externa do shell

- [x] 1.1 Em `apps/web/src/components/AppShell.tsx`, trocar `lg:p-3` por `lg:p-1` no `data-shell-layout` e `lg:-ml-3` por `lg:-ml-1` no header, sem tocar em `lg:pl-3`, `mt-3`/`mx-3`, paddings internos, raios ou sombras; verificar no navegador em 1280 px que a moldura mede 4 px nas quatro bordas e que o header encosta na sidebar sem vão nem sobreposição.

## 2. Verificação visual e baselines

- [x] 2.1 Conferir em 1024 px, 1279 px, 1280 px e 1440 px, além de uma largura abaixo de `lg` (ex.: 900 px), que a moldura compacta vale só no desktop, o layout mobile permanece igual e nenhum slot (`commandBar`, conteúdo, `statusRail`) é cortado ou sobreposto; verificar em claro, escuro e presets `petroleum`/`graphite`/`amethyst`.
- [x] 2.2 Regenerar as baselines de `e2e/__screenshots__/` com `E2E_UPDATE_SNAPSHOTS=1 bun run test:visual` e revisar os diffs: cada imagem deve mudar apenas pelo deslocamento de 8 px das superfícies do shell, sem alteração de conteúdo, cores ou layout interno; verificar com `bun run test:visual` que a comparação passa em seguida.
- [x] 2.3 Rodar `bun run test:web` e `bun run check` (ou, se o ambiente bloquear etapas, typecheck + lint + build) e corrigir o que falhar por causa da mudança; verificar também `bun run check:docs` e `bun run openspec:validate`.
