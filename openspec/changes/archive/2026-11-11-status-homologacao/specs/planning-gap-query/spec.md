# Spec Delta

## MODIFIED Requirements

### Requirement: Consulta combinável de lacunas
O sistema SHALL oferecer consulta somente-leitura com grupos ALL/ANY, operadores tipados IS_EMPTY/IS_NOT_EMPTY, igualdade e comparações de datas compatíveis. SHALL cobrir prazo, pontos, sprint, versão e responsável, combinados com escopo de projeto, tipo, status, módulo e ator. Padrão SHALL ser TASK/BUG folhas ativos não arquivados nos estados NOT_STARTED/PLANNED/IN_PROGRESS/IN_HOMOLOGATION/BLOCKED, com possibilidade de alteração explícita do escopo. Omitir um filtro ou null no envelope SHALL significar não filtrar, nunca ausência de valor.

#### Scenario: Meus cards sem prazo ou pontos
- **WHEN** o usuário consulta responsável igual ao ator e ANY de prazo/pontos IS_EMPTY
- **THEN** o resultado contém somente folhas do ator com ao menos uma dessas lacunas e retorna a expressão e o escopo aplicados

#### Scenario: Card planejado entra no escopo padrão
- **WHEN** a consulta não informa status e há um card PLANNED com lacuna de prazo
- **THEN** o card planejado aparece no resultado, como os cards NOT_STARTED

#### Scenario: Card em homologação entra no escopo padrão
- **WHEN** a consulta é feita sem escopo explícito de status
- **THEN** cards `IN_HOMOLOGATION` são considerados itens abertos e podem aparecer no resultado

#### Scenario: Sem sprint e sem versão
- **WHEN** a consulta usa ALL das duas ausências
- **THEN** somente itens com ambas as lacunas são incluídos

#### Scenario: Consulta inválida
- **WHEN** há campo desconhecido, comparação incompatível ou mais de 20 condições ou profundidade superior a 3
- **THEN** a consulta retorna erro de validação sem executar predicados livres ou ampliar o escopo
