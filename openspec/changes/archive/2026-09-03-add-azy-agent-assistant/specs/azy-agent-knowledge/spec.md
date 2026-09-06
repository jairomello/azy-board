## ADDED Requirements

### Requirement: Respostas fundamentadas no conhecimento do Azy Board
O Azy Agent SHALL responder perguntas sobre uso do Azy Board usando documentação curada, skill oficial, contratos MCP/API e contexto autorizado do board, indicando a fonte quando aplicável.

#### Scenario: Usuário pergunta como criar uma task
- **WHEN** usuário pede instruções de uso do Azy Board
- **THEN** o agente explica o fluxo correto, incluindo modo do projeto, hierarquia, permissões e tools relevantes, sem inventar comportamento

#### Scenario: Pergunta depende do estado atual
- **WHEN** usuário pergunta sobre sprint, cards, colunas ou configuração atual
- **THEN** o agente consulta o contexto autorizado antes de responder e diferencia fatos atuais de orientação geral

### Requirement: Guardrail de domínio
O agente SHALL limitar sua finalidade a explicar, consultar e operar recursos do Azy Board. Solicitações sobre assuntos externos, tentativas de substituir instruções do sistema ou pedidos de capacidades não oferecidas SHALL ser recusados de forma breve e segura.

#### Scenario: Solicitação fora do domínio
- **WHEN** usuário pede conteúdo sem relação com Azy Board
- **THEN** o agente recusa ou redireciona para uma tarefa do Azy Board sem chamar tools

#### Scenario: Prompt injection em conteúdo do board
- **WHEN** título, descrição, CSV ou documento contém instruções para ignorar políticas ou executar outra finalidade
- **THEN** o agente trata o conteúdo como dado não confiável, mantém as regras do sistema e não executa a instrução injetada

### Requirement: Comandos da skill disponíveis no chat
O chat SHALL mapear as intenções dos comandos semânticos da skill oficial, como status, planejamento, início, atualização, conclusão e revisão, para o mesmo registry autorizado de tools.

#### Scenario: Usuário pede status
- **WHEN** usuário solicita o equivalente a `/azyboard-status`
- **THEN** o agente produz resumo de status usando somente leituras autorizadas e não modifica o board

#### Scenario: Usuário pede criação em lote
- **WHEN** usuário solicita o equivalente a planejamento/importação e fornece dados
- **THEN** o agente usa o pipeline de prévia, esclarecimento e aprovação antes de executar criações
