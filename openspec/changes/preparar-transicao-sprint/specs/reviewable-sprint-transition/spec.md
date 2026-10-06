Board ref: 4b20db3d-ddf2-400e-b0f4-cb3f1a4ac351

## ADDED Requirements

### Requirement: Plano revisável da transição
O sistema SHALL permitir ADMIN preparar plano somente-leitura de origem OPEN com ciclo ativo para destino distinto PROPOSED/OPEN no mesmo tenant/projeto. O plano SHALL fixar IDs/revisões, estados, vínculos, ciclo e população relevante, até 500 folhas; excedente SHALL ser rejeitado sem truncamento. SHALL exibir candidatos, exclusões, quantidade, pontos conhecidos/desconhecidos, efeito de fechar a origem e estado final do destino. Aplicação pela conversa SHALL exigir aprovação do hash do plano.

#### Scenario: Prévia de pendentes
- **WHEN** ADMIN prepara transição de uma sprint com pendentes e concluídos
- **THEN** a prévia separa candidatos e preservados, mostra diferenças de vínculos e o encerramento do ciclo antes de qualquer escrita

#### Scenario: Próxima ambígua
- **WHEN** “próxima” resolve para candidatas empatadas ou nome homônimo
- **THEN** o agente exige seleção inequívoca e não executa transição

#### Scenario: Destino inválido
- **WHEN** o destino é a origem, CLOSED ou pertence a outro projeto
- **THEN** o plano é recusado sem alteração

### Requirement: Elegibilidade e preservação de concluídos
Candidatos SHALL ser TASK/BUG folhas não arquivados ligados à origem em NOT_STARTED/IN_PROGRESS/BLOCKED. DONE/CANCELLED, pais e itens fora da origem SHALL permanecer intactos. Mudança da população relevante após preparação SHALL invalidar o plano em vez de incluir novos itens silenciosamente.

#### Scenario: Preservar concluídos
- **WHEN** a transição é aplicada com um card DONE e outro BLOCKED na origem
- **THEN** só o BLOCKED recebe o destino e o DONE mantém seus vínculos/estado

#### Scenario: Novo pendente antes de aprovação
- **WHEN** um novo pendente é associado à origem depois da preparação
- **THEN** a aplicação informa conflito e exige nova prévia sem ampliar os IDs aprovados

### Requirement: Associação adicional com histórico preservado
A transição SHALL acrescentar destino ao conjunto de sprints dos candidatos, conservar origem e outros vínculos e impedir duplicidade. SHALL preservar baseline, eventos anteriores e dados dos concluídos. Fechar a origem SHALL encerrar seu ciclo como CLOSED sem iniciar ou ativar destino implicitamente.

#### Scenario: Card já em várias sprints
- **WHEN** o candidato está na origem e numa terceira sprint
- **THEN** as três associações, incluindo destino, permanecem após a aplicação e nenhum vínculo duplicado é criado

#### Scenario: Destino permanece proposto
- **WHEN** a transição usa destino PROPOSED
- **THEN** a origem fica CLOSED e o destino permanece PROPOSED sem novo ciclo, preservando a baseline anterior da origem

### Requirement: Execução atômica e concorrência
O comando de domínio SHALL revalidar permissão, revisões, população, estado de destino e ciclo ativo no commit e aplicar associações, analytics e fechamento atomicamente em SQLite/PostgreSQL. Conflito SHALL impedir todos os efeitos. Um plano sem pendentes SHALL permitir somente o fechamento aprovado da origem. Duas operações concorrentes sobre a origem SHALL NOT fechar o mesmo ciclo duas vezes.

#### Scenario: Falha após tentativa de associar
- **WHEN** ocorre erro durante a execução antes do commit
- **THEN** vínculos e fechamento são revertidos integralmente e a operação informa não aplicada

#### Scenario: Destino fecha durante aprovação
- **WHEN** outra pessoa fecha o destino após preparar o plano
- **THEN** a aplicação retorna conflito, preservando origem e cards

#### Scenario: Dois administradores executam
- **WHEN** duas transições competem pelo mesmo ciclo de origem
- **THEN** uma confirma e a outra recebe conflito sem vínculos ou encerramentos adicionais

#### Scenario: Sem candidatos
- **WHEN** ADMIN aprova plano válido com zero pendentes
- **THEN** o ciclo/origem são fechados e nenhum vínculo de card é alterado

### Requirement: Retomada idempotente e efeitos duráveis
O sistema SHALL usar a infraestrutura T38 para chave/hash/resultado no mesmo commit e publicação pós-commit via outbox. Replay do mesmo plano/chave SHALL devolver o resultado original, após revalidar acesso, sem novas associações ou ciclos. Mesma chave com hash distinto SHALL ser conflito. Falha pós-commit SHALL ser reportada como dados aplicados com publicação pendente, retomando apenas os efeitos.

#### Scenario: Timeout com commit realizado
- **WHEN** a resposta se perde e o cliente retoma pela chave original
- **THEN** recupera o resultado confirmado sem executar novamente a transição

#### Scenario: Publicação falha
- **WHEN** a mudança foi confirmada mas a notificação falha
- **THEN** a operação conserva sucesso de dados, informa efeito pendente e o outbox retenta somente a publicação

#### Scenario: Permissão perdida
- **WHEN** ADMIN perde acesso antes da aplicação
- **THEN** a execução é recusada sem efeitos e sem tratar a aprovação anterior como autorização
