---
title: Consultar e Abrir Projetos
type: guide
order: 1
---

# Consultar e Abrir Projetos

A lista de projetos funciona como o portfólio de entrada do Azy Board. Ela apresenta os projetos disponíveis para a conta autenticada e permite escolher o contexto de trabalho.

## Onde encontrar

Depois do login, a aplicação abre a página **Projetos**. Também é possível retornar a ela por:

- Marca do Azy Board no cabeçalho do Board.
- Link **Projetos** no breadcrumb.
- Link de retorno na tela da conta.
- Navegação para a página inicial da aplicação.

## Visão da tela

A página contém:

- Cabeçalho global com idioma, tema e perfil.
- Título **Projetos**.
- Orientação para selecionar um projeto.
- Ação **Criar projeto**.
- Grade de projetos disponíveis.

Cada projeto é apresentado como um bloco selecionável com:

- Inicial do nome.
- Nome do projeto.
- Descrição, quando informada.

## Abrir um projeto

1. Localize o projeto desejado.
2. Selecione o bloco correspondente.
3. Aguarde o carregamento do Board.
4. Confirme o projeto atual pelo nome exibido no breadcrumb.

Ao abrir, a aplicação carrega a estrutura necessária ao Board, incluindo colunas, itens, módulos, tags, sprints, membros, versões, centros de custo e squads.

## Estado de carregamento

Enquanto os projetos são consultados, a área central apresenta a indicação **Carregando**. Os blocos só são exibidos depois que a consulta termina.

## Quando não há projetos

Se a conta ainda não participa de nenhum projeto, a aplicação apresenta:

- Mensagem informando que não existem projetos.
- Ação para criar o primeiro projeto.

Depois da criação, o novo projeto passa a fazer parte da lista e pode ser aberto normalmente.

## Visibilidade dos projetos

A lista não funciona como um catálogo público. Membros de Equipe e Gerentes visualizam somente projetos nos quais possuem uma associação. Admins e Root visualizam os projetos do tenant ativo, **com uma exceção**: não veem projetos marcados como **Restrito** dos quais não participam.

Além disso, projetos marcados como **Oculto** não aparecem na lista, a menos que a preferência **Mostrar projetos ocultos** esteja ligada. Veja [[02 - Projetos/Visibilidade de um Projeto|Visibilidade de um projeto]].

O papel pode variar entre projetos. Uma pessoa pode ser `Admin` em um projeto, `Membro` em outro e `Visualizador` em um terceiro.

## Regras e comportamentos

- A lista pertence à conta autenticada.
- Projetos de outras organizações não são apresentados.
- Nome e descrição ajudam a distinguir iniciativas semelhantes.
- Selecionar um projeto sempre abre o Board daquele projeto.
- Retornar à lista não encerra a sessão nem altera o projeto.
- Preferências de tema e idioma continuam disponíveis na tela.

## Permissões

O escopo depende do grupo global da conta.

| Ação | Condição |
|---|---|
| Ver projeto na lista | Possuir associação, ou ser Admin/Root no tenant ativo e o projeto não ser Restrito sem vínculo. |
| Abrir projeto | Possuir escopo global e, para Membro/Gerente, associação ao projeto. |
| Criar projeto | Ser Gerente, Admin ou Root. |

## Exemplo prático

Uma pessoa participa de **Aplicativo Mobile**, **Portal do Cliente** e **Plataforma Interna**. Ela seleciona **Portal do Cliente** e confirma o nome no breadcrumb antes de movimentar cards, evitando trabalhar no projeto errado.

## Funcionalidades relacionadas

- [[02 - Projetos/Criar um Projeto|Criar um projeto]]
- [[02 - Projetos/Estrutura Inicial de um Projeto|Estrutura inicial de um projeto]]
- [[02 - Projetos/Visibilidade de um Projeto|Visibilidade de um projeto]]
- [[04 - Board e Visualizacoes/Board e Visualizacoes|Board e Visualizações]]

<details>
<summary><strong>Como funciona tecnicamente</strong></summary>

### Consulta

O frontend solicita a coleção de projetos da conta autenticada. A API cruza projetos e memberships para obter a associação e o papel, aplica o escopo por grupo global e filtra projetos restritos sem vínculo e projetos ocultos — estes últimos liberados somente com `includeHidden=true`.

### Isolamento

O filtro combina o identificador do usuário, o tenant e a associação ao projeto. Conhecer o identificador de outro projeto não concede acesso a ele.

### Abertura

O identificador selecionado é incorporado à rota do Board. A página usa esse identificador para carregar, em paralelo, os recursos relacionados ao projeto.

</details>
