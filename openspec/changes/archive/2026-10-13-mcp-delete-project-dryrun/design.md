# Design

## Context

- `packages/tool-registry/src/fields.ts` declara `delete_project: { fields: ['projectId'], required: ['projectId'] }` — e é a fonte única do schema exposto, da validação e do catálogo gerado.
- `packages/tool-execution/src/http-adapter.ts` já implementa `toolDeleteProject(api, projectId, dryRun = false)` enviando `{ dryRun: true }` no corpo do `DELETE`.
- `apps/api/src/routes/projects.ts` (`DELETE /:id`, `requireRole('ADMIN')`) lê o corpo com `confirmationSchema` (`{ confirm?, dryRun? }`, `.strict()`) e, com `dryRun`, devolve `{ dryRun: true, projectId, counts: { items, modules, tags, sprints, versions, members, columns, squads, conversations } }` sem excluir.
- `schemaFor` (`registry.ts`) já mapeia `dryRun` como booleano anulável, mas em um ramo compartilhado com `onlyLeaves`/`atomic`/`confirm`/`checked` **sem descrição**.
- `validateToolArguments` (`validation.ts`) não valida o tipo de `dryRun`; hoje ele nem chega lá pelo MCP, porque o campo não é declarado (o teste em labapps devolveu `Campo desconhecido: dryRun em delete_project`).
- `skills/azyboard/SKILL.md` já orienta usar `dryRun` antes de excluir em cascata — orientação inaplicável enquanto o catálogo não declarar o campo.

## Goals / Non-Goals

**Goals:**
- Tornar alcançável a pré-visualização de exclusão já implementada no REST, sem regra nova de negócio.
- Manter o catálogo como fonte única (exposição, validação e catálogo gerado coerentes).
- Erro acionável no nível da ferramenta para valor inválido.

**Non-Goals:**
- Não alterar a rota REST, o schema de banco, as permissões nem a semântica da exclusão em cascata.
- Não introduzir confirmação em duas etapas nem exigir `confirm` no MCP (o `confirm` do REST não é exposto por esta change).

## Decisions

### D1. Declarar `dryRun` no catálogo, sem criar caminho novo
Basta acrescentar o campo a `toolFields.delete_project`; a exposição, a validação e o catálogo gerado derivam daí, e o executor já encaminha a flag. Alternativa: criar rota ou ferramenta nova só para o preview — rejeitada por duplicar o que o REST já entrega no mesmo endpoint.

### D2. Descrição dedicada em `schemaFor`
Remover `dryRun` do ramo compartilhado e dar a ele um ramo próprio com descrição pt-BR (o texto do preview e o efeito de não excluir), já que a pré-visualização é o uso principal do campo. Mantém o ramo compartilhado apenas para os campos sem semântica pública própria (`onlyLeaves`, `atomic`, `checked`, `confirm`).

### D3. Validação booleana acionável
Seguir o padrão já aplicado a `hideModules`/`advancedChecklists`: `dryRun` só aceita boolean (a coerção continua convertendo `"true"`/`"false"`), com mensagem que cita o campo. Evita que um valor inválido só falhe no REST com 400 genérico.

### D4. Excluir não muda sem `dryRun`
Omitir o campo preserva exatamente o comportamento atual (exclusão direta). Nenhum default passa a pré-visualizar, para não alterar o que agentes existentes já fazem.

## Risks / Trade-offs

- **Preview confundido com confirmação** → a descrição do campo e a doc dizem explicitamente que `dryRun` apenas informa contagens; a confirmação segue sendo uma nova chamada sem `dryRun`.
- **Divergência entre contagens e exclusão** → as contagens vêm da mesma persistência usada pela exclusão; sem mudança de dados.
- **Regressão no catálogo gerado** → `check:docs` falha se `apps/mcp/README.md` não for regerado; a regeneração é passo explícito nas tarefas.
- **Campo novo virar obrigatório no modo estrito** → `schemaFor` marca anulável quando não obrigatório e o teste de campos opcionais valida os `required` reais.

## Migration Plan

Sem migração de dados e sem mudança de schema. Deploy normal das imagens `api` e `mcp`. Rollback: reverter o commit; nenhum estado novo persiste.

## Open Questions

Nenhuma que altere specs, abordagem ou tarefas.
