## Purpose

Definir a execução server-side segura e auditável do Azy Agent.

## Requirements

### Requirement: Harness server-side de tool calls
O sistema SHALL executar o Azy Agent no backend por meio de um loop limitado que envia contexto/tools ao modelo, valida chamadas, executa tools internas e devolve resultados sanitizados até resposta final, pergunta, aprovação, erro ou limite. Esse contrato SHALL ser protegido por testes determinísticos dos fluxos recorrentes de criação e atualização do agente.

#### Scenario: Modelo solicita leitura
- **WHEN** o modelo retorna function call para uma leitura permitida
- **THEN** o harness valida schema e contexto, executa a leitura como o usuário solicitante e devolve resultado seguro ao modelo

#### Scenario: Modelo solicita tool inexistente
- **WHEN** o modelo retorna nome ou argumentos fora do registry
- **THEN** o harness rejeita a chamada sem fallback privilegiado, registra erro seguro e encerra ou pede nova orientação

#### Scenario: Fluxo recorrente é alterado
- **WHEN** uma mudança estrutural modifica uma entidade, schema ou tool usada pela suíte de regressão
- **THEN** `bun run check` executa os cenários do harness e falha caso criação, hierarquia, lote, filtros ou atribuição deixem de atender ao contrato

### Requirement: Identidade e autorização do usuário
Cada tool call SHALL revalidar usuário, tenant, projeto, grupo, membership, papel e disponibilidade atuais. O harness SHALL executar como o usuário humano autenticado e nunca como Root, API Key compartilhada ou identidade escolhida pelo modelo.

#### Scenario: Usuário sem permissão tenta mutar
- **WHEN** usuário autorizado a ler pede uma operação de escrita
- **THEN** a tool é negada antes da mutação e o chat explica a permissão necessária sem revelar dados fora do escopo

#### Scenario: Permissão muda durante run
- **WHEN** membership, papel, toggle ou credencial muda antes da execução de uma tool
- **THEN** a chamada é revalidada e bloqueada se o novo contexto não permitir a operação

### Requirement: Aprovação e prévia para mutações
O harness SHALL classificar tools por risco e exigir aprovação humana para mutações relevantes, sempre para exclusão/arquivamento em cascata, mostrando escopo, diff, contagem, efeitos e hash da operação antes de executar.

#### Scenario: Usuário aprova prévia
- **WHEN** usuário aprova uma operação cujo hash e contexto ainda são válidos
- **THEN** o harness executa exatamente a operação prévia uma única vez e registra a aprovação

#### Scenario: Prévia expira ou muda
- **WHEN** aprovação expira ou o estado/hash da operação deixa de coincidir
- **THEN** a execução é recusada e uma nova prévia é exigida

### Requirement: Limites, idempotência e cancelamento
Cada run SHALL possuir limites de tempo, tokens, passos, tool calls, payload, concorrência e custo quando disponível, além de `idempotencyKey` para mutações reenviáveis e cancelamento seguro.

#### Scenario: Limite de passos atingido
- **WHEN** o modelo ultrapassa o limite de iterações ou repete chamadas equivalentes
- **THEN** o harness interrompe a run com estado explícito e não executa novas tools

#### Scenario: Reenvio após reconexão
- **WHEN** uma resposta de rede é reenviada com o mesmo identificador idempotente
- **THEN** a operação não é duplicada e o chat recupera o resultado anterior

### Requirement: Auditoria e saída segura
O sistema SHALL registrar run, ator, provider/modelo, tool names, aprovações, duração, custo disponível e resultado resumido, sem registrar secrets, chain-of-thought bruto, prompts completos ou PII desnecessária.

#### Scenario: Tool é executada
- **WHEN** uma tool interna conclui
- **THEN** o usuário vê um resumo operacional e a auditoria registra a execução vinculada ao usuário/tenant

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
