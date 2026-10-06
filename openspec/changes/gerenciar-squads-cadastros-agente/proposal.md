Board ref: 343de264-272c-4017-a7f4-5db3b595949d

## Why

O catálogo permite criar/listar squads, mas não alterar sua composição nem editar módulos, tags e centros de custo. T25 fecha essa lacuna usando as regras da aplicação, evitando confundir associação ao squad com entrada no projeto.

## What Changes

- Expor associação, troca e remoção de squad de membros existentes, preservando papel no projeto.
- Expor edição de nome do squad, nome do módulo, nome/cor da tag e código/descrição do centro de custo.
- Resolver entidades dentro do projeto, exigir desambiguação de homônimos e mostrar antes/depois na aprovação.
- Revalidar permissões e estado na execução; atualizar catálogos, filtros e métricas após sucesso.

## Capabilities

### New Capabilities
- `agent-project-catalog-management`: composição de squads e edição de cadastros pelo catálogo compartilhado.

### Modified Capabilities
Nenhuma: os contratos existentes de cadastros continuam válidos; a capacidade nova define a integração pelo agente.

## Impact

- Evidências: `apps/api/src/routes/projects.ts` (PATCH de membros, squads, módulos e centros), `apps/api/src/routes/tags.ts` (edição MEMBER), `packages/tool-registry/src/fields.ts` (`update_member` não expõe squad), `packages/tool-registry/src/registry.ts` e `policies.ts`.
- Integração em `apps/mcp/src/tools.ts`, `apps/mcp/src/registry.ts`, `apps/api/src/services/assistantHarness.ts` e consumidores web dos eventos de metadados.
- Referências: `openspec/specs/project-members-ui/spec.md`, `board-squad-filter/spec.md`, `project-cost-centers/spec.md`; oportunidades 9 do documento `docs/SUGESTOES-EVOLUCAO-AZY-AGENT.md`.
- Decisão recomendada: operação dedicada para squad sem mudar role, apoiada no PATCH de membro; não usar o POST que pode criar membership. ADMIN para composição/módulo/centro; MEMBER para editar tag, como nas rotas.
- Dependência T38 (idempotência/outbox): consumir seu contrato para repetição e publicação durável, sem criar infraestrutura paralela; a especificação não depende da implementação dessa base.
