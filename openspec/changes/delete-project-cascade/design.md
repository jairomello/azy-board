## Context

Projetos são recursos multi-tenant acessíveis por membership e possuem registros dependentes, como itens do board, colunas, módulos, membros, squads, versões e demais dados associados. A tela `Projects` já apresenta cards e ações administrativas, mas não oferece exclusão. A operação precisa combinar uma interação destrutiva explícita com autorização server-side e consistência transacional.

## Goals / Non-Goals

**Goals:**

- Exibir uma ação de lixeira no card somente para usuários ADMIN do projeto.
- Solicitar confirmação antes de qualquer chamada de exclusão.
- Disponibilizar uma operação autenticada para excluir somente o projeto pertencente ao tenant e autorizado ao usuário.
- Remover todos os registros filhos definidos pelo modelo de dados em uma única transação, sem órfãos nem exclusões parciais.
- Atualizar a lista local de projetos somente após sucesso e informar falhas sem mascará-las.

**Non-Goals:**

- Não criar lixeira, restauração ou exclusão lógica nesta mudança.
- Não permitir exclusão por MEMBER ou VIEWER.
- Não alterar o fluxo de exclusão de cards/itens do Kanban.
- Não adicionar um endpoint para apagar o tenant inteiro.

## Decisions

- **Ação no card com confirmação modal:** a lixeira ficará junto às ações existentes do card, sem disparar a navegação para o board. Um diálogo acessível exibirá o nome do projeto e o aviso de exclusão permanente; cancelar fecha o diálogo e não faz requisição. Isso é preferível a `window.confirm`, pois mantém o padrão visual e de acessibilidade da aplicação.
- **Autorização no backend:** o endpoint de exclusão exigirá autenticação, membership no projeto e papel ADMIN, além dos filtros `tenant_id` e `user_id` exigidos pelo anti-IDOR. A interface esconderá a ação para reduzir erros, mas não será considerada mecanismo de segurança.
- **Transação no serviço de projetos:** a exclusão será executada por um serviço/repositório de projetos dentro de uma transação Drizzle. Quando houver foreign keys com cascade configuradas, elas serão usadas e verificadas; caso contrário, o serviço excluirá explicitamente as tabelas dependentes em ordem segura antes do projeto. A escolha evita deletes parciais e funciona tanto no SQLite quanto no PostgreSQL.
- **Resposta e estado do frontend:** o cliente fará `DELETE /projects/:projectId` (seguindo o prefixo efetivo da API), removerá o projeto da lista após HTTP de sucesso e manterá o card em caso de erro. Feedback de carregamento impedirá confirmações duplicadas.
- **Eventos e dados externos:** a operação não publicará eventos individuais para cada filho. Se houver sincronização realtime existente para projetos, será emitida uma notificação de projeto excluído após o commit; falhas de notificação não devem desfazer uma transação já confirmada.

## Risks / Trade-offs

- [Projeto com muitos registros] → A transação pode durar mais e bloquear concorrência; usar deletes por relações/foreign keys existentes e cobrir o caso com teste de integração.
- [Relacionamento sem cascade ou tabela esquecida] → A operação pode falhar por constraint ou deixar dados órfãos; mapear todas as tabelas que referenciam projeto no schema e validar com teste de contagem antes/depois.
- [Duplo clique ou duas abas] → Uma segunda exclusão pode retornar recurso inexistente; desabilitar a ação durante a chamada e tratar 404 como estado já removido, sem expor dados de outro tenant.
- [Exclusão irreversível] → Um erro de confirmação pode causar perda definitiva; mostrar o nome do projeto e a natureza em cascata no diálogo, exigindo uma ação afirmativa separada.

## Migration Plan

1. Implementar o endpoint/serviço e a cobertura de autorização e cascata.
2. Implementar a ação do card, diálogo de confirmação e atualização da lista.
3. Executar testes de banco/API e testes da tela em ambiente de desenvolvimento.
4. Publicar normalmente; se a implementação exigir alteração de foreign keys, aplicar a migração antes do novo endpoint.
5. Em caso de falha de rollout, desabilitar a ação/rota e reverter a migração de constraint somente conforme o procedimento do banco; não há restauração de dados após uma exclusão confirmada.

## Open Questions

- Confirmar no schema durante a implementação a lista completa de tabelas filhas e se as foreign keys existentes já suportam cascade.
- Confirmar o contrato/prefixo exato da rota de projetos e o componente de diálogo padrão já utilizado pela tela `Projects`.
