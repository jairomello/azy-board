# Design

## Context

O PR #4 alterou a Tree View e `PATCH /projects/:id/items/:id`. Ver `proposal.md` — Why. A hierarquia já existente é EPIC → STORY → TASK/BUG (com subtasks) e módulos são a raiz dos épicos.

## Goals / Non-Goals

**Goals**
- Resolver no cliente se um arraste é uma mudança de pai válida e qual patch enviar.
- Manter a mesma validação no servidor, incluindo detecção de ciclo.

**Non-Goals**
- Mover módulos.
- Reordenar irmãos dentro do mesmo pai.
- Alterar a hierarquia permitida pelo domínio.

## Decisions

- **Resolver o movimento no cliente e revalidar no servidor.** O cliente detecta ciclos pela mapa filho→pai da árvore exibida e evita chamadas inválidas; o servidor continua sendo a autoridade com `validateHierarchy` e `HIERARCHY_CYCLE`.
- **Módulo acompanha o pai de destino.** Ao mover STORY/TASK/BUG, `moduleId` é atualizado para o módulo do pai de destino, evitando item órfão de módulo e inconsistência com o filtro de módulo.
- **Movimento inválido não é enviado.** Tipos incompatíveis, alvo igual ao próprio item, alvo descendente e no-op retornam sem chamada de API.

## Risks / Trade-offs

- [Árvore desatualizada entre arraste e PATCH] → o servidor rejeita a hierarquia inválida e a árvore é recarregada, exibindo o estado real.
- [Mudança de módulo surpreender o usuário] → o módulo de destino é o do novo pai, mantendo a coerência do filtro; a mudança fica visível na própria árvore.

## Migration Plan

Sem migração de dados. Rollback é reverter o frontend; a API já aceitava `parentId`/`moduleId`.
