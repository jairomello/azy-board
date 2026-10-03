## ADDED Requirements

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
