## ADDED Requirements

### Requirement: Diário de trabalho separado do histórico
O sistema SHALL oferecer um diário de trabalho independente do histórico automático de alterações do card.

#### Scenario: Abrir diário de trabalho
- **WHEN** usuário abre o accordion Diário de trabalho de um card
- **THEN** sistema exibe somente registros manuais de trabalho, quantidade de registros e total de duração registrada

#### Scenario: Histórico não oferece registro manual
- **WHEN** usuário abre o Histórico de alterações
- **THEN** sistema exibe somente eventos automáticos e não apresenta o formulário de registrar trabalho

### Requirement: Registrar trabalho com duração H:MM
O sistema SHALL permitir que um membro registre descrição e duração no formato `H:MM`, convertendo a duração para minutos antes de persistir.

#### Scenario: Duração válida
- **WHEN** membro informa uma descrição e duração `2:00`, `8:00`, `29:00` ou `0:50`
- **THEN** sistema aceita o registro e armazena respectivamente 120, 480, 1740 ou 50 minutos

#### Scenario: Minutos inválidos
- **WHEN** membro informa duração sem dois dígitos de minutos ou com minutos maiores que 59
- **THEN** sistema rejeita o formulário e informa o formato esperado `H:MM`

#### Scenario: Autor preenchido automaticamente
- **WHEN** membro registra trabalho
- **THEN** sistema usa o usuário autenticado como autor e não permite escolher outro nome no formulário

### Requirement: Editar e excluir diário com permissão
O sistema SHALL permitir que o autor corrija seus registros manuais e que ADMIN corrija ou exclua qualquer registro manual.

#### Scenario: Autor edita próprio registro
- **WHEN** autor altera descrição ou duração de seu registro
- **THEN** sistema valida `H:MM`, atualiza os campos e preserva a autoria original

#### Scenario: Membro acessa registro de outro usuário
- **WHEN** membro tenta editar ou excluir registro manual de outro usuário
- **THEN** API retorna 403 Forbidden

#### Scenario: ADMIN administra registro manual
- **WHEN** ADMIN edita ou exclui registro manual de qualquer usuário
- **THEN** operação é aceita conforme validação normal

### Requirement: Totalização do diário
O sistema SHALL calcular o total de horas somente a partir dos registros manuais válidos do diário.

#### Scenario: Exibir total
- **WHEN** card possui registros manuais com duração
- **THEN** diário exibe a soma normalizada em horas e minutos, sem incluir auditoria automática

#### Scenario: Nenhum lançamento
- **WHEN** card não possui registros manuais
- **THEN** diário mostra estado vazio e total zero ou ausência conforme o padrão visual definido, sem inventar atividade

### Requirement: API de diário com isolamento
O sistema SHALL expor endpoints separados para listar, criar, editar e excluir registros manuais, sempre filtrando por projeto, tenant e permissões.

#### Scenario: Listar diário
- **WHEN** membro autenticado consulta o diário de um card
- **THEN** API retorna somente registros `manual`, paginados e com autor resolvido no tenant atual

#### Scenario: Criar diário
- **WHEN** membro envia descrição e duração válida para o endpoint de diário
- **THEN** API cria registro manual com `author_id` do contexto autenticado e `duration_min` normalizado
