# Spec Delta

## ADDED Requirements

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
