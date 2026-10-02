## Why

Cards frequentemente dependem de documentos e referências hospedados fora do Azy Board, mas hoje não há um local próprio para reuni-los. Uma área de links por item facilita o acesso a SharePoint, Google Drive, wikis e outras referências sem depender da capacidade opcional de anexos.

## What Changes

- Adicionar links externos vinculados a itens, disponíveis em todos os tenants independentemente da configuração de anexos.
- Permitir cadastrar, consultar, editar e remover links com nome, URL e descrição.
- Exibir os links no contexto do item e abri-los em uma nova guia com proteção contra acesso à janela de origem.
- Aplicar autorização e isolamento por tenant, projeto e item nas operações de links.

## Capabilities

### New Capabilities
- `item-links`: gerenciamento e exibição de links externos vinculados a itens.

### Modified Capabilities
- Nenhuma.

## Impact

- Banco de dados e migrações para persistência dos links vinculados a itens.
- API, contratos compartilhados e cliente web para operações CRUD e apresentação na interface do item.
- Testes de autorização, validação, persistência e fluxos de interface.

Board ref: cb1b516c-d2ed-4bab-9a29-8278611ec62d
