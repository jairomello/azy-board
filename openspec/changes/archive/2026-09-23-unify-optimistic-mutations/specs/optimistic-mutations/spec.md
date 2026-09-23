## ADDED Requirements

### Requirement: Política única de mutação no board
Toda mutação do board SHALL seguir exatamente um de dois padrões declarados: **otimista** — aplica o estado local a partir de um snapshot capturado antes da operação e restaura esse snapshot em falha; ou **reconciliada** — aplica o estado somente após a resposta de sucesso, ou invalida/refaz a consulta. Nenhuma mutação SHALL deixar o cache divergente do servidor.

#### Scenario: Mutação otimista reverte em falha
- **WHEN** uma mutação otimista do board falha na API
- **THEN** o cache retorna ao snapshot anterior e o usuário é avisado do erro

#### Scenario: Mutação reconciliada não antecipa estado
- **WHEN** uma mutação é do tipo reconciliada e a API ainda não respondeu
- **THEN** o cache não é alterado antes do sucesso

#### Scenario: Título não fica divergente
- **WHEN** a alteração de título falha na API
- **THEN** o título anterior é restaurado no cache, em vez de permanecer com o valor otimista

### Requirement: Rollback restaura o estado anterior exato
Uma mutação otimista que falha SHALL restaurar o snapshot capturado antes da aplicação otimista, incluindo todos os campos alterados, sem depender de refetch para voltar ao estado anterior.

#### Scenario: Falha ao mover card restaura coluna e status
- **WHEN** o movimento de um card entre colunas falha
- **THEN** o card volta para a coluna e o status anteriores

#### Scenario: Falha ao reordenar restaura a ordem
- **WHEN** a reordenação de cards ou colunas falha
- **THEN** a ordem anterior é restaurada

### Requirement: Salvamento de item e relações é coordenado
O web SHALL salvar os campos do item e suas relações (tags) em uma única requisição e SHALL reconciliar o cache a partir da resposta, de modo que uma falha parcial não deixe campos do item e tags divergentes.

#### Scenario: Sucesso atualiza item e tags juntos
- **WHEN** o usuário salva um item alterando campos e tags
- **THEN** uma única requisição persiste ambos e o cache é atualizado com a resposta

#### Scenario: Falha não altera o cache e informa o erro
- **WHEN** o salvamento coordenado de item e tags falha
- **THEN** o cache permanece no estado anterior e o usuário é avisado

### Requirement: Conflito de edição é reconciliado
Quando a API responder conflito (HTTP 409) por o registro ter mudado desde a leitura, o sistema SHALL reconciliar o cache com o estado atual do servidor e informar o usuário, sem sobrescrever a versão mais recente.

#### Scenario: Conflito ao salvar item reconcilia e avisa
- **WHEN** o salvamento de um item retorna 409 `CONFLICT`
- **THEN** o cache é reconciliado com o item atual do servidor e o usuário é avisado

#### Scenario: Conflito não sobrescreve a versão do servidor
- **WHEN** ocorre conflito de edição
- **THEN** a alteração local não é aplicada sobre a versão mais recente do servidor

### Requirement: Falhas de mutação são sempre comunicadas
Nenhuma mutação SHALL engolir erro silenciosamente nem deixar promise rejeitada sem tratamento; toda falha SHALL resultar em rollback ou reconciliação e em aviso ao usuário.

#### Scenario: Exclusão que falha gera aviso
- **WHEN** uma exclusão falha
- **THEN** o usuário é avisado, em vez de o erro ser silenciado

#### Scenario: Falha em checklist gera aviso
- **WHEN** criar, editar ou excluir um item de checklist falha
- **THEN** o usuário é avisado e o estado exibido corresponde ao servidor
