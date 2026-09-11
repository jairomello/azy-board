---
title: Administrar Usuários do Tenant
type: guide
order: 5
---

# Administrar Usuários do Tenant

A administração de usuários permite listar as contas do tenant, criar novas contas e ajustar o grupo global de cada pessoa. A tela está disponível somente para contas `ADMIN` e `ROOT`.

## Onde encontrar

1. Selecione **Administração** na barra lateral.
2. Abra **Usuários**.

A URL da tela é `/admin/users`. Contas `TEAM_MEMBER` e `MANAGER` não veem o menu nem acessam a rota.

## Consultar os usuários

A listagem apresenta as contas do tenant atual com nome, e-mail e grupo global. O grupo global é o nível de privilégio da conta, na ordem cumulativa:

| Grupo | Escopo |
|---|---|
| `TEAM_MEMBER` | Participa de projetos e opera conteúdo; sem acesso à administração. |
| `MANAGER` | Além das capacidades de membro de equipe, pode criar projetos. |
| `ADMIN` | Além das capacidades de gerente, administra usuários do tenant. |
| `ROOT` | Nível máximo, reservado a funções de plataforma. |

## Criar um usuário

1. Acione a ação de criação.
2. Informe nome, e-mail e senha inicial.
3. Escolha o grupo global da conta.
4. Confirme.

A senha inicial é definida no momento da criação; não existe fluxo de autoatendimento de recuperação de senha. Compartilhe a credencial inicial por canal seguro e oriente a pessoa a guardá-la.

## Ajustar o grupo global

1. Localize a conta na listagem.
2. Acione a edição do grupo.
3. Escolha o novo grupo e confirme.

Regras aplicadas:

- Admin pode atribuir somente `TEAM_MEMBER`, `MANAGER` ou `ADMIN`.
- A atribuição de `ROOT` é reservada ao Root.
- Uma conta não pode alterar o próprio grupo; o controle aparece desabilitado para a conta autenticada.
- As regras são aplicadas no servidor; a interface apenas reflete o que a API autoriza.

## Regras e comportamentos

- A listagem e as mutações são limitadas ao tenant da conta autenticada.
- Alterar o grupo global afeta imediatamente as áreas visíveis na navegação e as autorizações do servidor.
- Remover o acesso de uma pessoa a projetos específicos continua sendo feito pelas configurações de cada projeto, em **Membros**.

## Funcionalidades relacionadas

- [[10 - Referencia/Perfis e Permissoes|Perfis e permissões]]
- [[01 - Acesso e Navegacao/Entrar e Manter a Sessao|Entrar e manter a sessão]]
- [[07 - Configuracoes do Projeto/Gerenciar Membros e Papeis|Gerenciar membros e papéis]]

<details>
<summary><strong>Como funciona tecnicamente</strong></summary>

As rotas de administração exigem grupo global `ADMIN` ou superior (`GET /users`, `POST /users`, `PATCH /users/:id/group`). A atribuição de `ROOT` por um Admin é recusada com `403`; apenas o Root pode criar ou promover outra conta `ROOT`. O grupo global integra o token de sessão e é reavaliado a cada requisição.

</details>
