## Purpose

Definir o conhecimento curado e os guardrails de domínio do Azy Agent.

## Requirements

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

---

### Requirement: Orientação de configuração do MCP no conhecimento do Azy Agent
O pacote de conhecimento curado do Azy Agent SHALL incluir uma fonte sobre configuração do servidor MCP do Azy Board, de modo que o chat interno saiba explicar pré-requisitos, obtenção da API Key, estrutura de configuração do cliente e verificação da conexão, citando a fonte quando aplicável. A orientação SHALL respeitar o guardrail de domínio: o agente explica e orienta, mas NÃO SHALL executar shell nem editar arquivos do cliente do usuário.

#### Scenario: Usuário pede ajuda de configuração no chat
- **WHEN** o usuário pergunta ao Azy Agent como configurar o MCP do Azy Board no seu code agent
- **THEN** o agente responde com o roteiro curado (incluindo como gerar a API Key e onde colocá-la com segurança), cita a fonte e mantém a resposta no domínio do Azy Board

#### Scenario: Roteiro de onboarding do cliente
- **WHEN** o usuário pergunta onde conseguir a credencial e o identificador do projeto
- **THEN** o agente orienta a gerar a chave em Minha conta, explica que `AZYBOARD_PROJECT_ID` identifica o projeto padrão e não é segredo, e reforça que a chave não vai para arquivo versionado

#### Scenario: Pedido fora do domínio permanece recusado
- **WHEN** o usuário pede algo sem relação com o Azy Board enquanto pergunta de configuração
- **THEN** o agente recusa ou redireciona brevemente, sem chamar tools e sem sair do seu domínio

### Requirement: Respostas de uso fundamentadas na documentação do produto

O Azy Agent SHALL responder perguntas sobre como usar o Azy Board consultando a documentação do produto: buscar as páginas relevantes e ler o conteúdo antes de responder, citando a página de origem. A consulta SHALL ser somente leitura, SHALL NOT exigir aprovação e SHALL NOT acessar fonte externa nem executar código.

#### Scenario: Pergunta de uso consulta a documentação

- **WHEN** o usuário pergunta como usar um recurso do Azy Board
- **THEN** o agente busca e lê a documentação e responde com base na página encontrada

#### Scenario: Fonte citada

- **WHEN** o agente responde com base na documentação
- **THEN** a resposta identifica a página de origem usada

#### Scenario: Sem correspondência na documentação

- **WHEN** a busca não encontra página relevante para a pergunta
- **THEN** o agente informa que não encontrou na documentação, em vez de inventar comportamento

#### Scenario: Consulta não muta dados e não pede aprovação

- **WHEN** o agente consulta a documentação
- **THEN** nenhuma mutação é proposta e nenhuma aprovação é exigida

#### Scenario: Conteúdo da página é dado não confiável

- **WHEN** o texto de uma página contém instruções para ignorar regras ou revelar prompts
- **THEN** o agente trata o texto como dado, mantém as regras do sistema e não executa a instrução

### Requirement: Escopo da documentação acessível ao agente

A documentação acessível ao agente SHALL corresponder ao mesmo escopo exposto na central de ajuda: o manual funcional do produto, sem documentos internos de controle editorial, sem documentos de padronização de escrita e sem as seções técnicas recolhíveis das páginas.

#### Scenario: Busca restrita ao manual funcional

- **WHEN** o agente busca na documentação
- **THEN** os resultados não incluem documentos internos nem seções técnicas recolhíveis

#### Scenario: Orientação de configuração do MCP coberta

- **WHEN** o usuário pergunta ao agente como configurar o MCP do Azy Board
- **THEN** o agente responde com base na documentação do produto (ou na fonte curada que sustenta essa orientação), cita a fonte e mantém a resposta no domínio do Azy Board
