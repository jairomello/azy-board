## 1. Mapear o fluxo existente

- [x] 1.1 Identificar a tela `Projects`, o componente de card, as ações administrativas e o padrão de diálogo/feedback já usado no frontend.
- [x] 1.2 Mapear a rota de projetos, o serviço/repositório de exclusão existente e todas as tabelas que referenciam projeto no schema Drizzle.

## 2. Implementar exclusão segura no backend

- [x] 2.1 Criar ou ajustar o endpoint `DELETE /projects/:projectId` com autenticação, membership, papel ADMIN e filtros obrigatórios de `tenant_id` e `user_id`.
- [x] 2.2 Implementar a exclusão do projeto e de todos os registros filhos em uma transação Drizzle, usando cascades existentes ou deletes explícitos na ordem correta.
- [x] 2.3 Adicionar migração de foreign keys com cascade somente onde o schema exigir e incluir os comentários `[TENANT]` e `[DB-SWAP]` nos pontos aplicáveis.
- [x] 2.4 Definir respostas para sucesso, recurso não encontrado, falta de permissão e falha transacional sem revelar recursos de outro tenant.

## 3. Adicionar a ação na tela de projetos

- [x] 3.1 Renderizar o botão de lixeira no card somente para usuários ADMIN e impedir que o clique propague para a navegação do card.
- [x] 3.2 Implementar diálogo acessível com nome do projeto, aviso de exclusão permanente e ações separadas de cancelar e confirmar.
- [x] 3.3 Enviar a requisição somente após confirmação, desabilitar ações durante o carregamento e tratar erro sem remover o card.
- [x] 3.4 Remover o projeto da lista e exibir feedback de sucesso após uma resposta de exclusão bem-sucedida.

## 4. Cobertura e verificação

- [x] 4.1 Testar no backend autorização ADMIN, bloqueio de MEMBER/VIEWER, isolamento cross-tenant e comportamento para projeto inexistente.
- [x] 4.2 Testar a exclusão em cascata de um projeto com registros dependentes e o rollback quando uma exclusão falhar.
- [x] 4.3 Testar no frontend visibilidade da ação, confirmação, cancelamento, prevenção de navegação e atualização da lista.
- [x] 4.4 Executar typecheck, lint e a suíte de testes relevante, corrigindo regressões antes de concluir.
