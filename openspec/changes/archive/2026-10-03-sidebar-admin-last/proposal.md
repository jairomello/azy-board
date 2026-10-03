## Why

Hoje o menu lateral (`AppShell`) empilha o grupo `Admin` antes do item `Conta`, de modo que a última opção visível é sempre `Conta`. Em produtos com módulo administrativo, a convenção é manter as ações de conta/perfil no fim da navegação e as áreas administrativas imediatamente antes, ou vice-versa de forma estável. A ordem atual coloca `Admin` "no meio" e `Conta` como última, o que foge da expectativa do usuário administrador e mistura navegação operacional com administrativa.

A mudança torna `Admin` o último item da navegação, posicionado **depois** de `Conta`, preservando integralmente a regra de visibilidade: o grupo `Admin` continua aparecendo apenas para usuários com permissão de gerenciar o tenant (`ADMIN` e `ROOT`).

## What Changes

- Reordenar a montagem de `navItems` em `AppShell.tsx`: `Conta` passa a ser inserido antes do bloco condicional de `Admin`.
- Manter o bloco `Admin` (e seus sub-itens Usuários, Anexos e, para `ROOT`, Config. Tenant) como o **último** item quando `canAccessAdmin(user.globalGroup)` for verdadeiro.
- Preservar sem alteração a regra de visibilidade do menu `Admin` (`ADMIN`/`ROOT`) e a regra inline de `Config. Tenant` (`ROOT`).
- Ajustar o teste de contrato estrutural para garantir que o bloco de `Admin` seja adicionado após o item de `Conta`.

## Capabilities

### New Capabilities

_(nenhuma)_

### Modified Capabilities

- `integrated-app-shell`: novo requisito sobre a ordem dos itens globais de navegação da sidebar, definindo `Conta` antes de `Admin` e `Admin` como último item quando visível.

## Impact

- **Frontend**: `apps/web/src/components/AppShell.tsx` (ordem dos `items.push` no `useMemo` da navegação).
- **Testes**: `apps/web/src/assistant-ui-contract.test.ts` (contrato estrutural do submenu Admin) e, se aplicável, um teste que verifique a ordem `Conta` → `Admin`.
- **Sem impacto** em rotas (`/account`, `/admin/*`), i18n, permissões server-side, API ou banco de dados.
- **Board ref**: não vinculado a card do Azy Board nesta proposta.
