## Why

Os itens do projeto já podem ser associados a Centros de Custo, mas o Board não oferece um filtro para separar rapidamente o trabalho por essa dimensão. Isso dificulta análises operacionais e financeiras quando um projeto possui vários centros cadastrados.

## What Changes

- Adicionar o filtro **Centro de Custo** ao painel de filtros do Board.
- Exibir no filtro todos os Centros de Custo do projeto atual, respeitando o tenant.
- Permitir selecionar um Centro de Custo por vez e combinar o critério com os demais filtros usando AND.
- Manter o filtro disponível mesmo quando o projeto não tiver Centros de Custo cadastrados, com indicação de estado vazio.
- Persistir e restaurar a seleção por projeto, limpando referências removidas.
- Exibir itens sem Centro de Custo somente quando o filtro estiver vazio; não criar um critério especial de "Sem centro" nesta etapa.
- Atualizar testes e documentação do Board.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `board-filters`: incluir Centro de Custo nos filtros de conteúdo.
- `board-filters-persistence`: persistir e restaurar `costCenterId` por projeto.

## Impact

- Estado, opções e aplicação client-side do `BoardFilters`.
- Payload dos itens já carregado pelo Board, que contém `costCenterId`.
- Persistência local, testes de contrato/UI e documentação.
- Nenhuma migração ou alteração de API é necessária, pois `items.cost_center_id` já existe e é validado pelo backend.
