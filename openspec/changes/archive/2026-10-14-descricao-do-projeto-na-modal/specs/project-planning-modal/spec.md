# Spec Delta

## MODIFIED Requirements

### Requirement: Campo de descrição do projeto na modal

A modal SHALL oferecer, na aba de planejamento e para quem pode editar o projeto, um
campo de Descrição do projeto em texto simples, posicionado logo abaixo do Nome do
projeto, com o limite de 20.000 caracteres aceito pela API, gravado pelo mesmo
acionamento de salvar dos demais campos.

#### Scenario: Editar e salvar a descrição

- **WHEN** um ADMIN altera a Descrição do projeto e aciona o botão de salvar
- **THEN** o sistema envia a descrição em `PATCH /projects/:id` e o card do projeto passa a exibir o texto salvo

#### Scenario: Posição do campo na aba de planejamento

- **WHEN** um ADMIN abre a modal na aba de planejamento
- **THEN** o campo de Descrição do projeto aparece imediatamente abaixo do Nome do projeto e acima dos campos de datas e estimativas

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

## ADDED Requirements

### Requirement: Distinção entre a Descrição e o Escopo

A modal SHALL deixar explícito que a Descrição do projeto é o resumo em texto simples
exibido no card da tela de Projetos, enquanto o Escopo é o conteúdo de planejamento em
texto rico: cada campo SHALL ter rótulo próprio e o campo de Descrição SHALL trazer
ajuda de preenchimento que indique o destino do texto.

#### Scenario: Rótulos próprios para Descrição e Escopo

- **WHEN** um usuário abre a aba de planejamento da modal
- **THEN** os campos de descrição e de escopo aparecem identificados por rótulos distintos, e nenhum deles exibe o conteúdo do outro

#### Scenario: Ajuda do campo aponta o destino do texto

- **WHEN** um ADMIN abre a modal em um projeto cuja descrição ainda não foi preenchida
- **THEN** o campo de Descrição do projeto exibe ajuda de preenchimento que informa que o texto é o resumo mostrado no card do projeto

#### Scenario: Escopo permanece texto rico

- **WHEN** um ADMIN edita o campo Escopo na modal
- **THEN** o campo segue com edição de texto rico (formatação e expansão), enquanto a Descrição permanece em texto simples
