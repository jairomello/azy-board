# Spec Delta

## ADDED Requirements

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
