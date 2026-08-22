## Why

Depois que um projeto é criado, seu nome fica efetivamente imutável na interface. Isso impede corrigir erros de digitação, atualizar nomes de iniciativas ou refletir mudanças de contexto sem criar um novo projeto.

## What Changes

- Adicionar um botão de editar no card de projeto.
- Abrir um fluxo de edição com o nome atual preenchido.
- Persistir a alteração do nome pela API e atualizar o card imediatamente após sucesso.
- Permitir a edição somente para usuários com permissão administrativa no projeto.
- Validar nome obrigatório e impedir duplicidade de nomes dentro do mesmo workspace.
- Exibir feedback de erro e manter o valor anterior quando a atualização falhar.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `project-management`: adicionar a capacidade de administradores renomearem projetos existentes, com validação de nome e controle de permissão.

## Impact

- Frontend: card/lista de projetos e fluxo de edição do nome.
- Backend: endpoint de atualização de projeto, validação de membership/RBAC e tratamento de conflito de nome.
- Banco de dados: nenhuma alteração de schema esperada; o campo de nome existente será atualizado.
- API: novo uso do endpoint `PATCH /projects/:projectId` ou ajuste do endpoint existente, conforme a implementação atual.
- Testes: cobertura de permissão, validação, duplicidade, sucesso e falha de atualização.
