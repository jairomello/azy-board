# project-planning-modal Specification

## Purpose

Oferecer uma modal única de Planejamento do Projeto que dá acesso rápido aos
campos de planejamento (nome, datas, estimativas e escopo) e a visões somente
leitura de todos os links e todos os anexos do projeto, acessível pelo header do
board e pela listagem de projetos.

## Requirements

### Requirement: Abertura da modal de planejamento do projeto

O sistema SHALL oferecer uma modal de Planejamento do Projeto acessível por dois
pontos: o nome do projeto no header do board e o botão de editar de cada projeto
na tela de listagem de projetos. A modal SHALL carregar os dados do projeto
correspondente ao abrir.

#### Scenario: Abrir pelo nome do projeto no header do board

- **WHEN** o usuário aciona o nome do projeto exibido no header do board
- **THEN** a modal de Planejamento do Projeto abre com os dados do projeto atual

#### Scenario: Abrir pelo botão de editar na listagem de projetos

- **WHEN** um usuário autorizado aciona o botão de editar de um projeto na tela de listagem de projetos
- **THEN** a mesma modal de Planejamento do Projeto abre com os dados daquele projeto, substituindo o modal de edição de nome

#### Scenario: Fechar a modal

- **WHEN** o usuário fecha a modal por ESC, clique fora ou controle de fechamento
- **THEN** a modal é encerrada sem alterar os dados do projeto

### Requirement: Campos de planejamento na modal

A modal SHALL exibir nome do projeto, Data de Início, Data de Fim Previsto,
Total de Pontos Previsto, Total de Horas Previsto e Escopo (texto rico). Para
ADMIN, os campos SHALL ser editáveis; para MEMBER e VIEWER, SHALL ser exibidos
em modo somente leitura. Nenhum campo SHALL ser persistido automaticamente: a
gravação ocorre apenas quando o ADMIN aciona o botão de salvar.

#### Scenario: Admin edita campos de planejamento

- **WHEN** um ADMIN altera um ou mais campos de planejamento e aciona o botão de salvar
- **THEN** o sistema persiste os campos alterados via `PATCH /projects/:id` e os reexibe atualizados

#### Scenario: Alteração não salva não é persistida

- **WHEN** um ADMIN altera um campo de planejamento e fecha ou cancela a modal sem acionar o botão de salvar
- **THEN** o projeto mantém os valores anteriores no servidor e na próxima abertura da modal

#### Scenario: MEMBER ou VIEWER em modo leitura

- **WHEN** um usuário com papel MEMBER ou VIEWER abre a modal
- **THEN** os campos de planejamento são exibidos em modo somente leitura, sem controles de edição

#### Scenario: Escopo com texto rico e expansão

- **WHEN** um ADMIN edita o Escopo usando o editor rico ou o botão de maximizar e aciona o botão de salvar
- **THEN** o conteúdo é editável em tela ampliada e persistido como HTML

### Requirement: Aba "Todos os links" do projeto

A modal SHALL oferecer uma aba somente leitura que lista todos os links externos
vinculados a qualquer card do projeto, sem filtro por item, identificando o card
de origem de cada link e permitindo abrir cada URL.

#### Scenario: Listar todos os links do projeto

- **WHEN** o usuário abre a aba "Todos os links" em um projeto que possui links em vários cards
- **THEN** a aba lista os links de todos os cards com o nome e a origem de cada um

#### Scenario: Links somente leitura

- **WHEN** o usuário visualiza a aba "Todos os links"
- **THEN** não há controles de criação, edição ou remoção; apenas consulta e abertura do link em nova guia

#### Scenario: Projeto sem links

- **WHEN** o projeto não possui links em nenhum card
- **THEN** a aba apresenta estado vazio

### Requirement: Aba "Todos os anexos" do projeto

A modal SHALL oferecer uma aba somente leitura que lista todos os anexos
vinculados a qualquer card do projeto, sem filtro por item, identificando o card
de origem e permitindo download. A aba SHALL respeitar a configuração de anexos
do tenant.

#### Scenario: Listar todos os anexos do projeto

- **WHEN** o usuário abre a aba "Todos os anexos" em um projeto com anexos habilitados e arquivos em vários cards
- **THEN** a aba lista os anexos de todos os cards com nome, tipo, tamanho e origem

#### Scenario: Anexos desabilitados para o tenant

- **WHEN** a capacidade de anexos está desabilitada para o tenant e o usuário abre a modal
- **THEN** a aba "Todos os anexos" não é exibida

#### Scenario: Projeto sem anexos

- **WHEN** o projeto não possui anexos em nenhum card
- **THEN** a aba apresenta estado vazio

### Requirement: Acessibilidade e navegação entre abas da modal

A modal SHALL organizar os campos de planejamento e as abas de links e anexos
com semântica acessível de diálogo e abas, mantendo foco visível e navegação por
teclado, nos idiomas PT-BR, EN e ES.

#### Scenario: Navegação por teclado

- **WHEN** o usuário navega pela modal usando teclado
- **THEN** controles e abas recebem foco visível em ordem lógica e as abas expõem seu estado selecionado

#### Scenario: Texto internacionalizado

- **WHEN** a modal é exibida em qualquer dos idiomas suportados
- **THEN** rótulos, placeholders e estados vazios aparecem traduzidos no idioma ativo

---

### Requirement: Miniaturas e lightbox na aba "Todos os anexos" do projeto

A aba "Todos os anexos" SHALL exibir miniatura para anexos de imagem raster
aprovados para exibição inline, com carregamento assíncrono e independente por
item, e SHALL permitir abrir um lightbox navegável pelas imagens do projeto. A
miniatura SHALL usar o arquivo original pela rota autenticada, sem gerar imagem
no servidor.

#### Scenario: Miniatura na lista agregada do projeto

- **WHEN** o projeto possui anexos de imagem em um ou mais cards
- **THEN** a aba lista cada anexo com sua miniatura, o nome e o card de origem

#### Scenario: Carregamento assíncrono por miniatura

- **WHEN** a aba é aberta com vários anexos de imagem
- **THEN** a lista aparece imediatamente e cada miniatura é carregada de forma independente, com espaço/estado de carregamento até ficar pronta

#### Scenario: Lightbox do projeto

- **WHEN** o usuário aciona a miniatura de uma imagem na aba do projeto
- **THEN** um lightbox abre na imagem correspondente e permite navegar pelas imagens do projeto

#### Scenario: Formato não exibível inline

- **WHEN** o anexo é SVG, PDF ou outro formato sem miniatura aprovada
- **THEN** a aba exibe um ícone de arquivo no lugar da miniatura, sem executar o conteúdo na origem

#### Scenario: Anexos desabilitados para o tenant

- **WHEN** a capacidade de anexos está desabilitada para o tenant
- **THEN** a aba "Todos os anexos" continua oculta na modal

---

### Requirement: Rodapé de ações com salvar e cancelar na modal

A modal SHALL oferecer, na aba de planejamento e apenas para usuários com permissão
de edição, um rodapé fixo com as ações de salvar e cancelar. O botão de salvar SHALL
ficar indisponível enquanto não houver alterações ou enquanto a gravação estiver em
andamento, e SHALL indicar o estado de gravação. Uma falha de gravação SHALL ser
informada no rodapé, preservando o rascunho para nova tentativa.

#### Scenario: Gravar todas as alterações pendentes

- **WHEN** um ADMIN altera nome, datas, estimativas e escopo e aciona o botão de salvar
- **THEN** o sistema persiste todas as alterações em uma única requisição `PATCH /projects/:id` e informa o resultado

#### Scenario: Salvar sem alterações

- **WHEN** um ADMIN abre a modal e não altera nenhum campo
- **THEN** o botão de salvar permanece indisponível e nenhuma requisição é enviada

#### Scenario: Gravação em andamento

- **WHEN** um ADMIN aciona o botão de salvar
- **THEN** os campos e o rodapé ficam desabilitados, o botão indica que está salvando e, ao concluir, a modal reflete os valores persistidos

#### Scenario: Falha ao gravar

- **WHEN** a requisição de gravação falha
- **THEN** o rodapé exibe a mensagem de erro, os valores digitados pelo usuário permanecem na tela e o botão de salvar volta a ficar disponível

#### Scenario: Cancelar descarta o rascunho

- **WHEN** um ADMIN altera um ou mais campos e aciona cancelar
- **THEN** a modal fecha e nenhuma alteração é enviada ao servidor

#### Scenario: Fechar descarta o rascunho

- **WHEN** um ADMIN altera um campo e fecha a modal pelo controle de fechamento, pelo ESC ou por clique fora
- **THEN** a modal fecha sem diálogo de confirmação e sem enviar alterações ao servidor

#### Scenario: Rodapé ausente sem permissão de edição

- **WHEN** um usuário MEMBER ou VIEWER abre a modal
- **THEN** o rodapé de ações com salvar e cancelar não é exibido

#### Scenario: Rodapé acessível e traduzido

- **WHEN** o usuário navega pelo rodapé por teclado ou troca o idioma da aplicação
- **THEN** os botões expõem rótulo acessível, recebem foco visível em ordem lógica e aparecem traduzidos em PT-BR, EN e ES

### Requirement: Rascunho local dos campos do projeto na modal

Enquanto a modal estiver aberta, o sistema SHALL manter um rascunho local de todos
os campos editáveis, incluindo o nome do projeto, e SHALL enviar ao servidor apenas
os campos que divergirem dos valores carregados.

#### Scenario: Alteração do nome do projeto

- **WHEN** um ADMIN altera o nome do projeto na modal e aciona o botão de salvar
- **THEN** o sistema envia o novo nome em `PATCH /projects/:id` e o nome atualizado passa a ser exibido no cabeçalho da modal

#### Scenario: Nome inválido

- **WHEN** um ADMIN apaga o nome do projeto e aciona o botão de salvar
- **THEN** o sistema não envia a gravação e indica que o nome do projeto é obrigatório

#### Scenario: Apenas campos alterados são enviados

- **WHEN** um ADMIN altera somente a Data de Início e aciona o botão de salvar
- **THEN** a requisição de gravação contém apenas a Data de Início alterada

#### Scenario: Reabrir a modal recarrega o servidor

- **WHEN** um ADMIN salva uma alteração, fecha a modal e a reabre
- **THEN** os campos exibem os valores persistidos, sem resíduo de rascunho anterior

### Requirement: Campo de descrição do projeto na modal

A modal SHALL oferecer, na aba de planejamento e para quem pode editar o projeto, um
campo de Descrição do projeto em texto simples, com o limite de 20.000 caracteres
aceito pela API, gravado pelo mesmo acionamento de salvar dos demais campos.

#### Scenario: Editar e salvar a descrição

- **WHEN** um ADMIN altera a Descrição do projeto e aciona o botão de salvar
- **THEN** o sistema envia a descrição em `PATCH /projects/:id` e o card do projeto passa a exibir o texto salvo

#### Scenario: Descrição gravada sem espaços nas pontas

- **WHEN** um ADMIN digita a descrição com espaços no início ou no fim e aciona o botão de salvar
- **THEN** o valor persistido é o texto sem esses espaços

#### Scenario: Limite de caracteres do campo

- **WHEN** um ADMIN atinge o limite de 20.000 caracteres no campo de descrição
- **THEN** a digitação é limitada ao tamanho aceito pela API

#### Scenario: Descrição é texto simples

- **WHEN** um ADMIN grava uma descrição contendo marcação, como `**texto**` ou `<b>texto</b>`
- **THEN** o conteúdo é armazenado e reexibido como texto literal, sem renderizar formatação

#### Scenario: Alteração de descrição não salva é descartada

- **WHEN** um ADMIN altera a descrição e fecha ou cancela a modal sem acionar o botão de salvar
- **THEN** o projeto mantém a descrição anterior e a próxima abertura da modal exibe esse valor

### Requirement: Limpeza e modo leitura da descrição do projeto

A modal SHALL tratar descrição vazia como remoção do texto e SHALL exibir a descrição
sem controles de edição para usuários que não podem editar o projeto.

#### Scenario: Limpar a descrição

- **WHEN** um ADMIN apaga todo o texto da descrição e aciona o botão de salvar
- **THEN** o sistema grava o campo vazio e o card do projeto volta a exibir a descrição padrão

#### Scenario: Descrição apenas com espaços

- **WHEN** um ADMIN digita apenas espaços na descrição e aciona o botão de salvar
- **THEN** o sistema trata o valor como vazio e o card do projeto volta a exibir a descrição padrão

#### Scenario: MEMBER ou VIEWER em modo leitura

- **WHEN** um usuário com papel MEMBER ou VIEWER abre a modal em um projeto com descrição
- **THEN** a descrição é exibida em modo somente leitura, sem controles de edição
