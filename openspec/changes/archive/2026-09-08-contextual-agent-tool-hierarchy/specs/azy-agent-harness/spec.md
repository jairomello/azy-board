## ADDED Requirements

### Requirement: Toolset evolutivo por run
O harness SHALL permitir que o conjunto de tools cresça entre rodadas por dependencies ou intenção cross-domain autorizada. Cada expansão SHALL ser derivada do registry e registrada em evento de auditoria.

#### Scenario: Expansão autorizada
- **WHEN** o modelo precisa de capability permitida fora do conjunto atual
- **THEN** o harness adiciona os schemas necessários e continua a mesma run

#### Scenario: Expansão proibida
- **WHEN** a capability exige policy não atendida
- **THEN** o harness não adiciona a tool e retorna uma restrição segura

#### Scenario: Limite de expansão
- **WHEN** a run excede expansões, steps, calls ou custo permitido
- **THEN** o harness encerra com erro de limite localizado e auditável

### Requirement: Erros recuperáveis como tool output
O harness SHALL classificar erros de execução em recuperáveis e terminais. Erros recuperáveis SHALL retornar ao modelo com código tipado e mensagem sanitizada; erros terminais SHALL finalizar a run.

#### Scenario: Dependência ausente
- **WHEN** uma tool retorna recurso relacionado ausente ou fora do conjunto carregado
- **THEN** o agente pode carregar dependency tool, resolver o recurso e repetir com argumentos corrigidos

#### Scenario: Erro de validação
- **WHEN** validator ou endpoint retorna erro corrigível
- **THEN** a resposta informa campo/código seguro sem stack, SQL ou metadados internos

#### Scenario: Erro terminal de autorização
- **WHEN** identidade, tenant, escopo ou permissão é rejeitado
- **THEN** a run finaliza sem tentar alternativa que contorne a autorização

### Requirement: Binding seguro de alvo
O harness SHALL injetar alvo implícito validado e SHALL aceitar mudança de alvo somente por resolução server-side de recurso explicitamente solicitado. O preview e o operation hash SHALL incluir o alvo efetivo.

#### Scenario: Projeto atual como default
- **WHEN** a mensagem não informa outro projeto
- **THEN** o projeto validado da conversa é inserido em tools project-scoped

#### Scenario: Projeto explícito diferente
- **WHEN** a mensagem indica outro projeto acessível e o resolver confirma a intenção
- **THEN** a run atualiza o alvo efetivo antes do preview e não aceita ID inventado pelo modelo

#### Scenario: Alvo muda após preview
- **WHEN** o recurso ou argumentos diferem da operação aprovada
- **THEN** a aprovação é invalidada e uma nova preview é exigida

### Requirement: Revalidação de aprovação
O harness SHALL revalidar provider, identidade, tenant, policy, alvo e operation hash depois da aprovação e antes da rota de mutação.

#### Scenario: Papel removido após preview
- **WHEN** usuário perde permissão antes de aprovar
- **THEN** a operação não é executada e a resposta informa a restrição

#### Scenario: Provider desabilitado
- **WHEN** o Root desabilita o agente antes da aprovação
- **THEN** a execução é bloqueada sem expor credencial ou payload sensível
