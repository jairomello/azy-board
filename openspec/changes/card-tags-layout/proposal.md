# Proposal

## Why

Tags longas (`Entrega 02/12`, `Jornada 1`) quebram o texto dentro da própria
pílula porque não têm `whitespace-nowrap` nem largura máxima. A linha de
etiquetas ainda disputa espaço com status e tipo no mesmo `flex`, então uma tag
de duas linhas desalinha o bloco inteiro e dá aspecto amador ao card. Com muitas
tags, o card cresce sem limite e empurra progresso e rodapé.

## What Changes

- A linha de etiquetas passa a ser uma faixa própria, de uma única linha, com
  **tags truncadas por largura máxima** e o restante resumido em `+N`.
- Cada tag mantém altura fixa (`h-5`) igual aos chips de status e tipo; o texto
  nunca quebra dentro da pílula e o nome completo fica em tooltip.
- Status e tipo ganham uma linha própria, sem `flex-wrap`, com altura e
  alinhamento estáveis; deixam de competir com as tags.
- Visual das tags no card fica mais profissional: fundo tênue da cor da tag,
  ponto colorido e texto neutro, em vez do bloco sólido saturado.
- Comportamento definido para 0 tags, 1 tag longa, muitas tags e largura estreita.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `kanban-card-layout`: a linha de etiquetas/tipo ganha uma regra de layout
  estável, com truncamento, resumo `+N` e separação entre tags e estado.

## Impact

- `apps/web/src/components/KanbanCard.tsx` (markup e classes da linha de
  etiquetas/status).
- `apps/web/src/styles/globals.css` (se necessário, utilitários da pílula).
- Teste de componente/contrato do card.
- Sem API, banco, migração ou contrato externo.
