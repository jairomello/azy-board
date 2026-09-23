## ADDED Requirements

### Requirement: Gate de testes de frontend no CI
O workflow de integração contínua SHALL executar as suítes de frontend como gate obrigatório: os testes de comportamento e de componente do web SHALL rodar junto do gate de check já existente, e o E2E de navegador SHALL rodar em job dedicado com navegador do sistema. A falha de qualquer uma dessas suítes SHALL reprovar o job correspondente e bloquear o pull request. O job de E2E SHALL publicar artefatos de diagnóstico (screenshots, traces e logs) quando falhar, sem expor segredos.

#### Scenario: Suíte de frontend reprova o CI
- **WHEN** um teste de comportamento ou de componente do web falha
- **THEN** o gate de check falha e o pull request fica bloqueado

#### Scenario: E2E de navegador reprova o CI
- **WHEN** uma jornada crítica do E2E de navegador falha
- **THEN** o job de E2E falha e o pull request fica bloqueado

#### Scenario: Falha de E2E com diagnóstico
- **WHEN** o job de E2E falha
- **THEN** screenshots, traces e logs da execução são publicados como artefatos para diagnóstico

#### Scenario: E2E aprovado libera o gate
- **WHEN** todas as jornadas críticas e a regressão visual passam
- **THEN** o job de E2E é marcado como bem-sucedido e o pull request segue as demais regras da branch
