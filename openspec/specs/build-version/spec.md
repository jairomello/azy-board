# build-version Specification

## Purpose

Definir uma regra de numeração automatizada do build (`YYYY.MM.DD.N`) e a
exposição da versão e da data do build ao frontend e à API, para identificar
qual build está publicado.

## Requirements

### Requirement: Formato da versão do build

O sistema SHALL numerar cada build no formato `YYYY.MM.DD.N`, em que `YYYY.MM.DD` é a
data do build e `N` é um inteiro sequencial, começando em `1`, que conta os builds
daquele dia. A data do build SHALL continuar sendo produzida e transportada junto da
versão para diagnóstico, mas SHALL NOT ser exibida na interface ao lado da versão.

#### Scenario: Primeiro build do dia

- **WHEN** o primeiro build de um dia é gerado
- **THEN** a versão tem o sufixo `N = 1` com a data daquele dia

#### Scenario: Builds seguintes no mesmo dia

- **WHEN** mais um build é gerado no mesmo dia
- **THEN** a versão incrementa o contador `N` mantendo a mesma data

#### Scenario: Build em outro dia reinicia o contador

- **WHEN** um build é gerado em um novo dia
- **THEN** a versão usa a nova data com `N` reiniciando em `1`

#### Scenario: Versão exibida apenas como número

- **WHEN** a interface exibe a versão do build
- **THEN** mostra somente `YYYY.MM.DD.N`, sem repetir a data do build ao lado

### Requirement: Geração automatizada da versão

A versão SHALL ser gerada automaticamente pelo processo de build, sem edição
manual de arquivo versionado, e SHALL ser derivada do estado do repositório de
forma reproduzível para o mesmo commit e a mesma data. A versão SHALL ser
resolvida uma única vez por execução de build e transportada para os artefatos
de API e de web do mesmo commit, e nenhum artefato publicado SHALL cair no
fallback de desenvolvimento.

#### Scenario: Build gera a versão sem intervenção manual

- **WHEN** o build é executado em um clone limpo, sem alteração manual de versão
- **THEN** a versão `YYYY.MM.DD.N` é produzida e associada ao artefato gerado

#### Scenario: Sem valor de versão hardcoded

- **WHEN** o código ou os artefatos de configuração são inspecionados
- **THEN** não há número de versão de build fixado à mão como fonte de verdade

#### Scenario: Mesma versão nos artefatos de API e de web

- **WHEN** as imagens de API e de web do mesmo commit são publicadas
- **THEN** as duas reportam a mesma versão e a mesma data de build

#### Scenario: Contador avança em builds do mesmo dia

- **WHEN** dois builds são publicados no mesmo dia, inclusive quando o build acontece dentro da imagem, sem histórico git disponível
- **THEN** o segundo build usa um contador maior que o do primeiro, sem repetir a versão

#### Scenario: Artefato publicado não usa o fallback de desenvolvimento

- **WHEN** a imagem de web é construída pelo pipeline de publicação
- **THEN** o bundle embute a versão e a data do build, e a interface exibe a versão publicada em vez de "dev"

### Requirement: Exposição da versão ao frontend e à API

O sistema SHALL expor a versão do build ao frontend para exibição, sem a data do build
na interface, e SHALL disponibilizar um endpoint público que retorna a versão e a data
do build publicado, sem exigir sessão e sem revelar segredos. O endpoint SHALL ser
alcançável pela mesma origem que serve o app, respondendo em `/version` e em
`/api/version`.

#### Scenario: Frontend recebe a versão do build

- **WHEN** o frontend publicado é carregado
- **THEN** ele dispõe da versão e da data do build embutidas no artefato e exibe somente a versão

#### Scenario: Data do build não aparece na interface

- **WHEN** o usuário vê a versão do build na tela de login ou na barra lateral do shell
- **THEN** aparece apenas a versão no formato `YYYY.MM.DD.N`, sem a data do build ao lado

#### Scenario: Endpoint público de versão

- **WHEN** um cliente requisita o endpoint público de versão sem sessão
- **THEN** a resposta inclui a versão e a data do build, sem segredos nem dados de usuário

#### Scenario: Endpoint alcançável pela origem do app

- **WHEN** um cliente requisita `/version` ou `/api/version` na origem que serve a aplicação, sem sessão
- **THEN** recebe a versão e a data do build em JSON, nunca o HTML da aplicação

### Requirement: Coerência da versão do build no empacotamento

A verificação de coerência do deploy SHALL reprovar quando os Dockerfiles ou o
workflow de publicação deixarem de transportar a versão do build para os
artefatórios publicados.

#### Scenario: Dockerfile deixa de transportar a versão

- **WHEN** um Dockerfile que gera artefato publicado deixa de declarar e repassar a versão do build
- **THEN** a verificação de coerência falha indicando o arquivo e o argumento ausente

#### Scenario: Workflow não injeta a versão

- **WHEN** o job de publicação de imagens deixa de calcular e injetar a versão do build nas imagens
- **THEN** a verificação de coerência falha indicando o job

### Requirement: Detecção de build publicado mais novo

O web SHALL comparar a versão embutida no bundle com a versão publicada pela API
pública de versão ao carregar, em intervalo periódico e sempre que a aba voltar a
ficar visível. Quando a versão publicada for diferente da versão embutida, a
interface SHALL sinalizar que há uma versão nova disponível. A checagem SHALL ser
desligada no build de desenvolvimento (`dev`) e SHALL NOT depender de sessão.

#### Scenario: Build novo publicado com a aba aberta

- **WHEN** a aba foi carregada com a versão `2026.11.24.1` e a API pública passa a responder `2026.11.24.2`
- **THEN** a próxima checagem sinaliza versão nova disponível e oferece a ação de recarregar

#### Scenario: Aba volta ao foco depois de muito tempo

- **WHEN** a aba está oculta há horas e volta a ficar visível
- **THEN** o web consulta a versão publicada imediatamente, sem esperar o próximo intervalo

#### Scenario: Versão igual

- **WHEN** a versão publicada é igual à embutida no bundle
- **THEN** nenhum aviso de versão nova é exibido

#### Scenario: Build de desenvolvimento

- **WHEN** o bundle roda com a versão `dev`
- **THEN** nenhuma checagem de versão é feita e nenhum aviso aparece

#### Scenario: Falha de rede na checagem

- **WHEN** a consulta de versão falha por rede ou por resposta que não é JSON
- **THEN** o erro é ignorado e a próxima checagem volta a tentar, sem aviso nem tela de erro

### Requirement: Recuperação de aba aberta em build substituído

Quando o carregamento de um chunk sob demanda falhar por build substituído, o web
SHALL recarregar o documento uma única vez, reconhecendo as mensagens dos
principais motores e o evento de falha de pré-carregamento. Para impedir laço de
recarga, o web SHALL registrar a tentativa em `sessionStorage` com janela de
recuperação e SHALL limitar a uma tentativa por carregamento quando o storage não
estiver disponível. Se a recarga não puder ser feita naquele momento, a interface
SHALL explicar que a versão publicada mudou e oferecer recarga manual, em vez de
exibir apenas o erro genérico de renderização.

#### Scenario: Chunk antigo não existe mais

- **WHEN** o carregamento de `BoardPage-<hash-antigo>.js` falha com "Failed to fetch dynamically imported module"
- **THEN** a página é recarregada uma vez para buscar o build atual

#### Scenario: Falha de pré-carregamento do Vite

- **WHEN** o navegador emite `vite:preloadError`
- **THEN** o evento é tratado e a página tenta a recarga única

#### Scenario: Falha persiste na segunda carga

- **WHEN** o erro de chunk acontece novamente dentro da janela de recuperação
- **THEN** nenhuma nova recarga automática ocorre e a tela mostra a mensagem de build desatualizado com a ação "Recarregar página"

#### Scenario: Erro de renderização comum

- **WHEN** o erro capturado não é falha de carregamento de chunk
- **THEN** o comportamento existente de retry é mantido, sem reload automático

#### Scenario: Storage indisponível

- **WHEN** `sessionStorage` lança erro de segurança
- **THEN** a recarga ainda é limitada a uma tentativa por carregamento
