Board ref: 63658232-4112-47c3-937e-03bc6cb8fdcb

## Context

`task-hierarchy/spec.md` define Leaf Rule e STORY fixa de SIMPLE. `createItemsBatch` em `db/sqlite/itemUnitOfWork.ts` cria itens e relações, não é um contrato de cópia de checklists. `d884cc1` introduziu defaults de sprint/versão na criação; omitir esses campos contradiz a intenção de cópia vazia. Conforme `proposal.md`, T28 é trabalho novo com origem rastreável, não réplica de execução histórica.

## Goals / Non-Goals

**Goals:** duplicar STORY ou subárvore TASK/BUG com descendentes, textos/checklists e política explícita, atomicamente.

**Non-Goals:** templates persistidos, cópia entre projetos/tenants, duplicar EPIC/módulo, transferir arquivos físicos ou copiar horas/eventos/ciclos.

## Decisions

1. **Plano e comando.** `prepare_structure_duplication` resolve origem/destino e policy; `duplicate_structure` aplica planId/hash com chave T38. MEMBER para criar, leitura autorizada da origem. Plano fixa árvore, conteúdo, ordem, checklists/links escolhidos e revisão de todas as fontes; novos IDs são gerados uma vez no commit e armazenados no resultado, com mapa origem→cópia. Máximo 50 itens e 1.000 passos; excesso é erro antes da aprovação, sem truncamento.
2. **Hierarquia pelo modo.** HIERARCHICAL: STORY nova exige EPIC autorizado e TASK/BUG novo exige STORY/TASK/BUG; recalcular ancestry e respeitar limite de profundidade existente. SIMPLE: não clonar STORY fixa; copiar seus TASK/BUG descendentes para a STORY fixa do destino no mesmo projeto e explicar que não haverá nova história. Se isso não satisfaz pedido explícito de nova STORY, apresentar incompatibilidade antes de aprovação. Subárvores preservam relação pai-filho, sem inventar EPIC/módulo. Alternativa de criar estrutura hierárquica em SIMPLE foi rejeitada por violar modelo.
3. **Política normalizada na prévia.** Copiar título (override explícito da raiz), descrição, persona, objetivo, benefício, critérios, notas, prioridade, ícone/cor e tags/centro de custo válidos no mesmo projeto. Copiar pontos apenas se `points=COPY`, padrão CLEAR, e somente em folhas. Padrão responsáveis CLEAR, sprint CLEAR, versão CLEAR, links EXCLUDE, anexos EXCLUDE. Oferecer COPY ou SET explícito para responsáveis/sprint/versão; sprint COPY exclui nenhuma silenciosamente: se alguma CLOSED, rejeitar plano e pedir política CLEAR/SET. Sempre enviar `sprintIds: []`/`versionId: null` quando CLEAR, bloqueando defaults T35; relação explícita de tags/centro também evita preenchimento inesperado.
4. **Trabalho novo.** Todos os itens começam NOT_STARTED na coluna inicial desse baseStatus (seleção explícita se ambígua). Gerar códigos/IDs/autor/timestamps novos, zerar bloqueios e limpar datas operacionais. Checklists mantêm nomes/textos/ordem e descrição suportada, mas passos ficam desmarcados; datas de passos CLEAR, responsáveis seguem política e só são copiados se advancedChecklists estiver ativo. Não copiar itemLogs, duração, atividades, itemEvents, aprovações, histórico de status ou snapshots de sprint. Novos eventos de criação são emitidos normalmente.
5. **Links e anexos deliberados.** Links COPY duplica apenas metadados HTTP/HTTPS validados, nunca faz fetch. Anexos são sempre EXCLUDE nesta entrega, com contagem na prévia; pedido COPY retorna recurso não suportado sem criar nada. Isso preserva propriedade/isolamento do storage; alternativa de reaproveitar storagePath foi rejeitada por acoplar exclusão e acesso das duas estruturas.
6. **Cópia relacional atômica.** Estender UnitOfWork tipada para itens, relações, checklists/passos e links; usar helpers existentes em ambos os adapters. Revalidar hash de conteúdo/descendentes e destino no commit, não só updatedAt do pai (checklists têm vida própria). Mudança concorrente exige nova prévia. Sem projeto cross-tenant mesmo via IDs recebidos; rich text e links continuam dados.
7. **T38 como única base de execução.** Mudanças, resultado/mapa e registro idempotente ficam no mesmo commit; efeitos de realtime/analytics externos usam outbox compartilhado. Retry retorna os mesmos IDs; hash diferente com a mesma chave é conflito. Falha pré-commit não deixa itens/checklists órfãos; pós-commit retoma apenas publicação. Outra cópia intencional precisa nova chave e aprovação.

## Risks / Trade-offs

- [Conteúdo muito grande] → limite de itens/passos e bytes segundo limites compartilhados; erro explícito, nunca reduzir a árvore.
- [Fonte alterada após prévia] → fingerprint de árvore e recursos escolhidos; conflito sem escrita.
- [Responsável perdeu acesso] → revalidar membership/API key do mesmo tenant/projeto antes de copiar ou SET.
- [Anexos desejados pelo usuário] → informar exclusão e rejeitar COPY; processamento físico futuro exige extensão própria, sem promessa nesta entrega.

## Migration Plan

Adicionar plano versionado e comando de cópia pelos ports, integrar T38, depois ferramentas/preview. Manter batch existente compatível. Rollback desabilita ferramentas e mantém resultados/auditoria; não apagar cópias que já receberam trabalho do usuário.

## Open Questions

Nenhuma decisão funcional pendente. Integrar nomes físicos do contrato T38 durante implementação, sem criar infraestrutura concorrente.
