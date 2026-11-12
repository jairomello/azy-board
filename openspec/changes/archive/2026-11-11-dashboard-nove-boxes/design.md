# Design

## Context

Ver `proposal.md` — Why. O runtime do Dashboard renderiza nove quadros; Sprint e Versões são filtros. A correção é documental e não muda o comportamento.

## Goals / Non-Goals

**Goals**
- Deixar a spec coerente com a página entregue e com a wiki.

**Non-Goals**
- Criar boxes de Sprint ou Versões.
- Alterar endpoints, agregações ou filtros.

## Decisions

- **Seguir o runtime e a wiki como fonte.** A página expõe Progresso e Escopo, WIP, Bloqueados, Atrasados, Burnup, Aging WIP, Tokens de IA, Carga da Equipe e Horas Registradas.
- **Remover o requisito de Sprint em vez de convertê-lo em filtro.** O contrato de filtros já está coberto por "Filtros com aplicabilidade explícita"; não há box a especificar.

## Risks / Trade-offs

- [Perder o registro de uma intenção antiga de box de Sprint] → o histórico permanece no change arquivado e no CHANGELOG.

## Migration Plan

Sem migração. Rollback é reverter a spec.
