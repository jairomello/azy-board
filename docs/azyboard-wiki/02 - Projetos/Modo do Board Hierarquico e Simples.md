---
title: Modo do Board Hierárquico e Simples
type: guide
order: 4
---

# Modo do Board Hierárquico e Simples

Cada projeto usa um dos dois formatos de Board. O modo define a estrutura disponível, os controles de visualização e o comportamento da criação de itens.

## Modo Hierárquico

É o modo padrão. O projeto organiza o trabalho como:

```text
Módulo
└── Épico
    └── História
        └── Task ou Bug
```

Características:

- Módulos, épicos e histórias participam da navegação e dos filtros.
- O Board exibe lanes aninhadas de épico e história, com expansão e recolhimento independentes.
- Tasks e bugs exigem um pai (história, task ou bug).
- Os controles do painel **Opções** — subtasks, histórias como lanes ou cards, ocultar lanes vazias — estão disponíveis.
- A criação pelo menu **Criar** oferece Módulo, Épico, História, Task e Bug.

## Modo Simples

Indicado para fluxos lineares, sem divisão funcional:

- Não existem módulos nem épicos. A aplicação cria uma história fixa chamada **Fluxo contínuo**, que recebe diretamente as tasks e bugs.
- O Board exibe uma lane única com as colunas do projeto.
- Tasks e bugs são anexados automaticamente à história fixa, mesmo quando a criação não informa pai.
- Filtros de sprint, responsável, tipo, tags, prioridade, status, versão e centro de custo continuam disponíveis.
- A seção **Módulos** não aparece nas configurações do projeto.

## Escolher o modo na criação

A janela de criação de projeto oferece a escolha do formato. A escolha define a estrutura inicial:

- **Hierárquico**: módulo **Geral** + colunas padrão.
- **Simples**: história fixa **Fluxo contínuo** + colunas padrão.

## Converter o modo depois

A conversão é feita em **Configurações do projeto > Formato do board** e exige confirmação explícita, porque altera a estrutura do projeto:

- **Para Simples**: módulos e épicos são removidos; os cards são preservados e ficam na história fixa.
- **Para Hierárquico**: a aplicação cria o módulo **Geral** e um épico **Fluxo contínuo** que recebe os cards existentes.

A conversão preserva cards e seus dados relacionados. Antes de confirmar, a tela apresenta a contagem de itens afetados para a decisão ser consciente.

## Ocultar módulos e épicos (projetos hierárquicos)

Em um projeto **Hierárquico** é possível simplificar a exibição ocultando níveis, sem migrar para o modo Simples. Em **Configurações do projeto > Formato do board** há duas opções independentes:

- **Não exibir módulos** — o projeto passa a operar com um **módulo único**; os épicos e histórias existentes são recolhidos a ele.
- **Não exibir épicos** — o projeto passa a operar com um **épico único por módulo**; as histórias existentes são recolhidas a ele.

Com as opções ligadas, o Board e a árvore pulam os níveis ocultados: o trabalho aparece a partir das histórias e tasks, sem módulos nem épicos. Os controles de criação (`Módulo` e `Épico`), o filtro de módulos e a seção **Módulos** das configurações deixam de ser exibidos.

Ligar uma opção **recolhe** os módulos/épicos existentes a um item único (as histórias, tasks, bugs e seu conteúdo são preservados). Por isso a ação pede confirmação. As opções são **reversíveis**: ao desligar, o nível volta a aparecer, o item único pode ser renomeado e novos módulos/épicos podem ser criados.

## Regras e comportamentos

- O modo é uma propriedade do projeto e vale para todas as pessoas e agentes.
- Agentes consultam o modo com `get_project` e devem respeitar a hierarquia do modo ativo.
- A troca de modo não altera participantes, sprints, versões, tags ou centros de custo.

## Funcionalidades relacionadas

- [[02 - Projetos/Criar um Projeto|Criar um projeto]]
- [[02 - Projetos/Estrutura Inicial de um Projeto|Estrutura inicial de um projeto]]
- [[03 - Estrutura do Trabalho/Hierarquia dos Itens|Hierarquia dos itens]]
- [[07 - Configuracoes do Projeto/Configuracoes do Projeto|Configurações do projeto]]

<details>
<summary><strong>Como funciona tecnicamente</strong></summary>

O modo é armazenado em `projects.board_mode` (`HIERARCHICAL` ou `SIMPLE`). Projetos simples apontam para a história fixa por `projects.simple_story_id`. A conversão é executada pelas rotas de conversão do projeto, em transação, com contagem prévia de impacto (`dryRun`) antes da confirmação destrutiva.

</details>
