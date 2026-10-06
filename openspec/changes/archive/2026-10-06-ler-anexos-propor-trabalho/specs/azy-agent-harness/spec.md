## ADDED Requirements

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
