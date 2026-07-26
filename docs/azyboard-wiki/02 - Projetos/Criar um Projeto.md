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
- Ação **Cancelar**.
- Ação **Criar**.

O nome deve permitir que os participantes reconheçam a iniciativa na lista e no breadcrumb do Board.

## Como criar

1. Abra a página **Projetos**.
2. Selecione **Criar projeto**.
3. Informe o nome.
4. Selecione **Criar**.
5. Aguarde o fechamento da janela.
6. Localize o novo projeto na lista.
7. Selecione-o para abrir o Board.

## Cancelar a criação

Selecione **Cancelar** para fechar a janela sem criar um projeto. O texto informado não é salvo.

## O que acontece após a criação

A aplicação:

- Cria o projeto dentro da organização da conta.
- Torna o criador `Admin` do projeto.
- Cria o módulo **Geral**.
- Cria as colunas iniciais do Board.
- Disponibiliza o projeto na lista do criador.

Membros, squads, gerente, versões, sprints, centros de custo e novos módulos podem ser configurados posteriormente.

## Regras e comportamentos

- O nome é obrigatório.
- O projeto pertence ao tenant da conta criadora.
- O criador recebe permissão administrativa.
- A estrutura inicial é criada automaticamente.
- Criar um projeto não adiciona outros participantes.
- O novo projeto começa sem itens de trabalho.

## Permissões

Qualquer conta autenticada autorizada a utilizar a organização pode criar um projeto. Essa pessoa se torna a primeira administradora do projeto.

## Boas práticas para nomes

- Use um nome reconhecido pela equipe.
- Evite nomes genéricos como “Projeto novo”.
- Diferencie iniciativas semelhantes pelo produto, área ou objetivo.
- Não inclua status temporários no nome; use versões ou sprints para isso.

## Exemplo prático

Para organizar uma nova frente de atendimento, uma pessoa cria o projeto **Central de Atendimento**. Depois, abre o Board, mantém o módulo **Geral** para demandas compartilhadas e cria módulos específicos nas configurações.

## Funcionalidades relacionadas

- [[02 - Projetos/Consultar e Abrir Projetos|Consultar e abrir projetos]]
- [[02 - Projetos/Estrutura Inicial de um Projeto|Estrutura inicial de um projeto]]
- [[07 - Configuracoes do Projeto/Configuracoes do Projeto|Configurações do Projeto]]

<details>
<summary><strong>Como funciona tecnicamente</strong></summary>

### Criação

O frontend envia o nome ao serviço de projetos. A API usa o tenant resolvido pela sessão e gera o identificador do novo projeto.

### Administração inicial

Uma membership é criada para relacionar o usuário ao projeto com papel `ADMIN`. Essa associação passa a controlar a visibilidade e as permissões do projeto.

### Estrutura padrão

Na mesma operação funcional, o backend prepara o módulo inicial e as colunas com posição e status base. Dessa forma, o projeto já pode abrir um Board válido sem configuração prévia.

</details>

