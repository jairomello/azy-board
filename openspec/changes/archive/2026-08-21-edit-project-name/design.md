## Context

A tela `ProjectsPage` lista os projetos em cards clicáveis, mas o card não possui ação de edição. O backend já possui `PATCH /projects/:id`, protegido por `requireRole('ADMIN')`, e aceita o campo `name`; porém, a listagem atual retorna apenas os dados do projeto, sem o papel do usuário na membership, e a atualização não valida nome vazio ou duplicidade.

A solução deve preservar o isolamento por tenant, o RBAC server-side e o padrão de chamadas através do helper `api` do frontend.

## Goals / Non-Goals

**Goals:**

- Exibir a ação de edição somente para memberships com papel `ADMIN`.
- Permitir alterar o nome diretamente a partir do card do projeto.
- Reutilizar o endpoint `PATCH /projects/:id` com resposta do projeto atualizado.
- Validar nome obrigatório, normalizar espaços laterais e rejeitar duplicidade dentro do tenant.
- Atualizar a lista sem recarregar a página após uma alteração bem-sucedida.
- Manter o card navegável para o board e impedir que a ação de edição navegue para o board.

**Non-Goals:**

- Alterar descrição, gerente, membros ou outras propriedades do projeto neste fluxo.
- Criar um novo endpoint ou alterar o schema do banco.
- Permitir renomeação por MEMBER ou VIEWER.
- Alterar regras de criação ou exclusão de projetos além da validação compartilhada de nome.

## Decisions

### Reutilizar o endpoint de atualização existente

O fluxo usará `PATCH /projects/:id` com `{ name }`, em vez de criar uma rota específica. Isso mantém a API consistente com a edição já existente nas configurações e conserva o `requireRole('ADMIN')` como autoridade server-side.

Alternativa considerada: endpoint separado `/projects/:id/name`. Foi descartado por duplicar autorização e contrato para uma operação já suportada.

### Retornar o projeto atualizado

O endpoint retornará o registro atualizado, incluindo ao menos `id`, `name` e `description`. A tela substituirá o item correspondente no estado local, evitando uma segunda chamada `GET /projects`.

Alternativa considerada: retornar apenas `{ ok: true }` e atualizar o estado com o texto local. Foi descartado porque o servidor deve ser a fonte de verdade após normalização.

### Incluir o papel da membership na listagem

`GET /projects` passará a incluir o papel da membership do usuário no resultado, por exemplo `{ ...project, role }`. O frontend usará esse campo apenas para visibilidade da ação; a API continuará bloqueando tentativas não autorizadas.

Alternativa considerada: exibir o botão para todos e depender somente do erro `403`. Foi descartado por oferecer uma ação que o usuário não pode executar e por piorar a experiência.

### Validar nome no servidor

O backend fará `trim`, rejeitará nome vazio com `400` e verificará outro projeto do mesmo tenant com o mesmo nome, retornando `409` em caso de conflito. A mesma regra será aplicada no `PATCH` e a criação existente será preservada ou alinhada para evitar comportamentos divergentes.

Alternativa considerada: validar apenas no frontend. Foi descartada porque não protege chamadas diretas à API nem evita condições de corrida entre clientes.

### Card com ação sem botão aninhado

Como o card atual é um `<button>` inteiro, a implementação substituirá o contêiner interativo por um elemento semântico equivalente, ou reorganizará a área clicável, para que o botão de editar não fique aninhado em outro botão. A ação de editar abrirá o modal e interromperá a navegação do card.

## Risks / Trade-offs

- [Risco] Dois usuários podem tentar usar o mesmo nome simultaneamente → Mitigação: validar no servidor em cada atualização; se o banco não possuir constraint, aceitar que a checagem é a proteção atual e cobrir o conflito com teste de integração.
- [Risco] Clientes antigos podem ignorar o novo campo `role` da listagem → Mitigação: o campo é aditivo e o backend continua protegendo a operação; clientes sem o campo simplesmente não exibem a ação.
- [Risco] Alterar a estrutura do card pode afetar acessibilidade ou navegação → Mitigação: manter foco, label acessível no botão de edição e testes de interação para abrir board versus editar.
- [Risco] Erros da API podem deixar o modal em estado inconsistente → Mitigação: manter o valor original, exibir mensagem de erro e fechar o modal somente após resposta de sucesso.

## Migration Plan

1. Atualizar o backend para expor `role`, validar nomes e retornar o projeto atualizado no `PATCH`.
2. Atualizar `ProjectsPage` com botão, modal, controle de permissão e atualização otimista somente após sucesso confirmado.
3. Executar typecheck, build e testes de API/UI.
4. Fazer deploy normalmente; não há migração de banco.

Rollback: reverter o frontend e o backend para o commit anterior. Nenhum dado exige migração reversa; nomes já alterados permanecerão persistidos.

## Open Questions

- Confirmar durante a implementação se o nome deve ser case-sensitive ou case-insensitive na detecção de duplicidade. A proposta inicial considera comparação exata após `trim`.
