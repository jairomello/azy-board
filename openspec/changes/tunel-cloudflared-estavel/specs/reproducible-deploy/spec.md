# Spec Delta

## MODIFIED Requirements

### Requirement: Versão do runtime fixada e coerente

A imagem da API SHALL usar a versão do Bun declarada em `.bun-version`, e a imagem Web SHALL usar a mesma versão no estágio de build. O CI SHALL verificar a coerência entre `.bun-version`, os Dockerfiles e o workflow, e tags flutuantes de runtime (como `1-alpine`) SHALL NOT ser usadas. Nenhuma imagem do compose de produção SHALL usar tag flutuante (`latest`, `stable`, `edge`), e o CI SHALL reprovar a ocorrência indicando o serviço, a imagem e a forma aceita.

#### Scenario: Divergência de versão reprova

- **WHEN** a versão do Bun no Dockerfile diverge de `.bun-version`
- **THEN** o CI falha e indica os arquivos inconsistentes

#### Scenario: Atualização de versão em um único lugar

- **WHEN** o desenvolvedor atualiza `.bun-version` para uma nova versão do Bun
- **THEN** as imagens passam a ser buildadas com a nova versão sem editar outros arquivos

#### Scenario: Tag flutuante no compose de produção reprova

- **WHEN** um serviço do compose de produção usa uma tag flutuante como `latest`
- **THEN** a checagem de versões do deploy falha indicando o serviço, a imagem e a forma aceita

#### Scenario: Compose com versões fixas passa

- **WHEN** todos os serviços do compose de produção usam tag de versão concreta
- **THEN** a checagem de versões do deploy conclui com sucesso

## ADDED Requirements

### Requirement: Ordem de subida por prontidão e verificação do túnel

Os serviços do compose de produção SHALL declarar prontidão (healthcheck) e as dependências SHALL usar condição de prontidão, de modo que nenhum serviço dependa de outro apenas iniciado. O rollout SHALL verificar o caminho público através do túnel depois de subir os containers, com retentativas, SHALL recuperar o serviço de túnel quando a verificação falhar e SHALL registrar a contagem de erros de resolução observada na janela.

#### Scenario: Dependência só sobe com o outro saudável

- **WHEN** os containers sobem em uma instância limpa
- **THEN** o proxy só inicia depois de o serviço web estar saudável, e o túnel só inicia depois de o proxy estar saudável

#### Scenario: Rollout verifica o caminho público

- **WHEN** o rollout termina de subir os containers
- **THEN** o deploy sonda a URL pública através do túnel antes de declarar sucesso

#### Scenario: Sonda falha e o túnel é recuperado

- **WHEN** a sonda pública falha após as retentativas
- **THEN** o deploy reinicia o serviço de túnel e sonda novamente, informando o resultado

#### Scenario: Erros de resolução são reportados

- **WHEN** o deploy conclui
- **THEN** o relatório informa quantos erros de resolução apareceram no log do túnel durante a janela, sem expor segredos
