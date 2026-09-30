## 1. Fluxo de seleção

- [x] 1.1 Localizar o fluxo do agente que consulta e escolhe o próximo card disponível.
- [x] 1.2 Incluir consulta prioritária por cards próprios elegíveis no projeto e tenant atuais, mantendo o fallback existente.
- [x] 1.3 Garantir que a regra não selecione para claim cards atribuídos a terceiros e preserve atribuições existentes.

## 2. Testes e documentação

- [x] 2.1 Cobrir seleção prioritária, ausência de candidatos próprios, exclusão de cards não elegíveis e atribuição a terceiros.
- [x] 2.2 Cobrir mudança concorrente de atribuição/disponibilidade durante claim e isolamento por projeto/tenant.
- [x] 2.3 Atualizar instruções oficiais do agente para consultar primeiro cards atribuídos ao usuário atual.
- [x] 2.4 Executar `bun run check` e `bun run test:smoke`.

Board ref: 43b6cb65-c04b-4e80-ab99-b023da17024e
