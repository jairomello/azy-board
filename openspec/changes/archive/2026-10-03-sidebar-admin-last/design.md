## Context

A sidebar do `AppShell` monta o array `navItems` em um `useMemo` (`apps/web/src/components/AppShell.tsx:109-174`). Hoje a ordem de inserção é: `Projetos` → `Board`/`Configurações`/`Dashboard` (quando há projeto) → `Admin` (condicional a `canAccessAdmin`) → `Conta` (incondicional). Como `Conta` é o último `items.push`, ela sempre aparece por último; o grupo `Admin` fica imediatamente antes.

O usuário quer inverter essa relação: `Admin` deve ser o último item, depois de `Conta`, mantendo a regra de visibilidade de `Admin` restrita a `ADMIN`/`ROOT`. A ordenação é puramente de composição de UI, sem impacto em rotas, permissões ou dados.

## Goals / Non-Goals

**Goals:**

- Renderizar `Conta` antes de `Admin` na sidebar para todos os usuários.
- Manter `Admin` como o último item da navegação quando visível.
- Preservar a visibilidade condicional de `Admin` (`ADMIN`/`ROOT`) e do sub-item `Config. Tenant` (`ROOT`).
- Garantir a ordem por teste (contrato estrutural e/ou comportamento).

**Non-Goals:**

- Alterar rotas `/account` e `/admin/*`, endpoints, RBAC server-side ou i18n.
- Reordenar itens dentro do submenu de `Admin` (`Usuários`, `Anexos`, `Config. Tenant`).
- Reordenar os itens de projeto (`Projetos`, `Board`, `Configurações`, `Dashboard`).
- Introduzir configuração de ordenação dinâmica ou preferências de usuário.

## Decisions

**Decisão 1: Reordenar os `items.push` no `useMemo`, em vez de ordenar depois.**

Mover o bloco `items.push({ label: tCommon('account'), ... })` para antes do bloco condicional de `Admin`. Assim a ordem de renderização passa a ser `... → Conta → Admin (se permitido)`. É a mudança mínima, mantém a legibilidade do fluxo e não cria lógica de ordenação adicional.

- *Alternativa considerada:* inserir `Admin` com `items.splice`/`unshift` para forçar o fim. Rejeitada por ser mais frágil e menos legível que simplesmente ajustar a ordem de construção.
- *Alternativa considerada:* manter `Admin` na posição atual e mover `Conta` para antes via `items.unshift`. Rejeitada por inverter a semântica esperada de `Conta` (item de perfil normalmente próximo do topo/base, mas aqui precisa vir antes do Admin).

**Decisão 2: Não alterar a assinatura/estrutura do `NavItem`.**

A ordem é definida pela sequência de inserção no array; nenhuma prop nova é necessária. `children`, `active` e `icon` permanecem como estão.

**Decisão 3: Cobrir a ordem por teste.**

Adicionar/ajustar teste que valide a posição relativa `Conta` → `Admin` na saída de `navItems`, além de reforçar que `Admin` só existe quando `canAccessAdmin` é verdadeiro. O teste estrutural existente em `assistant-ui-contract.test.ts` (que verifica `user.globalGroup === 'ROOT'` para `Config. Tenant`) permanece válido.

## Risks / Trade-offs

- [Ordem frágil a refatorações futuras] → Mitigado por teste que fixa `Conta` antes de `Admin` e `Admin` como último.
- [Regressão na visibilidade do `Admin`] → O bloco condicional `canAccessAdmin(user.globalGroup)` não é alterado; o teste de `permissions.test.ts` continua cobrindo os grupos.
- [Expectativa de UX divergente entre produtos] → Trade-off aceito: a convenção escolhida é `Conta` antes do módulo administrativo; a regra fica documentada na spec `integrated-app-shell`.
- [Testes de contrato baseados em `text.includes` podem não capturar ordem] → Complementar com asserção de índice das substrings/ordem, quando viável no arquivo de teste.

## Migration Plan

1. Editar `AppShell.tsx` movendo o push de `Conta` para antes do bloco de `Admin`.
2. Atualizar/adicionar teste de ordem.
3. Rodar `bun run check` (typecheck + lint + testes + build) e, se aplicável, `bun run test:smoke`.

Rollback: reverter o commit; sem migração de dados ou estado persistido envolvido.

## Open Questions

_(nenhuma)_
