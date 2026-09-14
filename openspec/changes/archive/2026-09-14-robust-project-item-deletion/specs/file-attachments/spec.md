## MODIFIED Requirements

### Requirement: Upload de anexos em qualquer card

O sistema SHALL permitir anexar arquivos a qualquer task (card). Nao ha restricao de tipo de arquivo. O tamanho maximo por arquivo SHALL ser configuravel (padrao: 10 MB). A exclusao individual ou em cascata SHALL remover os metadados do banco e SHALL garantir a limpeza eventual do arquivo no storage por meio do mecanismo pos-commit, sem exigir que o storage participe da transacao do banco.

#### Scenario: Upload de anexo ao card
- **WHEN** membro faz upload de um arquivo no modal de edicao do card
- **THEN** arquivo e salvo no storage e o card exibe o anexo com nome, tamanho e icone de tipo

#### Scenario: Multiplos anexos por card
- **WHEN** membro faz upload de varios arquivos em sequencia no mesmo card
- **THEN** todos os anexos sao listados no card, cada um com link de download individual

#### Scenario: Exclusao individual de anexo
- **WHEN** membro exclui um anexo do card
- **THEN** o metadado e removido e o sistema agenda ou conclui a remocao do arquivo no storage de forma idempotente

#### Scenario: Exclusao do card remove anexos
- **WHEN** um card com anexos e excluido, direta ou recursivamente
- **THEN** todos os metadados sao removidos na transacao e cada arquivo fisico fica registrado para limpeza pos-commit

#### Scenario: Exclusao do projeto remove anexos
- **WHEN** um projeto com cards e anexos e excluido
- **THEN** os metadados dos anexos sao removidos e os arquivos fisicos associados sao encaminhados para limpeza sem atravessar o limite do tenant
