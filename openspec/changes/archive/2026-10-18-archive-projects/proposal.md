# Proposal

## Why

A listagem de projetos não oferece uma forma reversível de retirar projetos inativos da área de trabalho nem de reencontrá-los rapidamente. O card T81 pede arquivamento semelhante ao de itens do board, uma visualização de projetos arquivados e busca na listagem.

## What Changes

- Adicionar arquivamento e restauração de projetos, sem excluir seus dados e conteúdo.
- Remover projetos arquivados da listagem padrão e oferecer controle para consultar os arquivados.
- Incluir busca textual na listagem de projetos.
- Manter arquivamento distinto de `isHidden`: ocultação existente continuará sendo uma preferência de visibilidade, independente do estado arquivado.

## Capabilities

### New Capabilities

<!-- Nenhuma: a capacidade existente de gerenciamento de projetos já é o limite adequado. -->

### Modified Capabilities

- `project-management`: acrescentar arquivamento/restauração de projeto, filtro de arquivados e busca na listagem.

## Impact

- `apps/web/src/pages/ProjectsPage.tsx`: ações nos cards e controles de busca/visualização.
- API e persistência de projetos: estado de arquivamento, filtros de listagem, operações de arquivar/restaurar, mantendo isolamento por tenant e autorização existente.
- Schemas e migrações SQLite/PostgreSQL, tipos compartilhados e testes de API/UI.
- Board ref: 5ba05757-4c53-4012-bc84-2d32f936177a

## Premissas

- Arquivamento é reversível e não altera `isHidden` nem `isRestricted`; arquivados não aparecem na lista normal mesmo quando a preferência de projetos ocultos está ligada.
- A ação de arquivar/restaurar segue a autorização de administração já usada para editar/excluir projeto.
- A busca será local à listagem já carregada e filtrará pelo nome do projeto; não altera a autorização nem a ordenação atual.
