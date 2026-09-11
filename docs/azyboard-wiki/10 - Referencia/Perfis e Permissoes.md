---
title: Perfis e Permissões
type: reference
order: 1
---

# Perfis e Permissões

O acesso combina o grupo global da conta, a associação ao projeto e o papel local atribuído à pessoa. O grupo global define o escopo e as áreas disponíveis; o papel local define as operações dentro de um projeto acessível.

## Grupos globais

Os grupos são cumulativos, do menor para o maior privilégio:

| Grupo | Escopo e capacidades principais |
|---|---|
| `TEAM_MEMBER` — Membro de Equipe | Vê somente projetos dos quais participa e opera o conteúdo. Não acessa Administração nem Configurações do projeto. |
| `MANAGER` — Gerente | Vê projetos dos quais participa, pode criar projetos e configurar seus projetos. Não acessa Administração. |
| `ADMIN` — Admin | Vê todos os projetos do tenant, pode operar qualquer projeto e administra usuários. Não pode atribuir `ROOT`. Exceção: projetos restritos dos quais não participa permanecem inacessíveis, inclusive para Admin e Root. |
| `ROOT` — Root | Nível máximo reservado para funções futuras de plataforma; nesta versão opera projetos como Admin. |

Um usuário não pode elevar o próprio grupo. Admin pode atribuir somente `TEAM_MEMBER`, `MANAGER` ou `ADMIN`; a atribuição de `ROOT` é reservada ao Root.

O menu **Admin** aparece somente para Admin e Root. As regras são aplicadas no servidor; esconder um item de menu não substitui a autorização da API.

## Papéis dentro do projeto

Os papéis abaixo continuam existindo como uma segunda camada para membros do projeto.

## Admin

O `Admin` administra a estrutura e os participantes do projeto. Além das ações operacionais de um membro, pode:

- Gerenciar colunas do Board.
- Definir o gerente geral.
- Adicionar, editar e remover membros.
- Alterar papéis e squads.
- Criar, editar e excluir squads.
- Gerenciar módulos e centros de custo.
- Criar, editar e excluir versões.
- Criar, abrir e encerrar sprints.

## Membro

O `Membro` participa da execução do projeto. Pode:

- Criar e editar itens.
- Mover e ordenar cards.
- Criar e atualizar tags.
- Criar subtasks e checklists.
- Registrar atividades.
- Arquivar, restaurar e excluir itens.
- Associar itens a sprints existentes.
- Usar integrações conforme as credenciais vinculadas à sua conta.

## Visualizador

O `Visualizador` consulta o projeto sem alterar seu conteúdo. Pode:

- Abrir o Board e a visualização em árvore.
- Consultar itens, hierarquia, responsáveis e progresso.
- Usar filtros e controles locais de visualização.
- Consultar configurações, versões, membros e demais dados do projeto.

## Matriz resumida

| Área | Admin | Membro | Visualizador |
|---|---:|---:|---:|
| Consultar projeto e itens | Sim | Sim | Sim |
| Usar filtros e visualizações | Sim | Sim | Sim |
| Criar e editar itens | Sim | Sim | Não |
| Mover cards | Sim | Sim | Não |
| Checklists e atividades | Sim | Sim | Não |
| Arquivar, restaurar e excluir itens | Sim | Sim | Não |
| Criar, abrir e encerrar sprints | Sim | Não | Não |
| Gerenciar estrutura do projeto | Sim | Não | Não |
| Gerenciar membros e squads | Sim | Não | Não |
| Gerenciar versões | Sim | Não | Não |

> [!info] API Keys
> Um agente autenticado por API Key herda o grupo global, tenant, membership e papel local do proprietário. O escopo da chave pode restringir o acesso, mas nunca pode ampliá-lo.

<details>
<summary><strong>Como funciona tecnicamente</strong></summary>

As requisições autenticadas resolvem o usuário e o tenant. Para rotas de projeto, a aplicação primeiro aplica o grupo global e depois consulta a associação entre usuário e projeto para comparar o papel mínimo exigido pela operação. A ordem de privilégios local é `VIEWER < MEMBER < ADMIN`; a ordem global é `TEAM_MEMBER < MANAGER < ADMIN < ROOT`.

Quando não existe associação válida, o projeto não é revelado ao solicitante. Esse comportamento também reduz o risco de acesso indevido por identificadores de outros projetos ou tenants.

</details>
