## ADDED Requirements

### Requirement: Edição de sprint pela conversa com paridade à tela

O sistema SHALL permitir que o Azy Agent edite o nome e as datas de uma sprint existente pela conversa, com a mesma validação e permissão da tela de configurações. A edição SHALL preservar o status e os ciclos analíticos existentes: NÃO SHALL abrir, suspender, reabrir nem encerrar a sprint, nem reescrever o baseline de um ciclo já iniciado. Transições de status SHALL continuar exclusivas de `activate_sprint` e `close_sprint`. Datas ausentes ou com início posterior ao fim SHALL ser rejeitadas sem persistência parcial.

#### Scenario: Adiar o fim de uma sprint

- **WHEN** o usuário pede “adie o fim da Sprint 3 para sexta” e confirma a prévia
- **THEN** a data de fim é atualizada na sprint correta, com status e ciclos preservados, e a mudança aparece no board

#### Scenario: Renomear sprint

- **WHEN** o usuário pede para renomear uma sprint existente
- **THEN** apenas o nome é alterado e o status e os ciclos permanecem inalterados

#### Scenario: Data inválida não altera a sprint

- **WHEN** a edição resultaria em início posterior ao fim ou em data ausente
- **THEN** o sistema rejeita a alteração com erro acionável e a sprint permanece como estava

#### Scenario: Edição não transiciona status

- **WHEN** o usuário tenta, pela edição de conteúdo, mudar o status de uma sprint
- **THEN** a operação não é oferecida como edição; abrir ou encerrar continua exigindo as ferramentas de transição
