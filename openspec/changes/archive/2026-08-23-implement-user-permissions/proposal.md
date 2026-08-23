## Why

A plataforma ainda não possui uma política explícita de autorização para diferenciar usuários administrativos dos participantes de projetos. Isso impede limitar a visibilidade por projeto, proteger configurações e oferecer administração segura de usuários dentro de cada tenant. A mudança estabelece agora a hierarquia de grupos e reserva o nível Root para a futura administração global da plataforma.

## What Changes

- Introduzir os grupos cumulativos `Membro de Equipe`, `Gerente`, `Admin` e `Root`, do menor ao maior privilégio.
- Restringir membros de equipe e gerentes aos projetos nos quais estão associados.
- Permitir que membros de equipe operem o conteúdo do projeto, mas ocultar Administração e Configurações do projeto.
- Permitir que gerentes criem projetos e gerenciem suas configurações, sem acesso ao módulo de Administração.
- Permitir que admins visualizem e operem todos os projetos do tenant, além de cadastrar usuários e definir seus grupos.
- Impedir que qualquer usuário eleve o próprio grupo ou que um Admin atribua o grupo Root.
- Disponibilizar o grupo Root como nível reservado para futura parametrização da plataforma, tenants e funções globais.
- Classificar o usuário pré-configurado `jairo.silva@ntconsult.com.br` como Root, preservando a senha de teste existente.
- Adicionar o grupo de menu `Admin` na navegação lateral, visível somente a usuários autorizados.

## Capabilities

### New Capabilities

- `user-permissions`: grupos hierárquicos, autorização server-side, escopo de projetos e administração de usuários por tenant.

### Modified Capabilities

- `auth`: incorporar o grupo do usuário à identidade autenticada e aplicar a proteção de elevação de privilégios.
- `project-management`: aplicar regras de visibilidade e operação de projetos conforme o grupo do usuário.
- `project-members-ui`: refletir na interface os projetos acessíveis e os controles permitidos por grupo.

## Impact

- Modelo de usuário, sessão/JWT, middleware de autorização e filtros de consultas multi-tenant.
- APIs e telas de usuários, navegação lateral, projetos e configurações de projeto.
- Dados de seed/setup para promover o usuário de teste a Root.
- Testes de autorização, isolamento entre tenants, escopo de projetos e visibilidade de módulos.
