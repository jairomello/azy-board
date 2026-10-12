# Spec Delta

## ADDED Requirements

### Requirement: Miniaturas de imagem na lista de anexos do card

A lista de anexos do card SHALL exibir uma miniatura para anexos de imagem raster
aprovados para exibição inline, carregada de forma assíncrona e independente por
item. A miniatura SHALL usar o arquivo original pela rota autenticada, sem gerar
imagem no servidor, e SHALL abrir o lightbox ao ser acionada.

#### Scenario: Miniatura exibida para imagem

- **WHEN** o card possui um anexo de imagem aprovada para exibição inline
- **THEN** a lista mostra uma miniatura legível que aparece assim que o arquivo termina de carregar

#### Scenario: Carregamento assíncrono não bloqueia a lista

- **WHEN** a lista de anexos é aberta com um ou mais anexos de imagem
- **THEN** a lista e os demais itens aparecem imediatamente e cada miniatura é carregada de forma independente, reservando um espaço/estado de carregamento até ficar pronta

#### Scenario: Clique abre o lightbox

- **WHEN** o usuário aciona a miniatura de uma imagem na lista do card
- **THEN** o lightbox abre na imagem correspondente, com a navegação entre as imagens do card

#### Scenario: Formato não exibível inline

- **WHEN** o anexo é SVG, PDF ou outro formato sem miniatura aprovada
- **THEN** a lista exibe um ícone de arquivo no lugar da miniatura, sem executar o conteúdo na origem

#### Scenario: Falha ao carregar a miniatura

- **WHEN** o carregamento da miniatura falha
- **THEN** o item exibe um estado de falha (ícone) sem quebrar a lista nem os demais anexos
