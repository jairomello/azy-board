## ADDED Requirements

### Requirement: Harness server-side de tool calls
O sistema SHALL executar o Azy Agent no backend por meio de um loop limitado que envia contexto/tools ao modelo, valida chamadas, executa tools internas e devolve resultados sanitizados até resposta final, pergunta, aprovação, erro ou limite.

#### Scenario: Modelo solicita leitura
- **WHEN** o modelo retorna function call para uma leitura permitida
- **THEN** o harness valida schema e contexto, executa a leitura como o usuário solicitante e devolve resultado seguro ao modelo

#### Scenario: Modelo solicita tool inexistente
- **WHEN** o modelo retorna nome ou argumentos fora do registry
- **THEN** o harness rejeita a chamada sem fallback privilegiado, registra erro seguro e encerra ou pede nova orientação

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
