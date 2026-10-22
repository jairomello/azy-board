# Spec Delta

## MODIFIED Requirements

### Requirement: Erros recuperáveis como tool output
O harness SHALL classificar erros de execução em recuperáveis e terminais. Erros recuperáveis SHALL retornar ao modelo com código tipado e mensagem sanitizada; erros terminais SHALL finalizar a run. A mesma classificação SHALL valer para a execução de operação já aprovada: erro recuperável SHALL devolver o motivo do domínio ao modelo e registrar a tool call como falha, nunca deixando-a em execução; erro terminal SHALL finalizar a run com o código real.

#### Scenario: Dependência ausente
- **WHEN** uma tool retorna recurso relacionado ausente ou fora do conjunto carregado
- **THEN** o agente pode carregar dependency tool, resolver o recurso e repetir com argumentos corrigidos

#### Scenario: Erro de validação
- **WHEN** validator ou endpoint retorna erro corrigível
- **THEN** a resposta informa campo/código seguro sem stack, SQL ou metadados internos

#### Scenario: Erro terminal de autorização
- **WHEN** identidade, tenant, escopo ou permissão é rejeitado
- **THEN** a run finaliza sem tentar alternativa que contorne a autorização

#### Scenario: Recusa do domínio após aprovação
- **WHEN** a ferramenta de uma operação já aprovada recusa a mutação com erro recuperável
- **THEN** a tool call é registrada como falha com o motivo do domínio, esse motivo retorna ao modelo como output de tool e a run segue em execução para explicar ou ajustar a operação

#### Scenario: Mensagem do domínio preservada na recusa
- **WHEN** a API responde a recusa com mensagem em pt-BR endereçada ao usuário
- **THEN** o modelo recebe essa mensagem, e não um texto genérico que impeça explicar o motivo real
