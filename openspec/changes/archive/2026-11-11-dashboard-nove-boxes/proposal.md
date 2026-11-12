# Proposal

## Why

A spec `project-dashboard` está internamente inconsistente: a navegação e o propósito citam nove quadros com Tokens de IA e sem Sprint/Versões, mas o requisito "Dez boxes priorizados" e o requisito "Sprint por ciclo" ainda descrevem boxes que o runtime não renderiza.

## What Changes

- Corrigir o Purpose para nove quadros.
- Substituir "Dez boxes priorizados" por "Nove boxes priorizados", incluindo Tokens de IA e excluindo Sprint e Versões.
- Remover o requisito "Sprint por ciclo", que não corresponde a nenhum box ou endpoint entregue; Sprint e Versões permanecem apenas como filtros.
- Manter os demais requisitos de filtros, burnup, aging, carga, horas e estados.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `project-dashboard`: alinha a contagem e a lista de quadros ao runtime e remove o box de Sprint.

## Impact

- Apenas documentação de comportamento; nenhuma alteração de código, API ou banco.
- Dashboard em `ProjectDashboardPage` e `DashboardVisuals` já renderiza nove quadros.
