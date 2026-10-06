Board ref: 343de264-272c-4017-a7f4-5db3b595949d

## Context

Conforme `proposal.md`, T25 é paridade de integração. `projects.ts` permite PATCH de membership com `squadId` e `projectMemberSchema` em `apps/api/src/validation.ts` já aceita role opcional; é o catálogo `fields.ts` que exige role em `update_member` e não expõe squad, apesar da descrição mencioná-lo. O POST de squad members delega a `addSquadMember`, que no adapter SQLite chama `addProjectMember`, não garantindo membership preexistente. Tags usam MEMBER, enquanto módulos, squads e centros exigem ADMIN. `project-cost-centers/spec.md` exige código único por projeto.

## Goals / Non-Goals

**Goals:** composição precisa, resolução de nomes, prévia de diferenças, paridade MCP/agente e atualização observável de filtros/métricas.

**Non-Goals:** exclusão de cadastros, múltiplos squads simultâneos por membership, convite implícito ao projeto ou mudança de papéis como efeito colateral.

## Decisions

1. **Ferramentas específicas.** Introduzir `set_member_squad`, `update_squad`, `update_module`, `update_tag`, `update_cost_center`. Squad usa SET com ID ou CLEAR explícito; campos de edição são opcionais, mas ao menos um deve mudar. Manter `update_member` compatível e corrigir sua descrição. Alternativa de sobrecarregá-la foi rejeitada para não exigir/regravar role em uma troca de squad.
2. **Domínio único nas rotas e ports.** Reutilizar o PATCH de membro que já aceita alteração somente de squad, adicionar pré-condições transacionais e preservar sua validação de membership preexistente e role opcional. Não copiar o role lido antes da aprovação. Associação singular significa troca: a prévia mostra squad antigo → novo; remoção não remove membership. Listas de pessoas geram planos por membro, com resultados individuais explícitos; não anunciar atomicidade coletiva usando chamadas independentes.
3. **Identidade autorizada.** Resolver nome exato no projeto, preferir UUID/e-mail exato e retornar candidatos mínimos para homônimos. Resolver antes da aprovação; argumentos executados contêm IDs, nunca uma nova resolução por nome. IDs de outro projeto/tenant são inválidos. Textos de cadastros são dados não confiáveis, não instruções.
4. **Concorrência por pré-condição.** Aprovação liga ID e valores anteriores dos campos tocados. Revalidar no commit e rejeitar com conflito se mudaram; mudança de role independente pode coexistir com troca de squad, desde que permissão/membership permaneçam válidas. Código de centro duplicado retorna 409 e rollback. Sem mudanças é no-op explícito.
5. **Paridade de políticas e publicação.** `policies.ts` e middleware devem concordar: leitura VIEWER; edição de tag MEMBER; demais mutações ADMIN. Revalidar na execução mesmo após aprovação. Emitir metadados members/squads/modules/tags/cost-centers usando eventos existentes. Atualizar cache de membros e métricas cujo filtro usa squad; não inferir que só renomear a entidade exige reatribuir cards.
6. **Contrato T38.** Usar chave/hash/resultado e efeitos duráveis definidos em T38 para retries; esta change define payload e eventos de domínio, não outra tabela de deduplicação/worker. Ausência da base permite desenvolver contrato/testes, mas não declarar recuperação durável entregue.

## Risks / Trade-offs

- [Troca inadvertida de role] → atualização parcial no adapter e teste de role concorrente.
- [Falha no segundo membro] → resultado por operação com sucesso/falha; retomada só dos pendentes com as chaves originais e nova prévia quando houver conflito.
- [Permissão perdida após aprovação] → negar antes de qualquer efeito; aprovação não concede acesso.
- [Eventos perdidos após commit] → publicar via T38; cliente deduplica e refaz consultas.

## Migration Plan

Adicionar schemas/ferramentas de forma compatível, depois ports/rotas e adapters SQLite/PostgreSQL, por fim invalidadores web. Não alterar modelo de squad. Pré-condições e integração T38 usam migrações compartilhadas existentes ou a evolução definida por T38. Rollback desabilita ferramentas novas, preservando memberships e edições válidas.

## Open Questions

Sem decisão de produto pendente. Na implementação, alinhar os nomes físicos da API de idempotência/outbox com T38; o contrato funcional desta change permanece o mesmo.
