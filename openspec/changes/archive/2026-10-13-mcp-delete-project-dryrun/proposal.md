# Proposal

## Why

A skill oficial manda o agente **pré-visualizar com `dryRun` antes de excluir em cascata** (`skills/azyboard/SKILL.md`), e a rota REST `DELETE /projects/:id` já implementa esse preview: recebe `dryRun`, devolve as contagens dos registros filhos e **não** exclui nada (`apps/api/src/routes/projects.ts`). O executor do MCP também já repassa a flag (`toolDeleteProject`). O que falta é o catálogo: `delete_project` declara apenas `projectId`, então o MCP rejeita `dryRun` com "Campo desconhecido: dryRun em delete_project; campos aceitos: projectId" — **reproduzido na instalação publicada (labapps) em 13/10/2026**. Sem isso, o agente não consegue cumprir a orientação da skill e a pré-visualização existe mas é inalcançável.

## What Changes

- Declarar `dryRun` como booleano opcional em `delete_project` (`packages/tool-registry`), com descrição própria no schema exposto.
- Validar o tipo no catálogo, rejeitando valor não booleano com erro acionável que cita o campo (mesmo padrão de `hideModules`/`advancedChecklists`) em vez de deixar a falha para o REST.
- Cobrir com testes: catálogo exposto, validação, encaminhamento do `{ dryRun: true }` ao `DELETE`, preview que não exclui (contagens) e exclusão real com `dryRun: false`.
- Documentar o preview em `skills/azyboard/references/mcp-operations.md`, junto da orientação de mutação destrutiva.

**Alternativa considerada e rejeitada:** remover a menção "suporta dryRun" da descrição da ferramenta. Descartaria capacidade já implementada e testada no REST/executor, contrariaria a orientação vigente da skill e deixaria a documentação do produto mentindo em uma direção diferente. Declarar o campo é alinhar o catálogo ao comportamento existente, sem regra nova.

Sem **BREAKING**: campo opcional acrescentado; sem `dryRun` nada muda (a exclusão continua igual) e `projectId` segue obrigatório.

## Capabilities

### New Capabilities
<!-- Nenhuma capability nova: é alinhamento do catálogo existente. -->

### Modified Capabilities
- `mcp-tool-registry`: novo requisito de pré-visualização de exclusão de projeto em `delete_project` (`dryRun`), com descrição no schema, validação acionável e paridade com o REST.

## Impact

- `packages/tool-registry/src/fields.ts` (campo aceito) e `src/registry.ts` (descrição do campo; a descrição da ferramenta já cita `dryRun`).
- `packages/tool-registry/src/validation.ts` (tipo booleano com erro acionável).
- Testes: contrato do catálogo (`registry-contract.test.ts`), campos opcionais/encaminhamento (`apps/mcp/src/optional-fields.test.ts`) e preview ponta a ponta pelo MCP HTTP (`apps/api/src/mcp-http.test.ts`).
- `skills/azyboard/references/mcp-operations.md` e o catálogo gerado em `apps/mcp/README.md` (regerar).
- Sem mudança de REST, schema de banco, permissão ou migração: apenas o catálogo do MCP passa a expor o que já existe.
