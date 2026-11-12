# Tasks

> Change retroativa: documenta comportamento já entregue no PR #6 (`94ffe21`).

## 1. Domínio e banco

- [x] 1.1 Definir o catálogo de campos exportáveis, tipos e validação de mapeamento em `packages/domain`.
- [x] 1.2 Criar as tabelas de mapeamento e suas migrações em SQLite e PostgreSQL.
- [x] 1.3 Implementar a persistência de mapeamentos nos dois adaptadores, com paridade testada.

## 2. API

- [x] 2.1 Implementar `GET`, `POST`, `PUT` e `DELETE /projects/:id/export-mappings` com papéis e nome único.
- [x] 2.2 Implementar `POST /projects/:id/export` nos modos bruto e mapeado, reutilizando os filtros do board.
- [x] 2.3 Gerar CSV e XLSX com cabeçalhos de download seguros.

## 3. Interface

- [x] 3.1 Criar o diálogo de exportação com campos de origem, destinos, tipo e reordenação.
- [x] 3.2 Permitir salvar, carregar e excluir mapeamentos no diálogo.
- [x] 3.3 Traduzir a interface em pt-BR, en e es.

## 4. Verificação

- [x] 4.1 Testar montagem da tabela, conversão de tipos e CSV.
- [x] 4.2 Testar o diálogo de exportação.
- [x] 4.3 Testar a persistência e a paridade de mapeamentos entre perfis.
