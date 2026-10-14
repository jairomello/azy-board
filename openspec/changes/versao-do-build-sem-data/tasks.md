# Tasks

## 1. Exibição da versão sem a data

- [ ] 1.1 Trocar o ternário sobre `buildInfo.buildDate` por `tCommon('buildVersion', { version: buildInfo.version })` no rodapé da sidebar em `apps/web/src/components/AppShell.tsx`, preservando o atributo `data-build-version`; verificar com `bun test apps/web/src/app-shell-project-name.test.tsx` que a versão continua sendo exibida abaixo de "Trabalho conectado"
- [ ] 1.2 Fazer o mesmo em `apps/web/src/pages/LoginPage.tsx`, mantendo `data-build-version`; verificar com `bun test apps/web/src/pages/LoginPage.test.tsx` que a versão continua aparecendo no canto, sem dados sensíveis
- [ ] 1.3 Remover a chave `buildVersionWithDate` dos três arquivos de locale (`pt-BR`, `en`, `es`) em `apps/web/src/i18n/locales/*/common.json`; verificar com `bun run check:i18n` que a paridade entre os idiomas segue válida e que não restou chave sem uso
- [ ] 1.4 Atualizar o contrato estrutural do shell em `apps/web/src/app-shell-layout-contract.test.ts` para exigir `tCommon('buildVersion'` e a ausência de `buildVersionWithDate`; verificar com `bun test apps/web/src/app-shell-layout-contract.test.ts`
- [ ] 1.5 Cobrir a ausência da data com `buildDate` preenchido, mockando `getBuildInfo` para devolver `{ version: '2026.10.14.3', buildDate: '2026-10-14' }` e verificando que a tela mostra "Versão 2026.10.14.3" e não contém "2026-10-14" (rodapé do shell e tela de login); verificar rodando os testes de componente alterados

## 2. Documentação

- [ ] 2.1 Ajustar `docs/build-version.md`: remover a afirmação de que a versão é sempre exibida acompanhada da data e registrar na seção "Como conferir a versão publicada" que a interface mostra só o número da versão, enquanto a data do build permanece disponível em `GET /version`/`/api/version`; verificar com `bun run check:docs` que links internos e artefatos gerados seguem íntegros

## 3. Verificação de integração

- [ ] 3.1 Rodar `bun run check` (typecheck, lint, fronteiras, testes e build) e corrigir o que aparecer
- [ ] 3.2 Rodar `bun run test:smoke` para o fluxo web/API, confirmando que o endpoint público de versão continua devolvendo versão e data
- [ ] 3.3 Validar no app em execução: conferir na tela de login e na barra lateral do shell que aparece apenas `Versão <número>` e que `GET /version` continua respondendo `{ version, buildDate }`

## Workflow follow-up

- Archivar a change depois da implementação validada (`openspec archive versao-do-build-sem-data`), aplicando o delta em `build-version`.
- Nenhum card do Azy Board vinculado (Board ref: nenhum). Se um card for criado para rastrear a execução, registrar `Board ref: <itemId>` aqui e fechá-lo em coluna `DONE` (`complete_task` + confirmação no board).
