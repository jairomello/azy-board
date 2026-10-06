Board ref: 25667747-2b18-43b6-badc-a2e461527c44

## Context

O Board já tem `hooks/{useBoardData,useBoardPreferences,useBoardInteraction}.ts`, `model/{interaction,mutation,types}.ts` e componentes `BoardLanes`/`BoardModals`. `BoardScreen.tsx` ainda reúne filtros, DnD, seleção/carregamento de modais, arquivamento e subscriptions `assistantViewStore`/`assistantFocusStore`. `board-interaction.test.ts` e `board-interaction-contract.test.ts` coexistem. A proposta preserva comportamentos de `frontend-testing`, `optimistic-mutations`, `realtime-sync` e `i18n`; não trata tamanho de arquivo como garantia de qualidade.

## Goals / Non-Goals

**Goals:** composition root pequeno; responsabilidades e dependências explícitas; interação protegida em DOM/navegador; scanner de texto/chaves com diagnóstico preciso; bundle e acessibilidade sem regressão.

**Non-Goals:** redesign, troca de estado global, mudança de contratos HTTP, implementação de outbox/realtime distribuído ou tradução de conteúdo do usuário.

## Decisions

### Extrair por fluxo, reutilizando os modelos existentes

Recomendar novos módulos dentro de `features/board`: controller de filtros/população; controller DnD/mutações; controller edição/arquivamento; hook de sessão/snapshot do agente. `BoardScreen` compõe dados, controllers e componentes, sem HTTP inline nem implementação de drag/filtro/snapshot. Manter funções puras nos modelos e identidade por projeto; subscriptions têm cleanup e não publicam estado de projeto anterior. Evitar mega-hook que apenas transfere 1.220 linhas. Path exato segue nomenclatura atual, com teste de fronteira estrutural justificável.

### Testar comportamento antes da extração

Inventariar testes que leem fonte e marcar quais alegam comportamento. Para cada um, criar substituto observável verde antes de remover o anterior. DOM consulta por papel/nome; jornada cobre login, criação/edição/movimentação/reordenação, filtros/preferências, Settings e agente determinístico. Simular 409/revisão, 403 e 5xx, resposta tardia e reconexão com lacuna: rollback preserva mudanças mais novas, refetch resolve conflito, status só passa a sincronizado após reconciliação. Esperas por estado, sem sleeps fixos. T38/T39 fornecem contratos; o frontend não cria outro mecanismo de idempotência/barramento.

### Scanner sintático com exceções limitadas

Evoluir `scripts/check-i18n.ts` com AST TypeScript (reusar dependência existente, conferir licença) em vez de ampliar regex. Cobrir JSXText, atributos visíveis/acessíveis, strings em expressões JSX, toasts e mensagens de validação UI, inclusive ASCII. Resolver `useTranslation`/aliases/namespace/keyPrefix, `t`, `Trans`, pluralização e interpolação contra PT-BR/EN/ES. Chaves dinâmicas precisam conjunto finito tipado/manifesto validado; expressão opaca sem declaração falha com local/motivo. Exceções por ocorrência ou regra estreita com motivo e responsável, nunca exclusão global de feature. Conteúdo de usuário, identificadores e URLs não são texto de produto. Fixtures positivas/negativas impedem perda da paridade já existente. Regex pura foi rejeitada por falsos negativos e remoção ingênua de comentários.

### Acessibilidade e bundle como critérios de preservação

Reutilizar `apps/web/bundle-budget.json` e `scripts/check-bundle.ts`, sem elevar limites para acomodar a extração. Testar foco inicial/devolução de modal, operação por teclado, nomes acessíveis e feedback de conflito/reconexão em PT-BR/EN/ES; movimento de card precisa alternativa por teclado acessível, mesmo que drag use ponteiro. Auditoria automatizada sem violações críticas/sérias e verificações manuais registradas. Não impor uma nova meta numérica de bundle sem evidência.

## Risks / Trade-offs

- [Closures antigas e ordem de efeitos] → testes de troca de projeto e resposta tardia; dependências explícitas, cleanup por sessão.
- [Rollback apaga evento mais recente] → modelo de mutação com revisão e teste concorrente; reconciliar estado do servidor.
- [Scanner ruidoso] → fixtures e exceções estreitas revisadas; não ignorar texto sem acento.
- [Refatoração perde T17/T18 ou densidade compacta] → jornadas de filtros/reveal/foco/snapshot e layout aprovado antes/depois.
- [Suíte instável] → provider determinístico de teste e stack isolado; traces em falha.

## Migration Plan

Criar substitutos de teste, extrair um fluxo por vez, preservar preferências e schema do snapshot, ampliar scanner em modo diagnóstico para limpar ocorrências e então torná-lo reprovativo. Deploy sem migration de banco. Rollback do bundle da aplicação anterior; não apagar preferências ou alterar versão do snapshot. T43 integra esses gates sem duplicar as jornadas.

## Open Questions

Nenhuma bloqueante. Inventário inicial decidirá quais contratos são invariantes estruturais legítimos; todos os contratos que alegam comportamento precisam substituto observável.
