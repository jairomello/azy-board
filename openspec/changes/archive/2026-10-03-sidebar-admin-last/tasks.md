## 1. Reordenar a navegação

- [x] 1.1 Em `apps/web/src/components/AppShell.tsx`, mover o `items.push` do item `Conta` (`tCommon('account')`, `/account`) para antes do bloco condicional `if (user && canAccessAdmin(user.globalGroup))` do grupo `Admin`, garantindo a ordem `... → Conta → Admin`
- [x] 1.2 Confirmar que o bloco `Admin` (com sub-itens `Usuários`, `Anexos` e `Config. Tenant` apenas para `ROOT`) permanece inalterado e passa a ser o último item do array `navItems`
- [x] 1.3 Verificar que as dependências do `useMemo` (`effectiveProjectId`, `location.pathname`, `user`, `tCommon`, `tDashboard`, `tAssistant`) continuam corretas após a reordenação

## 2. Testes

- [x] 2.1 Adicionar/ajustar teste que valide a ordem relativa: `Conta` aparece antes de `Admin` no array de navegação para usuários `ADMIN`/`ROOT`
- [x] 2.2 Adicionar/ajustar teste que valide que `Admin` é o último item renderizado quando visível
- [x] 2.3 Garantir cobertura de que `Admin` não é renderizado para `TEAM_MEMBER` e `MANAGER`, mantendo `Conta` visível
- [x] 2.4 Revisar `apps/web/src/assistant-ui-contract.test.ts` para não quebrar com a reordenação (contrato de `Config. Tenant` / `ROOT`)

## 3. Verificação

- [x] 3.1 Rodar `bun run check` (typecheck + lint + testes + build) e corrigir eventuais falhas
- [x] 3.2 Rodar `bun run test:smoke` para o fluxo web/API
