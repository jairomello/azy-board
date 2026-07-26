---
title: Perfis e Permissões
type: reference
order: 1
---

# Perfis e Permissões

O acesso a um projeto é controlado pela associação da pessoa ao projeto e pelo papel atribuído a ela.

## Admin

O `Admin` administra a estrutura e os participantes do projeto. Além das ações operacionais de um membro, pode:

- Gerenciar colunas do Board.
- Definir o gerente geral.
- Adicionar, editar e remover membros.
- Alterar papéis e squads.
- Criar, editar e excluir squads.
- Gerenciar módulos e centros de custo.
- Criar, editar e excluir versões.
- Ativar ou encerrar sprints.

## Membro

O `Membro` participa da execução do projeto. Pode:

- Criar e editar itens.
- Mover e ordenar cards.
- Criar e atualizar tags.
- Criar subtasks e checklists.
- Registrar atividades.
- Arquivar, restaurar e excluir itens.
- Criar sprints e associar itens a elas.
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
| Gerenciar estrutura do projeto | Sim | Não | Não |
| Gerenciar membros e squads | Sim | Não | Não |
| Gerenciar versões | Sim | Não | Não |

> [!info] API Keys
> Um agente autenticado por API Key atua dentro do tenant do proprietário e não recebe privilégios superiores aos permitidos no projeto.

<details>
<summary><strong>Como funciona tecnicamente</strong></summary>

As requisições autenticadas resolvem o usuário e o tenant. Para rotas de projeto, a aplicação consulta a associação entre usuário e projeto e compara o papel mínimo exigido pela operação. A ordem de privilégios é `VIEWER < MEMBER < ADMIN`.

Quando não existe associação válida, o projeto não é revelado ao solicitante. Esse comportamento também reduz o risco de acesso indevido por identificadores de outros projetos ou tenants.

</details>

