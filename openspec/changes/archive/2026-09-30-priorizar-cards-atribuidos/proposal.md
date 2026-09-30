## Why

Agentes e pessoas podem iniciar um card disponível enquanto há trabalho explicitamente atribuído a eles, reduzindo a previsibilidade do planejamento e podendo desrespeitar a decisão do gestor. O fluxo de seleção de trabalho deve consultar atribuições antes de sugerir ou iniciar um próximo card.

## What Changes

- Priorizar cards elegíveis atribuídos ao usuário atual antes de selecionar outros cards em `A Fazer`.
- Preservar a atribuição estabelecida pelo gestor: não reivindicar nem reatribuir cards já atribuídos a outra pessoa.
- Manter a seleção restrita a cards folha em colunas iniciáveis (`NOT_STARTED`), respeitando tenant e projeto.
- Registrar a referência rastreável ao card de planejamento.

## Capabilities

### New Capabilities
- `assigned-card-prioritization`: ordenação de candidatos a execução para priorizar cards atribuídos ao usuário atual.

### Modified Capabilities

## Impact

- Fluxos e instruções do Azy Agent que escolhem o próximo card, incluindo ferramentas MCP de consulta e claim.
- Testes de regressão do fluxo de seleção e documentação oficial da skill do agente.

Board ref: 43b6cb65-c04b-4e80-ab99-b023da17024e
