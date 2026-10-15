# Proposal

## Why

Duas fricções ficaram visíveis no uso do board e do dashboard depois da mudança de progresso por coluna:

- **A barra do card é o único indicador que não acompanha a lista.** Ela só existe quando o card tem checklist e mostra `marcados/total`. Um card em "A Testar", sem checklist, aparece sem indicação nenhuma, enquanto a lane, a árvore e o dashboard já mostram 90% para o mesmo card. O lugar onde a pessoa olha primeiro é justamente o que não conta a mesma história.
- **Nomes longos quebram layouts de leitura.** O chip de filtro ativo do board, o eixo "Carga da Equipe" no dashboard e a coluna Responsável da árvore exibem o nome completo ("Thiago Corrêa Simas de Melo Porto"): o chip estoura a linha, o eixo corta de forma cega (perdendo o sobrenome) e a coluna da árvore comprime as demais.

## What Changes

- A barra do card passa a refletir o **avanço** (peso da coluna refinado pelo checklist), a mesma regra das lanes, da árvore e do dashboard. O contador do checklist permanece, e a barra ganha rótulo acessível de avanço no fluxo.
- Nomes de pessoas passam a ser exibidos em **duas partes** (primeira + última), limitados a 24 caracteres com reticências, mantendo o nome completo em tooltip/aria, nos chips de filtro ativo do board, no eixo da carga da equipe e na coluna Responsável da árvore.

## Capabilities

### New Capabilities

- `person-name-display`: regra única de exibição de nomes de pessoas nas superfícies de leitura (chips, eixos e colunas), preservando o nome completo para identificação.

### Modified Capabilities

- `kanban-card-layout`: a região entre etiquetas e rodapé deixa de ser exclusiva de checklist e passa a exibir a barra de avanço do card.
- `progresso-por-coluna`: o card do Kanban passa a exibir o avanço calculado pela regra do peso de coluna, junto do contador de checklist.

## Impact

- **Board:** `KanbanCard` ganha a barra de avanço; `BoardColumns` resolve os pesos das colunas e passa o valor do card; o preview de arraste continua funcionando sem a prop.
- **Dashboard:** o eixo da carga da equipe troca o corte cego de caracteres pela regra de duas partes.
- **Árvore:** a coluna Responsável exibe o nome em duas partes com o nome completo no tooltip.
- **i18n:** uma chave nova para o rótulo acessível do avanço, nos três idiomas.
- **Servidor:** nenhuma mudança — o peso por coluna já está no contrato de colunas.
- **Fora do escopo:** modal de item e opções de seleção (selects) de Responsável/Autor continuam com o nome completo.

## Board ref

T75 (barra do card) e T76 (nomes em duas partes) — projeto Azyboard.
