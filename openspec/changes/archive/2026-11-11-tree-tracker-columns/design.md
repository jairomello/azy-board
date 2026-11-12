# Design

## Context

Ver `proposal.md` — Why. A Tree View já possui grade configurável, com colunas visíveis por padrão e um seletor de colunas.

## Goals / Non-Goals

**Goals**
- Acrescentar as colunas de tracker sem poluir a visão padrão.
- Reutilizar a edição inline existente.

**Non-Goals**
- Alterar o modelo de dados do tracker.
- Criar telas ou filtros novos.

## Decisions

- **Colunas nascem ocultas.** Datas realizadas, responsável externo e chave externa são informação de apoio; ficam disponíveis no seletor de colunas em vez de aumentar a largura padrão.
- **Edição inline reutiliza o `PATCH` existente.** A célula envia os mesmos campos já persistidos pelo item, sem rota nova.
- **Chave externa derivada.** A célula mostra `externalSource`/`externalRef` como referência; a origem canônica é o item.

## Risks / Trade-offs

- [Grade muito larga quando todas as colunas são ativadas] → rolagem horizontal e largura mínima por coluna.
- [Campo externo editável em contexto errado] → a chave externa é apresentada como referência, não como campo livre.

## Migration Plan

Sem migração de dados ou schema.
