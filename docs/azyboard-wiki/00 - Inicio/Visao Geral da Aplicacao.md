---
title: Visão Geral da Aplicação
type: overview
order: 1
---

# Visão Geral da Aplicação

O Azy Board centraliza o planejamento, a organização e o acompanhamento de projetos. Ele combina uma estrutura hierárquica de trabalho com um Board Kanban configurável e oferece os mesmos dados para pessoas e agentes de IA.

## O que a aplicação permite fazer

- Criar e acessar múltiplos projetos.
- Organizar o escopo em módulos, épicos, histórias, tasks, bugs e subtasks.
- Acompanhar a execução em um Board Kanban dividido em swimlanes e colunas.
- Consultar a mesma estrutura em uma visualização hierárquica em árvore.
- Planejar entregas por versões e sprints.
- Classificar itens por tags, prioridade, pontos, datas e centros de custo.
- Distribuir trabalho entre membros, squads e agentes de IA.
- Detalhar o trabalho com descrições, critérios de aceitação, notas e checklists.
- Registrar atividades realizadas e o tempo empregado em cada item.
- Arquivar, restaurar ou excluir itens respeitando sua hierarquia.
- Sincronizar alterações entre usuários conectados em tempo real.
- Permitir que agentes consultem e atualizem o projeto por MCP, API e Shadow Markdown.

## Áreas principais

### Projetos

A tela de projetos é o ponto de entrada após o login. Ela apresenta os projetos acessíveis à pessoa — membros de Equipe e Gerentes veem os projetos de que participam; Admins e Root veem todos os projetos do tenant, exceto os restritos dos quais não participam — e permite criar um novo projeto.

Ao criar um projeto no modo hierárquico, a aplicação prepara uma estrutura inicial com o módulo **Geral** e as colunas **Backlog**, **A Fazer**, **Fazendo**, **A Testar**, **Testando** e **Concluídas**. No modo simples, a estrutura contém a história fixa **Fluxo contínuo** e as mesmas colunas.

### Board

O Board é o ambiente operacional principal. Por padrão, ele representa a hierarquia **Épico → História → Cards** em dois níveis de lanes expansíveis. Dentro de cada história, tasks e bugs são distribuídos pelas colunas de acordo com seu estágio. Itens sem épico são reunidos em **Sem épico**, e cards descendentes de um épico sem história aparecem em **Sem história**.

O Board permite criar itens, editar títulos, abrir detalhes, mover cards, ordenar colunas, filtrar o conteúdo, alternar histórias entre lanes e cards, controlar subtasks e arquivar ou excluir itens.

### Visualização em árvore

A árvore mostra módulos, épicos, histórias, tasks, bugs e subtasks em uma única estrutura expansível. Ela também apresenta status, responsável, pontos, progresso e datas.

### Configurações do projeto

As configurações reúnem a administração de colunas, gerente geral, membros, permissões, squads, centros de custo, módulos, versões e sprints.

### Conta e agentes

A área da conta apresenta os dados do usuário e permite gerenciar API Keys. Essas chaves identificam agentes de IA e fazem com que eles atuem com as permissões do proprietário da chave.

## Princípios funcionais

### Uma única hierarquia

Todos os tipos de item fazem parte de uma mesma árvore. A posição de um item nessa árvore define seu contexto, seu breadcrumb e parte das regras de movimentação.

### Leaf Rule

Um item folha é um item que não possui filhos. Itens folha podem representar trabalho diretamente executável no Kanban. Quando uma task recebe subtasks, ela deixa de ser um card operacional e passa a consolidar o progresso dos filhos.

### Colaboração entre pessoas e IA

Pessoas usam a interface web. Agentes usam contratos próprios, mas acessam o mesmo projeto e respeitam as mesmas permissões e regras de domínio.

### Isolamento e permissões

Os dados são isolados por organização, e o acesso a cada projeto depende da associação do usuário ao projeto. O modelo tem duas camadas: o **grupo global** da conta (`Membro de Equipe`, `Gerente`, `Admin` ou `Root`) define o escopo de navegação e administração, e o **papel local** no projeto (`Admin`, `Membro` ou `Visualizador`) define as operações dentro de cada projeto.

<details>
<summary><strong>Como funciona tecnicamente</strong></summary>

A aplicação é um monorepo TypeScript. O frontend é uma SPA React com Vite. A API utiliza Hono no runtime Bun, com Drizzle ORM e persistência relacional. Tipos de domínio são compartilhados entre frontend, API e servidor MCP.

O contexto de autenticação contém o tenant do usuário. As consultas e mutações aplicam o tenant e a associação ao projeto. Eventos WebSocket propagam mudanças do Board para as sessões conectadas. O servidor MCP traduz ferramentas tipadas em chamadas à mesma API utilizada pela aplicação.

</details>

## Próximos passos

- Para entender as telas: [[00 - Inicio/Mapa de Navegacao|Mapa de navegação]].
- Para conhecer a hierarquia: [[03 - Estrutura do Trabalho/Estrutura do Trabalho|Estrutura do Trabalho]].
- Para operar o projeto: [[04 - Board e Visualizacoes/Board e Visualizacoes|Board e Visualizações]].
