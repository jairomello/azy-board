## 1. Contrato e validação da API

- [x] 1.1 Atualizar `GET /projects` para retornar o papel (`role`) da membership do usuário junto com cada projeto.
- [x] 1.2 Atualizar `PATCH /projects/:id` para normalizar o nome, rejeitar valor vazio com `400` e retornar o projeto atualizado.
- [x] 1.3 Adicionar validação de duplicidade de nome dentro do tenant, retornando `409` sem alterar o projeto em conflito.
- [x] 1.4 Garantir que a autorização `ADMIN`, os filtros de `tenant_id` e a proteção contra IDOR permaneçam aplicados no fluxo de atualização.

## 2. Interface de edição

- [x] 2.1 Atualizar o modelo de projeto em `ProjectsPage` para consumir o papel retornado pela API.
- [x] 2.2 Adicionar botão de editar visível apenas para projetos nos quais o usuário é `ADMIN`, com label acessível e sem navegação para o board.
- [x] 2.3 Ajustar a estrutura clicável do card para não aninhar o botão de edição em outro elemento `<button>`.
- [x] 2.4 Implementar modal ou formulário de edição com nome atual preenchido, foco inicial, cancelamento e fechamento sem persistência.
- [x] 2.5 Persistir o novo nome via `api.patch`, atualizar o card com a resposta do servidor e manter o nome anterior quando houver erro.
- [x] 2.6 Exibir mensagens de validação e conflito retornadas pela API sem perder o valor digitado.

## 3. Verificação

- [ ] 3.1 Adicionar ou atualizar testes da API para sucesso, nome vazio, duplicidade, projeto inexistente e tentativa de atualização por MEMBER/VIEWER.
- [ ] 3.2 Adicionar testes de interface para visibilidade da ação por papel, abertura/cancelamento do formulário, salvamento e navegação para o board.
- [x] 3.3 Executar typecheck e build do frontend e backend, corrigindo eventuais erros de TypeScript.
- [x] 3.4 Validar manualmente a atualização de um projeto no ambiente publicado e confirmar que a lista permanece consistente após recarregar a página.
