# Spec Delta

## Purpose

Oferecer uma modal única de Planejamento do Projeto que dá acesso rápido aos
campos de planejamento (nome, datas, estimativas e escopo) e a visões somente
leitura de todos os links e todos os anexos do projeto, acessível pelo header do
board e pela listagem de projetos.

## ADDED Requirements

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
ADMIN, os campos SHALL ser editáveis e persistidos em `PATCH /projects/:id`;
para MEMBER e VIEWER, os campos SHALL ser exibidos em modo somente leitura.

#### Scenario: Admin edita campos de planejamento

- **WHEN** um ADMIN altera um ou mais campos de planejamento e salva
- **THEN** o sistema persiste os campos via `PATCH /projects/:id` e os reexibe atualizados

#### Scenario: MEMBER ou VIEWER em modo leitura

- **WHEN** um usuário com papel MEMBER ou VIEWER abre a modal
- **THEN** os campos de planejamento são exibidos em modo somente leitura, sem controles de edição

#### Scenario: Escopo com texto rico e expansão

- **WHEN** um ADMIN edita o Escopo usando o editor rico ou o botão de maximizar
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
