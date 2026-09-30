## Context

O card de planejamento descreve uma regra de fluxo do agente: antes de escolher um card disponível em `A Fazer`, verificar se há cards atribuídos ao usuário atual. O board é SIMPLE nesta codebase; a seleção deve respeitar a semântica existente de itens folha, projeto/tenant e colunas com status base `NOT_STARTED`. A atribuição do gestor é autoridade e não pode ser sobrescrita pelo fluxo de claim.

## Goals / Non-Goals

**Goals:**
- Fazer o agente consultar primeiro seu trabalho já atribuído.
- Priorizar esse conjunto ao escolher o próximo card elegível.
- Preservar a atribuição e as regras de claim existentes.
- Tornar comportamento e exceções verificáveis por testes e instruções do agente.

**Non-Goals:**
- Reordenar ou alterar visualmente cards no board para todos os usuários.
- Autoatribuir cards sem responsável ou alterar atribuições feitas pelo gestor.
- Alterar modelo de dados, API pública ou política de autorização.

## Decisions

- **Aplicar a prioridade na seleção de trabalho do agente.** A consulta e a decisão ficam no fluxo que seleciona/claim o próximo card, não na ordenação visual global. Alternativa considerada: ordenar o board do usuário; foi descartada por afetar a experiência de todos e não refletir a intenção do card, que trata do agente que escolhe trabalho.
- **Considerar elegíveis apenas cards atribuídos ao usuário atual, folha e em estado/coluna iniciável.** Resolver identidade pela identidade autenticada do usuário/agente e manter o escopo de projeto e tenant das ferramentas existentes. Cards atribuídos a terceiros nunca são candidatos para claim pelo agente.
- **Se existir ao menos um candidato próprio elegível, escolher esse conjunto antes dos não atribuídos.** A ordenação dentro do conjunto mantém os critérios atuais de seleção; se não houver candidato próprio, manter o comportamento atual de fallback para cards disponíveis, sem tomar cards atribuídos a outros usuários.
- **Reivindicar apenas depois de selecionar e validar o card.** Usar `claim_task` somente quando a regra de atribuição permitir; uma atribuição existente ao usuário atual é preservada, e conflito/indisponibilidade requer nova consulta em vez de substituir o responsável.

## Risks / Trade-offs

- [A listagem pode não expor todos os campos necessários numa chamada leve] → solicitar os campos de responsável, estado, coluna e relação/folha na projeção, ou consultar o item antes do claim.
- [Atribuição ou status pode mudar entre consulta e claim] → tratar falha de claim como concorrência normal e refazer seleção a partir do board atualizado.
- [Prioridade estrita pode deixar cards não atribuídos sem atendimento] → aplicar apenas ao próximo card escolhido, sem impedir fallback quando não houver cards próprios elegíveis.

## Migration Plan

Não há migração de dados nem mudança de API. Atualizar o fluxo do agente e sua skill; validar com testes de seleção/claim e regressão web/API já existentes. Rollback consiste em reverter a regra de prioridade e instruções, sem impacto persistido.

## Open Questions

- O card menciona explicitamente `A Fazer`; confirmar durante a implementação se o escopo deve ser exclusivamente essa coluna ou qualquer coluna cujo `baseStatus` seja `NOT_STARTED`. O desenho assume elegibilidade por status base, preservando a coluna de backlog como não iniciável caso o fluxo atual a exclua.

Board ref: 43b6cb65-c04b-4e80-ab99-b023da17024e
