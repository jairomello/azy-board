## ADDED Requirements

### Requirement: Gate de integridade de documentação no CI
O workflow de integração contínua SHALL executar a verificação de integridade da documentação como gate obrigatório, detectando artefatos gerados desatualizados, links internos quebrados e afirmações proibidas. A falha da verificação SHALL reprovar o job correspondente e bloquear o pull request. O gate SHALL permitir reprodução local pelo mesmo comando.

#### Scenario: Documentação divergente reprova o CI
- **WHEN** um artefato gerado está desatualizado, um link interno está quebrado ou uma afirmação proibida foi reintroduzida
- **THEN** o gate de documentação falha e o pull request fica bloqueado

#### Scenario: Documentação íntegra libera o gate
- **WHEN** os artefatos gerados estão em dia, os links internos resolvem e não há afirmações proibidas
- **THEN** o gate de documentação é marcado como bem-sucedido e o pull request segue as demais regras da branch

#### Scenario: Reprodução local do gate
- **WHEN** o desenvolvedor segue a documentação de CI
- **THEN** ele executa localmente o mesmo comando do gate de documentação antes de enviar o pull request
