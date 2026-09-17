## Purpose

Definir o diário manual de trabalho separado da auditoria automática dos cards.
## Requirements
### Requirement: Diário de trabalho separado do histórico
O sistema SHALL oferecer um diário manual independente da auditoria automática, exibido diretamente no painel Diário de trabalho da área Histórico. O painel SHALL exibir registros manuais, quantidade de registros, total de duração registrada e formulário inline para criação, sem abrir outra modal.

#### Scenario: Abrir diário integrado
- **WHEN** usuário seleciona a área Histórico de um card
- **THEN** painel Diário de trabalho exibe somente registros manuais, quantidade, total de duração e ação Registrar trabalho

#### Scenario: Histórico não oferece registro manual
- **WHEN** usuário visualiza o painel Auditoria de alterações
- **THEN** painel exibe somente eventos automáticos e não apresenta formulário de diário

#### Scenario: Estado vazio acionável
- **WHEN** card não possui registros manuais
- **THEN** Diário mostra total zero ou ausência conforme o padrão visual e oferece ação clara para abrir o formulário inline

### Requirement: Registrar trabalho com duração H:MM
O sistema SHALL permitir que um membro registre descrição e duração no formato `H:MM` no formulário inline do painel Diário, convertendo a duração para minutos antes de persistir.

#### Scenario: Duração válida
- **WHEN** membro informa uma descrição e duração `2:00`, `8:00`, `29:00` ou `0:50` e salva
- **THEN** sistema aceita o registro, armazena respectivamente 120, 480, 1740 ou 50 minutos, atualiza a lista e recalcula o total

#### Scenario: Minutos inválidos
- **WHEN** membro informa duração sem dois dígitos de minutos ou com minutos maiores que 59
- **THEN** formulário inline rejeita o lançamento e informa o formato esperado `H:MM` sem fechar a área Histórico

#### Scenario: Autor preenchido automaticamente
- **WHEN** membro registra trabalho no painel Diário
- **THEN** sistema usa o usuário autenticado como autor e não permite escolher outro nome no formulário

### Requirement: Editar e excluir diário com permissão
O sistema SHALL permitir que o autor corrija seus registros manuais e que ADMIN corrija ou exclua qualquer registro manual diretamente no painel Diário.

#### Scenario: Autor edita próprio registro
- **WHEN** autor aciona editar em seu registro e salva descrição ou duração
- **THEN** painel valida `H:MM`, atualiza os campos, preserva a autoria original e recalcula o total

#### Scenario: Membro acessa registro de outro usuário
- **WHEN** membro tenta editar ou excluir registro manual de outro usuário
- **THEN** controles de mutação não são oferecidos ou API retorna 403 Forbidden

#### Scenario: ADMIN administra registro manual
- **WHEN** ADMIN edita ou exclui registro manual de qualquer usuário
- **THEN** operação é aceita conforme validação normal e a lista inline é atualizada

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

