## 1. Modelo E Migração

- [x] 1.1 Atualizar tipos compartilhados e schema de sprint para `PROPOSED`, `OPEN` e `CLOSED`, com datas obrigatórias no contrato.
- [x] 1.2 Criar migração SQLite/PostgreSQL que converta `PLANNED` para `PROPOSED`, `ACTIVE` para `OPEN` e `DONE` para `CLOSED`, preservando IDs, vínculos e tenant.
- [x] 1.3 Adicionar validação central de datas, status e transições, incluindo comentários `[TENANT]` e `[DB-SWAP]` exigidos.

## 2. API E Regras De Associação

- [x] 2.1 Ajustar criação, listagem e consulta de sprints para exigir nome, início e fim e retornar os novos status.
- [x] 2.2 Implementar edição de nome/datas com validação de projeto e tenant.
- [x] 2.3 Implementar abertura e fechamento com transações, garantindo no máximo uma sprint `OPEN` por projeto e impedindo reabertura de `CLOSED`.
- [x] 2.4 Bloquear no servidor criação/edição/associação de item em sprint `CLOSED`, preservando vínculos existentes.
- [x] 2.5 Ajustar consultas de sprint ativa e respostas de erro para usar `OPEN` e contratos seguros.

## 3. Configurações Do Projeto

- [x] 3.1 Completar a seção de Sprints no `SettingsPage` com formulário de nome, data de início, data de fim e status exibido.
- [x] 3.2 Adicionar ações de editar, abrir e fechar sprint com confirmação, feedback e estados de carregamento.
- [x] 3.3 Garantir que somente usuários autorizados gerenciem sprints e que validações de datas sejam acessíveis na interface.

## 4. Criação E Filtro De Cards

- [x] 4.1 Propagar sprints do projeto ao `AddCardForm` e adicionar o campo opcional Sprint sempre visível.
- [x] 4.2 Exibir no formulário somente sprints `PROPOSED` e `OPEN`, com `Sem sprint` e `Nenhuma sprint cadastrada` quando necessário.
- [x] 4.3 Enviar `sprintId` na criação rápida e criar a associação respeitando validação server-side e atomicidade.
- [x] 4.4 Manter o filtro Sprint sempre visível no `BoardFilters`, listando também sprints `CLOSED` para consulta histórica.
- [x] 4.5 Persistir/restaurar `sprintId`, limpar seleção removida e preservar compatibilidade com estados de filtro existentes.

## 5. Testes E Documentação

- [x] 5.1 Adicionar testes de migração, status inicial, datas obrigatórias, transições e exclusividade de sprint aberta.
- [x] 5.2 Adicionar testes de bloqueio de associação em sprint fechada, incluindo corrida/estado alterado antes da confirmação.
- [x] 5.3 Adicionar testes de contrato/UI para cadastro, edição, opções elegíveis, filtro sem sprints e filtro histórico.
- [x] 5.4 Atualizar documentação do Board, configurações, filtros e modelagem de sprints.
- [x] 5.5 Executar typecheck, lint, testes e build de todos os apps, corrigindo regressões antes de concluir.
