# Design

## Context

O PR #6 introduziu exportação e mapeamentos. Ver `proposal.md` — Why. O board já concentra a população filtrada no servidor, e o produto roda em SQLite (SIMPLE) ou PostgreSQL (ADVANCED).

## Goals / Non-Goals

**Goals**
- Gerar o arquivo a partir da mesma população que o board exibe.
- Reutilizar mapeamentos por projeto sem duplicar lógica entre perfis de banco.

**Non-Goals**
- Editar o arquivo no navegador.
- Fórmulas, gráficos ou múltiplas abas.
- Exportação assíncrona ou de outras entidades.

## Decisions

- **Catálogo de campos e validação no pacote de domínio.** `@azy-board/domain` define os campos, tipos e a validação; API e web usam a mesma fonte, evitando divergência entre o que a UI permite e o que o servidor aceita.
- **Tabela de mapeamentos por projeto.** O mapeamento pertence ao projeto (e ao tenant), com nome único por projeto.
- **Tabela intermediária de colunas.** O export monta uma representação de tabela comum e serializa em CSV ou XLSX; a geração do arquivo não conhece filtros.
- **Filtros reutilizados do board.** A exportação aplica o mesmo recorte de população, incluindo arquivados apenas quando solicitado.

## Risks / Trade-offs

- [Mapeamento aponta campo inexistente após evolução do catálogo] → validação compartilhada rejeita o mapeamento antes de gerar o arquivo.
- [Grande volume em memória] → a exportação atual é síncrona; volumes maiores exigirão processamento em stream, fora deste escopo.
- [Divergência entre SQLite e PostgreSQL] → migrações espelhadas e teste de paridade entre perfis.

## Migration Plan

Adiciona tabelas de mapeamento em ambos os perfis; nenhum dado existente é alterado. Rollback remove as tabelas sem afetar itens.
