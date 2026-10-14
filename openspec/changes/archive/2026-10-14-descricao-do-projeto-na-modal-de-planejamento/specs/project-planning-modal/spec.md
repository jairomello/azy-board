# Spec Delta

## ADDED Requirements

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
