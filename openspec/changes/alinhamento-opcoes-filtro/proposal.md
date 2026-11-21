# Proposal

## Why

No painel `Filtros`, as opções de Status quebram para uma segunda linha. Como o
rótulo do grupo (`STATUS`) e as opções dividiam o mesmo contêiner com
`flex-wrap`, a linha quebrada não tem referência estável: o recuo da segunda
linha fica diferente do início da primeira (`Concluída`/`Cancelada`), o que
deixa o grupo visualmente torto. O mesmo padrão de markup existe nos grupos
Tipo e Tags, que também podem quebrar linha com rótulos longos.

## What Changes

- As opções de Status passam a viver em um contêiner de quebra próprio, alinhado
  sob a primeira opção; as linhas quebradas começam no mesmo eixo.
- O rótulo do grupo (`w-20`) deixa de encolher e fica no topo do bloco, alinhado
  à primeira linha de opções.
- O mesmo tratamento é aplicado aos grupos Tipo e Tags para manter o painel
  consistente quando essas opções quebrarem linha.
- Teste de regressão garante que todas as opções de Status compartilham o
  contêiner de quebra (e não o contêiner do rótulo).

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `board-filters`: layout dos grupos de opções com quebra de linha alinhada sob a
  primeira opção.

## Impact

- Apenas `apps/web/src/components/BoardFilters.tsx` (markup/classes) e o teste do
  componente. Sem mudança de estado, contrato de API ou comportamento de filtro.
