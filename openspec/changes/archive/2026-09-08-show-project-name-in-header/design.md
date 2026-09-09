## Context

`AppShell` recebe `projectName` nas telas de board, dashboard e configurações, mas o header usa `contextLabel` para exibir “Fluxo do projeto” ou outro texto de seção. O usuário precisa reconhecer rapidamente o projeto atual e o nome já está disponível no estado da página.

## Goals / Non-Goals

**Goals:**

- Mostrar o nome do projeto como título principal do header quando houver `projectName`.
- Limitar o texto visual a 60 caracteres sem alterar o valor original usado para acessibilidade/tooltip.
- Manter fallback genérico em telas sem projeto.

**Non-Goals:**

- Alterar nomes persistidos de projetos.
- Alterar breadcrumbs, rotas, API ou banco.
- Truncar o nome no backend ou impedir nomes longos na criação/edição.

## Decisions

- Fazer o truncamento na camada visual do `AppShell`, com helper puro/testável ou lógica equivalente: nomes com até 60 caracteres permanecem iguais; nomes maiores usam os primeiros 57 caracteres e `...`, totalizando 60.
- Priorizar `projectName` sobre `contextLabel` somente quando `projectId` também estiver presente, evitando exibir nome stale em contexto global.
- Manter `contextLabel` como fallback e como metadado secundário quando já existir no layout.
- Aplicar `title`/tooltip acessível com o nome completo somente quando houver truncamento.
- Cobrir Unicode por contagem de code points para evitar cortar no meio de surrogate pair; a apresentação pode usar `Array.from(name)` antes do corte.

## Risks / Trade-offs

- [Nome longo pode continuar ocupar espaço em telas estreitas] → truncamento visual fixo e CSS de overflow.
- [Nome vazio ou carregamento atrasado] → usar `contextLabel` como fallback até o nome chegar.
- [Alteração de expectativa em teste de contrato] → atualizar teste para validar nome curto, limite de 60 e tooltip do nome completo.

## Migration Plan

1. Adicionar helper/componente de título contextual e testes.
2. Integrar no `AppShell` sem alterar API.
3. Executar typecheck, testes e build.

Rollback: remover a prioridade de `projectName`; nenhum dado persistido ou migration é afetado.

## Open Questions

- Nenhuma para a primeira implementação; o limite solicitado será exatamente 60 caracteres visuais.
