# Spec Delta

## MODIFIED Requirements

### Requirement: Consulta combinável de lacunas
O sistema SHALL oferecer consulta somente-leitura com grupos ALL/ANY, operadores tipados IS_EMPTY/IS_NOT_EMPTY, igualdade e comparações de datas compatíveis. SHALL cobrir prazo, pontos, sprint, versão e responsável, combinados com escopo de projeto, tipo, status, módulo e ator. Padrão SHALL ser TASK/BUG folhas ativos não arquivados nos estados NOT_STARTED/PLANNED/IN_PROGRESS/BLOCKED, com possibilidade de alteração explícita do escopo. Omitir um filtro ou null no envelope SHALL significar não filtrar, nunca ausência de valor.

#### Scenario: Card planejado entra no escopo padrão
- **WHEN** a consulta não informa status e há um card PLANNED com lacuna de prazo
- **THEN** o card planejado aparece no resultado, como os cards NOT_STARTED

#### Scenario: Meus cards sem prazo ou pontos
- **WHEN** o usuário consulta responsável igual ao ator e ANY de prazo/pontos IS_EMPTY
- **THEN** o resultado contém somente folhas do ator com ao menos uma dessas lacunas e retorna a expressão e o escopo aplicados

#### Scenario: Sem sprint e sem versão
- **WHEN** a consulta usa ALL das duas ausências
- **THEN** somente itens com ambas as lacunas são incluídos
