---
title: Criar um Projeto
type: guide
order: 2
---

# Criar um Projeto

Criar um projeto estabelece um novo espaço de trabalho com Board, estrutura inicial e administração independente dos demais projetos.

## Onde encontrar

Na página **Projetos**, use uma destas ações:

- **Criar projeto**, no topo da página.
- **Criar primeiro projeto**, apresentada quando a lista está vazia.

## Visão da janela de criação

A janela contém:

- Título **Novo projeto**.
- Campo obrigatório **Nome do projeto**.
- Seletor do modo: **Hierárquico** ou **Simples**. O modo hierárquico é o padrão.
- Controles de visibilidade: **Restrito** e **Oculto**, desligados por padrão.
- Ação **Cancelar**.
- Ação **Criar**.

O nome deve permitir que os participantes reconheçam a iniciativa na lista e no breadcrumb do Board.

## Como criar

1. Abra a página **Projetos**.
2. Selecione **Criar projeto**.
3. Informe o nome.
4. Escolha o modo do Board, se necessário.
5. Ligue **Restrito** ou **Oculto**, se o projeto exigir visibilidade limitada.
6. Selecione **Criar**.
7. Aguarde o fechamento da janela.
8. Localize o novo projeto na lista.
9. Selecione-o para abrir o Board.

## Cancelar a criação

Selecione **Cancelar** para fechar a janela sem criar um projeto. O texto informado não é salvo.

## O que acontece após a criação

A aplicação:

- Cria o projeto dentro da organização da conta.
- Torna o criador `Admin` do projeto.
- No modo **Hierárquico**, cria o módulo **Geral**.
- No modo **Simples**, cria uma história fixa e não exibe módulos ou épicos no Board.
- Cria as colunas iniciais do Board.
- Disponibiliza o projeto na lista do criador, mesmo quando ele é restrito ou oculto.

Membros, squads, gerente, versões, sprints, centros de custo, novos módulos e a visibilidade podem ser configurados posteriormente.

## Regras e comportamentos

- O nome é obrigatório.
- O projeto pertence ao tenant da conta criadora.
- O criador recebe permissão administrativa.
- A estrutura inicial é criada automaticamente conforme o modo escolhido.
- Criar um projeto não adiciona outros participantes.
- O novo projeto começa sem itens de trabalho.

## Permissões

Gerentes, Admins e Root podem criar projetos. Membros de Equipe não podem criar projetos. Quem cria o projeto se torna a primeira administradora dele.

## Boas práticas para nomes

- Use um nome reconhecido pela equipe.
- Evite nomes genéricos como “Projeto novo”.
- Diferencie iniciativas semelhantes pelo produto, área ou objetivo.
- Não inclua status temporários no nome; use versões ou sprints para isso.

## Exemplo prático

Para organizar uma nova frente de atendimento, uma pessoa pode criar o projeto **Central de Atendimento** no modo **Simples** para trabalhar em um único fluxo. Para uma iniciativa com estrutura por áreas, pode escolher o modo **Hierárquico**, manter o módulo **Geral** e criar módulos específicos nas configurações.

## Funcionalidades relacionadas

- [[02 - Projetos/Consultar e Abrir Projetos|Consultar e abrir projetos]]
- [[02 - Projetos/Estrutura Inicial de um Projeto|Estrutura inicial de um projeto]]
- [[02 - Projetos/Visibilidade de um Projeto|Visibilidade de um projeto]]
- [[07 - Configuracoes do Projeto/Configuracoes do Projeto|Configurações do Projeto]]

<details>
<summary><strong>Como funciona tecnicamente</strong></summary>

### Criação

O frontend envia o nome, o modo e os sinalizadores de visibilidade ao serviço de projetos. A API usa o tenant e o grupo global resolvidos pela sessão, valida a permissão de criação, valida que os sinalizadores são booleanos e gera o identificador do novo projeto.

### Administração inicial

Uma membership é criada para relacionar o usuário ao projeto com papel `ADMIN`. Essa associação passa a controlar a visibilidade e as permissões do projeto.

### Estrutura padrão

Na mesma operação funcional, o backend prepara o módulo inicial e as colunas com posição e status base. Dessa forma, o projeto já pode abrir um Board válido sem configuração prévia.

</details>
