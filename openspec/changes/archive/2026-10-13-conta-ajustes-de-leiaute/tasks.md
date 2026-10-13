# Tasks

## 1. Senha junto dos dados de identidade

- [x] 1.1 Mover `<PasswordSection />` em `apps/web/src/pages/AccountPage.tsx` para imediatamente após `<ProfilePhotoSection />` (antes da seção Aparência), ajustando o comentário da seção; verificar `bun run --cwd apps/web typecheck`.
- [x] 1.2 Cobrir a ordem com contrato estrutural novo (`apps/web/src/conta-leiaute-contract.test.ts`, marcador `[CONTRATO-ESTRUTURAL]`): bloco de identidade → senha → Aparência → Visibilidade do projeto → Chaves de API; verificar `bun run test:web` e `bun run check:frontend-tests`.

## 2. Botões do guia na mesma linha

- [x] 2.1 Envolver "Copiar instrução para o agente" e "Baixar skill (.zip)" em `McpConnectionGuide.tsx` numa linha `flex flex-wrap items-center gap-2 mt-2`, removendo o `mt-2` de cada controle; verificar com caso no `mcp-connection-guide.test.tsx` que os dois controles compartilham o mesmo pai imediato.
- [x] 2.2 Confirmar que o comportamento existente segue intacto: cópia da instrução com confirmação, download acionável e mensagens de falha (`bun test apps/web/src/components/mcp-connection-guide.test.tsx`).

## 3. Alinhamento dos controles do bloco de identidade

- [x] 3.1 Dar altura explícita compartilhada (`h-9`) ao input de nome e ao botão "Salvar nome" (`ProfileNameField.tsx`) e aos botões "Alterar foto"/"Remover foto" (`ProfilePhotoSection.tsx`); verificar `bun run --cwd apps/web typecheck`.
- [x] 3.2 Medir na tela, em navegador real, os retângulos dos quatro controles em `/account`: igualdade de altura e de topo/base (tolerância de 1px) em largura ampla; registrar a medição como evidência.

## 4. Verificação final

- [x] 4.1 `bun run typecheck`, `bun run test:web`, `bun run check:i18n` (sem chave nova, apenas confirmação) e `bun run check` verdes.
- [x] 4.2 Conferência visual em `/account`: senha logo após o perfil, botões do guia na mesma linha e controles de identidade alinhados; capturar evidência e conferir o mobile (quebra de linha do par de botões do guia).

## Workflow follow-up

- Arquivar a change após a revisão do projeto (com sync do delta de `account-settings`).
- Se um card do Azy Board for criado para este trabalho, registrar `Board ref: <itemId>` nos artefatos e encerrar o card em uma coluna com `baseStatus` DONE.
