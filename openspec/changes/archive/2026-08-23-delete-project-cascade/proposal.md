## Why

A tela de projetos não oferece uma forma direta de remover projetos obsoletos, obrigando o usuário a recorrer a fluxos externos ou deixando dados sem uso. A exclusão precisa ser explícita e segura, pois remove o projeto e todos os registros dependentes.

## What Changes

- Adicionar uma ação com ícone de lixeira no card de cada projeto na tela `Projects`, disponível somente para administradores do projeto.
- Exibir uma confirmação clara antes de iniciar a exclusão, informando que o projeto e seus registros filhos serão removidos permanentemente.
- Cancelar a operação sem alterar dados quando o usuário rejeitar a confirmação.
- Criar ou ajustar a operação de exclusão do projeto para remover os registros dependentes em cascata, dentro de uma transação atômica.
- Atualizar a lista de projetos após a exclusão bem-sucedida e exibir feedback de erro quando a operação falhar.
- Garantir isolamento por tenant e autorização server-side na operação de exclusão.

## Capabilities

### New Capabilities

- Nenhuma.

### Modified Capabilities

- `project-management`: permitir que administradores excluam projetos pela tela de projetos, com confirmação e remoção transacional em cascata dos registros filhos.

## Impact

- Tela frontend `Projects` e componente de card de projeto.
- API de projetos, incluindo autorização RBAC, filtragem por tenant e resposta de exclusão.
- Camada de persistência e schema para garantir a remoção dos relacionamentos dependentes sem deixar registros órfãos.
- Testes de interface, API e banco para confirmação, cancelamento, autorização, isolamento entre tenants e cascata.
