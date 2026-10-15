# Spec Delta

## ADDED Requirements

### Requirement: Skill documenta o registro de tokens no encerramento

A skill oficial SHALL orientar o agente a registrar os tokens de entrada e saída ao
concluir um card executado por IA, com exemplos mínimos por `update_item` e pela
ferramenta em lote `set_item_tokens`, e SHALL informar que `complete_task` emite aviso
não bloqueante quando o card é concluído sem tokens.

#### Scenario: Exemplos mínimos presentes

- **WHEN** o agente consulta a skill antes de encerrar um card
- **THEN** encontra exemplos de registro de `tokensInput`/`tokensOutput` e a instrução de
  registrar antes de concluir

#### Scenario: Aviso documentado

- **WHEN** a skill descreve o fluxo de encerramento
- **THEN** informa que a ausência de tokens gera aviso, sem bloquear a conclusão

### Requirement: Skill documenta o preenchimento massivo por logs de sessão

A skill oficial SHALL descrever o roteiro de backfill massivo: ler os logs de sessão do
harness, atribuir os totais por card e enviar um único lote por `set_item_tokens`. O
roteiro SHALL orientar a não atribuir automaticamente sessões ambíguas e SHALL manter a
skill canônica sincronizada com o espelho `.opencode`.

#### Scenario: Roteiro de backfill

- **WHEN** o usuário pede registrar tokens de todos os cards concluídos
- **THEN** a skill orienta a ler o log de sessões, mapear por card, confirmar os casos
  ambíguos e enviar um lote único

#### Scenario: Sessões não atribuídas silenciosamente

- **WHEN** uma sessão não pode ser associada a um card com segurança
- **THEN** a skill orienta a não atribuir o valor automaticamente e a sinalizar a dúvida

#### Scenario: Espelho sincronizado

- **WHEN** a verificação da skill oficial roda
- **THEN** a skill canônica e o espelho `.opencode/skills/azyboard` permanecem coerentes
