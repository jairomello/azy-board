## Why

A atualização em lote por filtros isola corretamente os itens por `tenant_id` e projeto, mas carrega `item_sprints` e `item_tags` inteiros, incluindo relações de todos os tenants, antes de filtrar em memória. Isso desperdiça memória, aumenta o custo proporcional ao banco inteiro e enfraquece a defesa contra isolamento cross-tenant. O Item 15 deve corrigir a consulta sem alterar o contrato público do batch.

## What Changes

- Restringir a carga de `item_sprints` e `item_tags` aos itens ativos do projeto e ao `tenant_id` autenticado.
- Fazer o filtro de relações no banco por join/`EXISTS`, eliminando as tabelas globais carregadas em memória.
- Garantir que filtros de sprint/tag e mudanças de relações continuem determinísticos e equivalentes aos contratos atuais.
- Adicionar testes de isolamento entre tenants, projeto, itens arquivados e relações que não pertencem ao conjunto selecionado.
- Medir/limitar a quantidade de linhas carregadas e documentar os índices necessários para a consulta.

## Capabilities

### New Capabilities

- `tenant-scoped-batch-relations`: relações de tags e sprints carregadas e aplicadas ao batch dentro do escopo de tenant/projeto.

### Modified Capabilities

- Nenhuma. A API batch mantém o mesmo payload, filtros, respostas por item e semântica `atomic`; a mudança é de isolamento e plano de consulta.

## Impact

- `apps/api/src/routes/batch.ts`, especialmente a atualização em lote por filtros.
- Índices/migration somente se a análise confirmar que os índices atuais não sustentam o join; nenhuma nova dependência prevista.
- Testes de integração e isolamento multi-tenant.
- Sem alteração de frontend, MCP ou formato de resposta.

Board ref: b135994a-3a1a-4df5-a7f6-d555feb3b6b2
