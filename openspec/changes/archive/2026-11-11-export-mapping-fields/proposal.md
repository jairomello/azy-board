# Proposal

## Why

O PR #6 entregou exportação do board com mapeamento de campos e mapeamentos salvos por projeto, mas não criou artefatos OpenSpec. Não existe capability de exportação nas specs, então o comportamento publicado está sem contrato.

## What Changes

- Registrar a exportação da população filtrada do projeto em XLSX e CSV, com modo bruto ou mapeado.
- Documentar o mapeamento de campos: campo de origem, nome de destino e tipo opcional, com validação de duplicidade e obrigatoriedade.
- Documentar os mapeamentos salvos por projeto (listar, criar, atualizar e excluir), respeitando papéis de leitura e escrita.

## Capabilities

### New Capabilities

- `export`: exportação de itens do projeto em planilha/CSV e gestão de mapeamentos de campos reutilizáveis por projeto.

### Modified Capabilities

Nenhuma.

## Impact

- API: `POST /projects/:id/export`, `GET|POST|PUT|DELETE /projects/:id/export-mappings`.
- Banco: novas tabelas de mapeamento em SQLite e PostgreSQL.
- Frontend: diálogo de exportação no board.
- Domínio: catálogo de campos exportáveis e validação de mapeamento compartilhados.
