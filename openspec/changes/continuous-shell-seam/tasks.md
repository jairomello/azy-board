# Tasks

## 1. Emenda contínua no header

- [x] 1.1 Em `apps/web/src/components/AppShell.tsx`, trocar `lg:-ml-1` por `lg:-ml-4` e `lg:pl-8` por `lg:pl-11` no header, sem alterar z-order, raios, bordas, tokens ou mobile; verificar no navegador em 1280 px que o vão claro desaparece e que breadcrumb/título/controles continuam em `x=252`.
- [x] 1.2 Atualizar `apps/web/src/app-shell-layout-contract.test.ts` para exigir `lg:-ml-4` e `lg:pl-11` na emenda e verificar com `bun test apps/web/src/app-shell-layout-contract.test.ts`.

## 2. Verificação visual e baselines

- [x] 2.1 Conferir a emenda em 1024 px, 1280 px e 1440 px, na sidebar compacta e expandida, em claro, escuro e presets `petroleum`/`graphite`/`amethyst`, além de uma largura abaixo de `lg`; verificar que não há vão de canvas, sobreposição de conteúdo nem regressão no mobile.
- [x] 2.2 Regenerar as baselines com `E2E_UPDATE_SNAPSHOTS=1 bun run test:visual` e revisar os diffs (mudança restrita ao encontro sidebar/header); verificar com `bun run test:visual` que a comparação passa em seguida.
- [x] 2.3 Rodar `bun run test:web`, `bun run typecheck`, `bun run lint`, `bun run build` e, se aplicável, `bun run check`; verificar também `bun run check:docs`, `bun run check:frontend-tests` e `bun run openspec:validate`.
