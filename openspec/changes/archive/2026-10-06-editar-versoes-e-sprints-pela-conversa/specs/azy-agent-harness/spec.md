## ADDED Requirements

### Requirement: Prévia e aprovação de edição de sprint e versão

O harness do Azy Agent SHALL conduzir `update_sprint` e `update_version` pelo mesmo fluxo de aprovação das demais mutações, exibindo no preview os campos alterados no formato “antes → depois” em pt-BR (por exemplo, `Fim: 2026-11-07 → 2026-11-14`), com o rótulo amigável da entidade e do campo, sem despejar JSON cru. A execução SHALL usar exatamente os argumentos canonicalizados do preview, respeitando a policy `ADMIN` do catálogo. Quando o pedido não identificar de forma inequívoca a sprint ou a versão, o agente SHALL perguntar somente o necessário antes de propor a mutação.

#### Scenario: Prévia de adiamento de sprint

- **WHEN** o agente propõe `update_sprint` para alterar a data de fim
- **THEN** o preview mostra o campo e o efeito da alteração antes de o usuário aprovar, e a execução aprovada usa o mesmo payload

#### Scenario: Prévia de mudança de situação de versão

- **WHEN** o agente propõe `update_version` para marcar uma versão como `RELEASED`
- **THEN** o preview identifica a versão e a nova situação antes da aprovação

#### Scenario: Alvo ambíguo não executa mutação

- **WHEN** o pedido menciona uma sprint ou versão que não pode ser resolvida sem ambiguidade
- **THEN** o agente pergunta o necessário e não executa a edição antes da resposta

#### Scenario: Rejeição não executa

- **WHEN** o usuário rejeita a prévia de edição
- **THEN** o run registra a rejeição, não executa a ferramenta e retorna ao estado concluído/cancelado
