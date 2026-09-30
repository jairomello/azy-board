## Context

O Item 14 lista quatro caminhos com custo proporcional à quantidade/profundidade dos itens:

- `apps/api/src/routes/items.ts`: `detectReparentCycle` lê cada ancestral via `getItem`; `isLeaf` carrega todos os itens do projeto para uma verificação pontual.
- `apps/api/src/db/sqlite/itemUnitOfWork.ts`: `collectSubtree` faz uma leitura do nó e outra de filhos por nó; `refreshDescendantAncestry` repete leitura de pai/filhos e update para cada descendente; exclusão também consulta anexos, checklists e snapshots por item.
- `apps/api/src/services/analytics.ts`: `createSprintCycle` percorre itens e consulta relação de sprint e existência de filho para cada um. O callsite atual deve ser confirmado; a otimização só é necessária se o helper continuar no fluxo suportado.
- `apps/api/src/db/postgres/adapter.ts`: `reparentSubtree` está explicitamente `NOT_IMPLEMENTED`, apesar de existir no port; as operações devem manter paridade nos perfis suportados.

O perfil SIMPLE (SQLite) é o padrão inclusive no deploy atual; ADVANCED usa PostgreSQL + Redis. Ambos os bancos suportam CTE recursiva, mas variam em sintaxe, parâmetros e forma de executar updates em lote. `items` já tem FK composta por tenant para o pai, mas não há índice dedicado `(tenant_id, project_id, parent_id)`. O `ancestryPath` JSON desnormalizado é contrato usado por breadcrumbs e detecção de ciclos; seu formato não muda.

## Goals / Non-Goals

**Goals:**

- Remover consultas de leitura por ancestral/descendente/item em reparent, delete/archive subtree, checagem de folha e snapshot do ciclo de sprint.
- Usar CTE recursiva para carregar o conjunto de nós uma vez, com limite de profundidade e filtros `tenant_id` + `project_id` em todas as etapas.
- Atualizar ancestry e excluir relações em lote dentro da transação existente; manter a limpeza de anexos via outbox e os eventos analíticos atuais.
- Adicionar o índice de filhos em SQLite e PostgreSQL.
- Implementar `reparentSubtree` no adapter PostgreSQL e conservar comportamento equivalente nos dois perfis.
- Medir consultas/round trips com testes de contrato, não apenas tempo de execução sujeito a ruído.

**Non-Goals:**

- Alterar regra de hierarquia, profundidade máxima (50), Leaf Rule, formato/semântica do `ancestryPath` ou respostas HTTP.
- Migrar SIMPLE para PostgreSQL ou adicionar serviço/dependência.
- Eliminar trabalho inevitável O(N) para atualizar/gravar N itens; o objetivo é que leituras e descobertas não executem SELECT por nó, e que writes sejam set-based ou em batches limitados pelo driver.
- Refatorar todas as leituras de relações do board que não participam dos hotspots do Item 14.

## Decisions

1. **Otimizar as operações no persistence/unit-of-work, não em loops das rotas.** Adicionar métodos focados ao port (`hasChildren`, leitura de subárvore/snapshots em lote e mutações de subárvore) e implementá-los nos adapters. A rota valida/autentica e delega; ela não carrega a árvore para depois enviá-la ao UOW. *Alternativa:* otimizar só o BFS da rota — rejeitada porque o UOW ainda repetiria as consultas dentro da transação.

2. **CTE recursiva nos dois drivers, com SQL específico por adapter.** SQLite e PostgreSQL suportam `WITH RECURSIVE`; cada CTE ancora o root por tenant/projeto e expande filhos com a mesma dupla de escopo. Retorna `id`, `parent_id`, `title`, `type`, `ancestry_path` e dados necessários à mutação. A recursão respeita MAX_ANCESTRY_DEPTH e inclui proteção contra ciclo/caminho repetido. *Alternativa:* somente CTE PostgreSQL e manter BFS N+1 em SIMPLE — rejeitada porque SIMPLE é o perfil padrão e afetaria o deploy atual.

3. **Construir ancestry em memória a partir do resultado único; gravar em lote.** Ordenar nós por profundidade determinística, calcular os caminhos usando o mapa de pai já carregado e emitir updates em lote (`UPDATE ... FROM (VALUES ...)` no PostgreSQL; `CASE/VALUES` ou chunks com prepared statement no SQLite conforme o limite de parâmetros). Isso mantém o JSON atual e elimina SELECT por nó. Títulos renomeados usam a mesma operação sobre descendentes. *Alternativa:* calcular JSON dentro da CTE em ambos — rejeitada por diferenças de JSON e maior acoplamento ao dialeto.

4. **`isLeaf` vira existência indexada, não `listItems` do projeto.** Adicionar `hasChildren(context, projectId, itemId)` com `SELECT 1 ... WHERE tenant_id=? AND project_id=? AND parent_id=? LIMIT 1`, suportado pelo índice novo. A detecção de ciclo aproveita o `ancestryPath` carregado do novo pai (um `getItem`) para buscar o item movido no caminho, preservando `MAX_ANCESTRY_DEPTH`; não sobe a cadeia com uma query por nível.

5. **Exclusão coleta IDs e dependências em lote antes de deletar.** A CTE fornece a subárvore; consultas em lote carregam snapshots para analytics e storage paths de anexos; checklists/relations e rows de item são excluídos por IDs em ordem segura (filhos antes dos pais para respeitar a FK). A transação continua única e a outbox de storage recebe todos os paths atomicamente. O plano de exclusão de módulos reutiliza uma única coleta para todos os EPICs, não uma coleta por EPIC.

6. **Abertura de sprint materializa folhas no adapter com `INSERT ... SELECT`.** O N+1 ativo está em `transitionSprint` do adapter SQLite: percorre itens e busca vínculo de sprint e filho por item. Substituir por `INSERT INTO sprint_cycle_items ... SELECT` com join de `item_sprints` e `NOT EXISTS` de filhos, sempre filtrando tenant/projeto. O adapter PostgreSQL deve executar a mesma operação set-based dentro da transação da transição. O helper `createSprintCycle` em `services/analytics.ts` não tem callsite no repositório; mantê-lo set-based por consistência e cobrir diretamente, sem tratá-lo como caminho de produção.

7. **Índice composto alinhado às CTEs e às consultas de filho.** Migration SQLite e PostgreSQL cria `(tenant_id, project_id, parent_id)` em `items`; testes de migration verificam sua presença nos dois drivers. O índice não substitui os predicados de tenant/projeto nas queries.

8. **Medição por número de consultas, não por cronômetro como único critério.** Testes de adapter contam ou interceptam leituras e demonstram que subárvore, ciclo e `hasChildren` não fazem SELECT proporcional a N; testes de integração verificam paths, exclusões e isolamento tenant/projeto. Benchmark pode complementar, mas não flutua como gate primário de CI.

## Risks / Trade-offs

- [CTE retorna árvore grande e consome memória] → limite de profundidade explícito, resultado só com colunas necessárias e operações de árvore por um projeto validado.
- [Limite de parâmetros do SQLite em updates grandes] → chunks com tamanho abaixo do limite do driver e transação única; a quantidade de chunks é proporcional ao lote, mas as leituras não são por nó.
- [CTE sem escopo composto poderia atravessar projetos/tenants] → cada âncora e passo recursivo filtra tenant e projeto; teste com IDs relacionados em projetos/tenants distintos.
- [Cálculo de ancestry pode mudar ordem ou breadcrumbs] → mapa de nós + ordenação estável e testes de igualdade exata de `ancestryPath`, incluindo rename e reparent profundo.
- [Exclusão em lote poderia quebrar FK, analytics ou outbox] → preservar filhos-primeiro, snapshots antes de delete, events na transação e teste existente/estendido de rollback e storage cleanup.
- [PostgreSQL adapter está incompleto para reparent] → implementar método como parte desta change e incluir testes do adapter; não introduzir fallback silencioso para SQLite.

## Migration Plan

1. Adicionar migrations incrementais do índice em SQLite e PostgreSQL, sem reescrever dados.
2. Estender o port e implementar consultas em lote/`hasChildren` primeiro nos adapters, preservando API atual.
3. Otimizar ancestry/reparent e exclusão/arquivamento; implementar `reparentSubtree` PostgreSQL.
4. Otimizar `isLeaf`, validação de ciclo e `createSprintCycle` se o fluxo estiver ativo.
5. Rodar testes de adapter/integração, `bun run check` e `bun run test:smoke`; comparar contagem de queries em árvores de vários tamanhos.

Rollback: reverter código e migrations de índice (índice pode ser removido sem alteração de dados); não há backfill nem mudança de formato persistido.

## Open Questions

- O helper `createSprintCycle` continua sem callsite; a transição ativa ocorre nos adapters. Não reintroduzir o helper no caminho de produção sem rever a atomicidade da transição.
- Para SQLite, o update em lote deve usar `UPDATE ... CASE` por chunk ou tabela temporária transacional? Escolher pela compatibilidade com a versão SQLite embutida no Bun e pelo teste de limite de parâmetros.
- A CTE deve falhar explicitamente ao encontrar profundidade/ciclo acima da regra, ou retornar diagnóstico para a camada de domínio? Preservar erro de domínio `HIERARCHY_CYCLE` onde já existe.
