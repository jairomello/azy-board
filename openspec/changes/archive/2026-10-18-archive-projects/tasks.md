# Tasks

Board ref: 5ba05757-4c53-4012-bc84-2d32f936177a

## 1. Persistência e listagem

- [x] 1.1 Adicionar `isArchived` aos modelos/tipos e aos schemas SQLite e PostgreSQL, com migrações default `false`; verificar que testes de migração e paridade dos drivers passam e que projetos existentes permanecem ativos.
- [x] 1.2 Estender adapters e porta de listagem para filtrar projetos por `includeArchived` independentemente de `includeHidden`; verificar cenários dos filtros combinados, membership, tenant e escopo da API Key nos testes de persistência/API.

## 2. Operações de arquivamento da API

- [x] 2.1 Implementar endpoints de arquivar/restaurar projeto, exigindo `ADMIN`, contexto tenant-scoped e alteração somente do estado do projeto; verificar HTTP 403/404, preservação dos dados e ciclo arquivar-restaurar em testes de integração.
- [x] 2.2 Expor `isArchived` e o parâmetro `includeArchived` nos contratos e projeções de projeto; verificar compatibilidade das respostas e que clientes sem o parâmetro recebem somente projetos ativos.

## 3. Listagem de projetos na Web

- [x] 3.1 Adicionar busca local pelo nome, sem distinção de caixa, com estado vazio específico e preservação dos demais filtros; verificar correspondência, limpeza e nenhum resultado em testes da página.
- [x] 3.2 Adicionar controle entre projetos ativos e arquivados, ações de arquivar/restaurar nos cards `ADMIN`, confirmação antes de arquivar e feedback de erro; verificar cancelamento, propagação do clique, atualização do cache e restauração nos testes da interface.
- [x] 3.3 Incluir rótulos, acessibilidade e textos necessários nas traduções suportadas; verificar cobertura de i18n e associação dos controles com seus nomes acessíveis.

## 4. Verificação integrada

- [x] 4.1 Adicionar ou atualizar fluxo de smoke/e2e cobrindo arquivar, localizar na visualização de arquivados, restaurar e buscar projeto; verificar o fluxo com `bun run test:smoke`.
- [x] 4.2 Executar `bun run check` e corrigir typecheck, lint, testes e build relacionados à mudança; confirmar que a lista padrão não mostra arquivados e que ocultação e restrição continuam funcionando independentemente.
