Board ref: 343de264-272c-4017-a7f4-5db3b595949d

## 1. Contratos e catálogo

- [ ] 1.1 Definir schemas SET/CLEAR e pré-condições de `set_member_squad`, edições de squad/módulo/tag/centro em `packages/tool-registry/src/registry.ts` e `fields.ts`, com limites e ao menos um campo de edição.
- [ ] 1.2 Registrar routing e políticas em `policies.ts`, distinguindo ADMIN de edição MEMBER de tags, e corrigir descrição de `update_member` sem quebrar seus argumentos.
- [ ] 1.3 Alinhar integração com T38 para chave/hash/resultado e publicação; reutilizar sua infraestrutura, documentando payloads de domínio e sem criar outro worker/outbox.

## 2. Domínio e persistência

- [ ] 2.1 Reutilizar validação/PATCH de membros em `apps/api/src/routes/projects.ts`, que já aceita edição só de squad, e acrescentar pré-condições de execução com membership preexistente e role não enviado intacto.
- [ ] 2.2 Acrescentar pré-condições e atualização parcial aos ports e adapters SQLite/PostgreSQL; comparar campos tocados no commit e preservar mudança concorrente independente de role.
- [ ] 2.3 Reutilizar validações de `projects.ts` e `tags.ts` para edições; assegurar unicidade de código de centro, rollback e no-op explícito.
- [ ] 2.4 Resolver entidades por IDs/e-mail/nome exato do projeto com homônimos explícitos; aplicar comentários `[TENANT]` e `[DB-SWAP]` nos pontos pertinentes, sem consultas cross-tenant.

## 3. Integração e experiência

- [ ] 3.1 Implementar adaptadores em `apps/mcp/src/tools.ts` e `registry.ts`, com respostas de identidade/diferenças e erros não retryable de permissão/conflito.
- [ ] 3.2 Integrar preview/execução no harness com IDs fixos, revalidação de autorização e resultados individuais para múltiplos membros; retomada preserva chaves das operações.
- [ ] 3.3 Publicar eventos existentes de metadados via T38 e invalidar caches web de membros/squads/cadastros e métricas afetadas, preservando seleção por ID.
- [ ] 3.4 Atualizar orientação da skill oficial e rótulos PT-BR/EN/ES para homônimos, troca, remoção, no-op e conflito.

## 4. Verificação

- [ ] 4.1 Testar contratos MCP/agente e políticas VIEWER/MEMBER/ADMIN; incluir IDs externos, homônimos e pessoa fora do projeto.
- [ ] 4.2 Testar troca/remoção singular, código duplicado, concorrência de squad/role e permissão perdida nos dois adapters.
- [ ] 4.3 Testar sucesso parcial de lista, retry após commit e falha de publicação com T38; confirmar ausência de efeitos duplicados.
- [ ] 4.4 Verificar fluxo web de aprovação até filtros/métricas atualizados; executar `bun run check`, `bun run test:smoke` e `bun run test:agent-skill` se a skill for alterada.
