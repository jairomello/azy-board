## Context

O card B1 (`00b4a9b6-15c2-4467-84b5-32e9c29c818a`) relata que o drag-and-drop de cards na mesma coluna aparenta funcionar durante o arraste, mas perde a nova posição ao soltar. O Board usa `@dnd-kit`, cards folha e o endpoint existente `PATCH /projects/:id/items/reorder`.

A correção deve atuar na fronteira de interação do frontend, sem criar endpoint, alterar banco ou modificar a regra de que somente cards folha são móveis. A resolução do alvo precisa lidar tanto com o ID de um card quanto com marcadores de drop/coluna, e a ordem enviada deve representar todos os cards persistíveis da coluna.

## Goals / Non-Goals

**Goals:**

- Persistir corretamente a nova posição ao reordenar cards na mesma coluna.
- Manter atualização otimista e rollback completo em falha da API.
- Excluir cards virtuais de histórias e itens não persistíveis do payload de reorder.
- Preservar movimentação entre colunas, ordenação de colunas, Leaf Rule e tratamento de erro atual.
- Cobrir a resolução do alvo e o fluxo de mutação com testes determinísticos.

**Non-Goals:**

- Não alterar o endpoint ou o payload público de reorder.
- Não mudar persistência de colunas, filtros, lanes ou sincronização WebSocket.
- Não adicionar dependências ou alterar o modelo de dados.

## Decisions

### 1. Centralizar a normalização do alvo

O handler usará um único adaptador para transformar o `over` efetivo em uma coluna destino e, quando necessário, em um card âncora. IDs de coluna, marcadores `:drop:`/`:col:` e IDs de cards devem ser tratados de forma explícita.

Alternativa considerada: corrigir somente o componente visual que cria os droppables. Foi rejeitada porque o mesmo handler recebe eventos de cards, colunas e fallback de `effectiveOver`.

### 2. Reordenar a lista persistível completa

Para reorder na mesma coluna, o handler construirá a lista a partir dos itens persistíveis da coluna, ordenada pela posição atual, moverá o card ativo para o índice do card alvo e enviará a lista completa em `order`. Cards virtuais e itens fora da coluna não participarão do payload.

Alternativa considerada: enviar somente o card ativo e a posição calculada. Foi rejeitada porque o contrato atual aceita uma ordem completa e porque posições parciais podem deixar colisões ou ordem divergente no backend.

### 3. Manter snapshot para rollback

Antes da atualização otimista, o handler guardará uma cópia dos itens. Se `PATCH /projects/:id/items/reorder` falhar, restaurará o snapshot e emitirá a mesma mensagem de erro usada pelas demais mutações do Board.

Alternativa considerada: aguardar a API antes de atualizar a UI. Foi rejeitada porque remove o feedback imediato e diverge do comportamento atual de movimentação.

## Risks / Trade-offs

- **[Risco]** O alvo pode ser uma coluna vazia, sem card âncora. → **Mitigação:** tratar drop em espaço vazio como mudança de coluna/sem reorder vertical, sem inventar uma posição de card.
- **[Risco]** Filtros podem esconder cards da coluna. → **Mitigação:** usar todos os itens persistíveis carregados para montar `order`, não somente cards virtuais ou elementos filtrados.
- **[Risco]** O rollback pode sobrescrever uma atualização recebida durante a requisição. → **Mitigação:** manter o escopo da correção no fluxo local e preservar o refresh/realtime existente; testes cobrem apenas a mutação concorrente conhecida.

## Migration Plan

1. Ajustar o adaptador de alvo e o handler de reorder no frontend.
2. Adicionar testes para reorder válido, drop sem âncora e falha da API.
3. Executar typecheck, testes, build e smoke test.
4. Fazer rollback revertendo somente a mudança do handler e dos testes, sem migração de dados.

## Open Questions

- Nenhuma para a implementação proposta; o comportamento esperado e o endpoint já estão definidos na capability `board-management`.
