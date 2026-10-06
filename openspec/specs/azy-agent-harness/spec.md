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
Cada run SHALL possuir limites de tempo, tokens, passos, tool calls, payload, concorrência e custo quando disponível, além de `idempotencyKey` para mutações reenviáveis e cancelamento seguro entre processos. A execução SHALL ocorrer no worker (fila persistente), não no request HTTP. O cancelamento SHALL ser efetivo via flag persistida (`cancelRequested`), verificada pelo worker a cada step.

#### Scenario: Limite de passos atingido
- **WHEN** o modelo ultrapassa o limite de iterações ou repete chamadas equivalentes
- **THEN** o harness interrompe a run com estado explícito e não executa novas tools

#### Scenario: Reenvio após reconexão
- **WHEN** uma resposta de rede é reenviada com o mesmo identificador idempotente
- **THEN** a operação não é duplicada e o chat recupera o resultado anterior

#### Scenario: Cancelamento entre processos
- **WHEN** o cliente cancela um run que está sendo executado por um worker em outro processo
- **THEN** o worker detecta a flag `cancelRequested` e interrompe a execução no próximo step

#### Scenario: Retomada após aprovação
- **WHEN** uma aprovação de tool é persistida e o run volta para `QUEUED`
- **THEN** o worker retoma a execução do harness a partir do ponto de aprovação

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

### Requirement: Apontamento de trabalho com duração na conversa

O harness SHALL conduzir a criação de apontamento de trabalho com duração pelo mesmo fluxo de aprovação das demais mutações, exibindo no preview a atividade e a duração formatada (por exemplo, `90 min (1h30)`). Como a normalização de duração ocorre antes do hash, chamadas equivalentes — mesma atividade com a mesma duração, independentemente da representação — SHALL ser tratadas como a mesma operação, de modo que a repetição do pedido na mesma run não crie registro duplicado. O harness NÃO SHALL prometer data retroativa, pois o domínio registra o apontamento no momento atual.

#### Scenario: Preview mostra atividade e duração

- **WHEN** o agente propõe `create_item_log` com atividade e duração `"1h30"`
- **THEN** o preview de aprovação exibe a atividade e a duração formatada `90 min (1h30)` antes de executar

#### Scenario: Repetição do mesmo apontamento não duplica

- **WHEN** o modelo emite duas vezes a mesma chamada de apontamento na mesma run
- **THEN** o harness não cria um segundo registro, tratando a repetição como `REPEATED_TOOL_CALL` ou operação já executada

#### Scenario: Representações equivalentes têm a mesma assinatura

- **WHEN** o modelo repete o apontamento como `durationMin: 90` depois de ter proposto `duration: "1h30"`
- **THEN** o hash/assinatura canônica é o mesmo e não há duplicação

#### Scenario: Retroativo não é prometido

- **WHEN** o usuário pede “registre 1h30 referente a ontem”
- **THEN** o agente informa que a data do registro é o momento atual e cria o apontamento sem afirmar data retroativa

### Requirement: Leitura de anexo como dado não confiável no transcript

O harness SHALL conduzir a leitura de anexo pelo mesmo loop limitado das demais leituras, executando como o usuário autenticado e revalidando usuário, tenant, projeto, membership e papel a cada chamada. O texto extraído SHALL entrar no transcript **delimitado e rotulado como conteúdo de documento**, com sequências que colidam com o delimitador neutralizadas, e NÃO SHALL ser interpretado como instrução, selecionar ferramentas nem alterar argumentos. Conteúdo de anexo NÃO SHALL conceder capability, contornar permissão ou dispensar a aprovação de mutações.

#### Scenario: Conteúdo entra delimitado e rotulado

- **WHEN** uma leitura de anexo conclui com texto extraído
- **THEN** o resultado entra no transcript como conteúdo de documento delimitado, tratado como dado, e o próximo passo mantém as permissões inalteradas

#### Scenario: Conteúdo tenta comandar o agente

- **WHEN** o texto do anexo contém instruções para executar, criar ou excluir algo
- **THEN** o harness não trata o trecho como comando, não carrega ferramentas por causa dele e exige aprovação normal para qualquer mutação

#### Scenario: Revalidação de autorização na leitura

- **WHEN** a membership ou o papel muda antes da execução da leitura de anexo
- **THEN** a chamada é revalidada e bloqueada se o novo contexto não permitir a leitura

### Requirement: Limite de conteúdo de anexo no transcript

O harness SHALL respeitar o teto de caracteres por leitura de anexo definido nos contratos de limites, mantendo-o abaixo do corte genérico de saída de ferramenta para não perder conteúdo em silêncio. Quando o resultado vier truncado, o harness SHALL preservar e repassar ao modelo `truncated`, `reason` e `nextOffset`, permitindo a leitura segmentada e o registro de trechos não interpretados.

#### Scenario: Resultado truncado é preservado com metadados

- **WHEN** a leitura retorna `truncated: true` por limite de caracteres
- **THEN** o harness mantém no transcript o texto lido, o motivo e `nextOffset`, sem cortar novamente de forma silenciosa

#### Scenario: Leitura segmentada

- **WHEN** o modelo continua a leitura de um anexo grande usando `nextOffset`
- **THEN** o harness executa a continuação como nova leitura autorizada e mantém o vínculo com o mesmo anexo de origem

### Requirement: Origem do anexo na prévia de proposta

Quando uma run lê um ou mais anexos e o modelo propõe uma mutação de trabalho (critérios de aceite, descrição ou checklist), o harness SHALL anotar a prévia de aprovação com o **anexo de origem** efetivamente lido, mantendo o preview, o escopo e o hash cobrindo os argumentos reais. A anotação SHALL referenciar apenas anexos lidos na run e NÃO SHALL alterar o payload nem o hash da operação.

#### Scenario: Prévia cita o anexo lido

- **WHEN** a proposta decorre da leitura de um anexo na run
- **THEN** a prévia de aprovação identifica o anexo de origem, além do escopo, das alterações e da contagem

#### Scenario: Referência não amplia o payload

- **WHEN** a prévia anota o anexo de origem
- **THEN** o hash e os argumentos canônicos da operação permanecem os mesmos, e a referência é apenas informativa

#### Scenario: Anexo apenas listado não é citado como lido

- **WHEN** o agente listou um anexo mas não leu seu conteúdo
- **THEN** a prévia de proposta não apresenta esse anexo como fonte lida

### Requirement: Links do item na conversa

O harness SHALL conduzir as mutações de link (`create_item_link`, `update_item_link`, `delete_item_link`) pelo mesmo fluxo de aprovação das demais mutações, exibindo no preview o nome e a URL do link (e a descrição, quando houver) em vez do JSON cru. O alvo SHALL ser explícito: edição e remoção exigem `linkId` previamente obtido; o harness NÃO SHALL inferir o link a alterar apenas do foco da tela quando houver ambiguidade. Como as mutações usam payload canônico, repetições equivalentes na mesma run SHALL ser tratadas como a mesma operação.

#### Scenario: Preview exibe nome e URL

- **WHEN** o agente propõe `create_item_link` ou `update_item_link` com nome e URL
- **THEN** a prévia de aprovação exibe o nome e a URL do link antes de executar

#### Scenario: Alteração exige alvo explícito

- **WHEN** o usuário pede para editar um link sem que um `linkId` tenha sido resolvido
- **THEN** o agente lista os links e usa o `linkId` correspondente antes de propor a mutação

#### Scenario: Repetição não duplica

- **WHEN** o modelo emite duas vezes a mesma chamada de mutação de link na mesma run
- **THEN** o harness não executa a segunda, tratando como repetição ou operação já executada

### Requirement: Prévia e aprovação de edição de sprint e versão

O harness do Azy Agent SHALL conduzir `update_sprint` e `update_version` pelo mesmo fluxo de aprovação das demais mutações, exibindo no preview os campos alterados no formato “antes → depois” em pt-BR (por exemplo, `Fim: 2026-11-07 → 2026-11-14`), com o rótulo amigável da entidade e do campo, sem despejar JSON cru. A execução SHALL usar exatamente os argumentos canonicalizados do preview, respeitando a policy `ADMIN` do catálogo. Quando o pedido não identificar de forma inequívoca a sprint ou a versão, o agente SHALL perguntar somente o necessário antes de propor a mutação.

#### Scenario: Prévia de adiamento de sprint

- **WHEN** o agente propõe `update_sprint` para alterar a data de fim
- **THEN** o preview mostra o campo e o efeito da alteração antes de o usuário aprovar, e a execução aprovada usa o mesmo payload

#### Scenario: Prévia de mudança de situação de versão

- **WHEN** o agente propõe `update_version` para marcar uma versão como `RELEASED`
- **THEN** o preview identifica a versão e a nova situação antes da aprovação

#### Scenario: Alvo ambíguo não executa mutação

- **WHEN** o pedido menciona uma sprint ou versão que não pode ser resolvida sem ambiguidade
- **THEN** o agente pergunta o necessário e não executa a edição antes da resposta

#### Scenario: Rejeição não executa

- **WHEN** o usuário rejeita a prévia de edição
- **THEN** o run registra a rejeição, não executa a ferramenta e retorna ao estado concluído/cancelado

