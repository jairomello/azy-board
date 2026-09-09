## Why

O header contextual do projeto exibe atualmente “Fluxo do projeto”, que descreve a seção mas não identifica claramente o projeto aberto. Em telas largas, o título é visualmente destacado; mostrar o nome real do projeto reduz a chance de o usuário trabalhar no projeto errado.

## What Changes

- Substituir o título genérico “Fluxo do projeto” pelo nome do projeto no header contextual das telas project-scoped.
- Limitar a apresentação do nome a 60 caracteres, preservando o nome completo em tooltip/atributo acessível quando houver truncamento.
- Manter o comportamento das telas sem projeto e preservar breadcrumb, sincronização e demais metadados do header.
- Cobrir nomes curtos, nomes exatamente no limite e nomes maiores que o limite em testes de UI.

## Capabilities

### New Capabilities

- Nenhuma.

### Modified Capabilities

- `integrated-app-shell`: o título contextual de telas de projeto passa a mostrar o nome do projeto truncado em até 60 caracteres.

## Impact

- Frontend: `AppShell`, `BoardPage`, dashboard e configurações do projeto; possivelmente traduções/testes de contrato visual.
- API: nenhum endpoint ou modelo alterado; o nome já é carregado pelas telas project-scoped.
- UX: melhora a identificação do projeto sem alterar navegação ou layout estrutural.
